/**
 * Landline WebRTC Peer Connection Manager
 *
 * One RTCPeerConnection per active call (1:1 G/G calls).
 * Audio capture is shared across connections via ref-counted stream.
 *
 * Follows the same pattern as VvscsPeerManager but keyed by CallId
 * instead of SocketId, since landline calls are identified by call ID.
 */

import type { CallId, ClientId } from './types';
import { LANDLINE_ICE_SERVERS } from './types';
import { landlineSettingsStore } from './settingsStore';

// ─── Shared Microphone Stream ────────────────────────────────────────────────

let sharedStream: MediaStream | null = null;
let streamRefCount = 0;
let micAudioCtx: AudioContext | null = null;
let micGainNode: GainNode | null = null;

async function acquireStream(): Promise<MediaStream> {
  if (sharedStream && sharedStream.getAudioTracks().length > 0) {
    streamRefCount++;
    return sharedStream;
  }
  const rawStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1,
    },
    video: false,
  });

  // Route mic through a GainNode so micGain setting is applied
  micAudioCtx = new AudioContext({ sampleRate: 48000 });
  const source = micAudioCtx.createMediaStreamSource(rawStream);
  micGainNode = micAudioCtx.createGain();
  micGainNode.gain.value = landlineSettingsStore.getSettings().micGain / 100;
  const dest = micAudioCtx.createMediaStreamDestination();
  source.connect(micGainNode).connect(dest);

  sharedStream = dest.stream;
  // Keep raw stream reference so we can stop hardware tracks on release
  (sharedStream as any)._rawStream = rawStream;
  streamRefCount = 1;
  return sharedStream;
}

/** Update the mic gain on the shared stream (called when settings change) */
export function setMicGain(gain: number): void {
  if (micGainNode) {
    micGainNode.gain.value = gain / 100;
  }
}

function releaseStream(): void {
  streamRefCount = Math.max(0, streamRefCount - 1);
  if (streamRefCount === 0 && sharedStream) {
    // Stop the raw hardware tracks
    const raw = (sharedStream as any)._rawStream as MediaStream | undefined;
    if (raw) raw.getTracks().forEach((t) => t.stop());
    sharedStream.getTracks().forEach((t) => t.stop());
    sharedStream = null;
    if (micAudioCtx) {
      micAudioCtx.close().catch(() => {});
      micAudioCtx = null;
    }
    micGainNode = null;
  }
}

// ─── Peer Connection ─────────────────────────────────────────────────────────

export interface LandlinePeerCallbacks {
  onOffer(callId: CallId, toClientId: ClientId, sdp: string): void;
  onAnswer(callId: CallId, toClientId: ClientId, sdp: string): void;
  onIceCandidate(callId: CallId, toClientId: ClientId, candidate: string): void;
  onTrack(callId: CallId, stream: MediaStream): void;
  onDisconnected(callId: CallId): void;
}

interface PeerEntry {
  callId: CallId;
  remoteClientId: ClientId;
  pc: RTCPeerConnection;
  audioElement: HTMLAudioElement | null;
  createdAt: number;
}

/** Buffer ICE candidates that arrive before the peer connection is ready */
const pendingCandidates = new Map<CallId, string[]>();

export class LandlinePeerManager {
  private peers = new Map<CallId, PeerEntry>();
  private localStream: MediaStream | null = null;
  private callbacks: LandlinePeerCallbacks;
  private iceServers: RTCIceServer[] = LANDLINE_ICE_SERVERS;

  constructor(callbacks: LandlinePeerCallbacks) {
    this.callbacks = callbacks;
  }

  /** Override ICE servers (e.g. fetched from server config) */
  setIceServers(servers: RTCIceServer[]): void {
    this.iceServers = servers;
  }

  private async ensureLocalStream(): Promise<MediaStream> {
    // Re-acquire if the previous stream's tracks were stopped (e.g. after last peer closed)
    if (!this.localStream || !this.localStream.getAudioTracks().some(t => t.readyState === 'live')) {
      this.localStream = await acquireStream();
    }
    return this.localStream;
  }

  // ─── Create / Destroy ──────────────────────────────────────────────

  /**
   * Create a peer connection and send an offer.
   * Called when WE accept or initiate a call and need to set up WebRTC.
   */
  async createOffer(callId: CallId, remoteClientId: ClientId): Promise<void> {
    this.closePeer(callId);

    const stream = await this.ensureLocalStream();
    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    // Add local audio tracks
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    const entry: PeerEntry = {
      callId,
      remoteClientId,
      pc,
      audioElement: null,
      createdAt: Date.now(),
    };
    this.peers.set(callId, entry);
    this.setupPcListeners(entry);

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);
      this.callbacks.onOffer(callId, remoteClientId, pc.localDescription!.sdp!);
      await this.flushPendingCandidates(callId);
    } catch (err) {
      console.error('[Landline Peers] Error creating offer:', err);
      this.closePeer(callId);
    }
  }

  /**
   * Handle a received WebRTC offer — create and return an answer.
   * Called when the remote party sends us their offer.
   */
  async handleOffer(callId: CallId, remoteClientId: ClientId, sdp: string): Promise<void> {
    this.closePeer(callId);

    const stream = await this.ensureLocalStream();
    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    const entry: PeerEntry = {
      callId,
      remoteClientId,
      pc,
      audioElement: null,
      createdAt: Date.now(),
    };
    this.peers.set(callId, entry);
    this.setupPcListeners(entry);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.callbacks.onAnswer(callId, remoteClientId, pc.localDescription!.sdp!);
      await this.flushPendingCandidates(callId);
    } catch (err) {
      console.error('[Landline Peers] Error handling offer:', err);
      this.closePeer(callId);
    }
  }

  /** Handle a received WebRTC answer */
  async handleAnswer(callId: CallId, sdp: string): Promise<void> {
    const entry = this.peers.get(callId);
    if (!entry) return;

    try {
      await entry.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
    } catch (err) {
      console.error('[Landline Peers] Error handling answer:', err);
    }
  }

  /** Handle a received ICE candidate — buffer if peer not yet created */
  async handleIceCandidate(callId: CallId, candidateJson: string): Promise<void> {
    const entry = this.peers.get(callId);
    if (!entry) {
      // Peer not created yet (getUserMedia still pending) — buffer
      let buf = pendingCandidates.get(callId);
      if (!buf) {
        buf = [];
        pendingCandidates.set(callId, buf);
      }
      buf.push(candidateJson);
      return;
    }

    try {
      const candidate = JSON.parse(candidateJson) as RTCIceCandidateInit;
      await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[Landline Peers] Error adding ICE candidate:', err);
    }
  }

  /** Flush any ICE candidates that were buffered before peer creation */
  private async flushPendingCandidates(callId: CallId): Promise<void> {
    const buf = pendingCandidates.get(callId);
    if (!buf || buf.length === 0) return;
    pendingCandidates.delete(callId);
    for (const json of buf) {
      await this.handleIceCandidate(callId, json);
    }
  }

  /** Close a peer connection for a call */
  closePeer(callId: CallId): void {
    pendingCandidates.delete(callId);
    const entry = this.peers.get(callId);
    if (!entry) return;

    entry.pc.close();
    if (entry.audioElement) {
      entry.audioElement.pause();
      entry.audioElement.srcObject = null;
      entry.audioElement.remove();
    }
    if ((entry as any)._audioCtx) {
      (entry as any)._audioCtx.close().catch(() => {});
    }
    this.peers.delete(callId);
    releaseStream();
  }

  /** Close all peer connections */
  closeAll(): void {
    this.peers.forEach((_, callId) => this.closePeer(callId));
    if (this.localStream) {
      releaseStream();
      this.localStream = null;
    }
  }

  /** Mute local audio tracks for a specific call (receiver hears caller, but caller can't hear receiver) */
  muteLocalTracks(callId: CallId): void {
    const entry = this.peers.get(callId);
    if (!entry) return;
    for (const sender of entry.pc.getSenders()) {
      if (sender.track && sender.track.kind === 'audio') {
        sender.track.enabled = false;
      }
    }
  }

  /** Unmute local audio tracks for a specific call (full duplex) */
  unmuteLocalTracks(callId: CallId): void {
    const entry = this.peers.get(callId);
    if (!entry) return;
    for (const sender of entry.pc.getSenders()) {
      if (sender.track && sender.track.kind === 'audio') {
        sender.track.enabled = true;
      }
    }
  }

  /** Check if a call has an active peer connection */
  hasPeer(callId: CallId): boolean {
    return this.peers.has(callId);
  }

  get peerCount(): number {
    return this.peers.size;
  }

  /** Get all active call IDs */
  getAllCallIds(): CallId[] {
    return [...this.peers.keys()];
  }

  /** Set headset volume for all active peers (0–100) */
  setVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume / 100));
    this.peers.forEach((entry) => {
      const gain = (entry as any)._gainNode as GainNode | undefined;
      if (gain) gain.gain.value = v;
    });
  }

  // ─── Internal ──────────────────────────────────────────────────────

  private setupPcListeners(entry: PeerEntry): void {
    const { pc, callId, remoteClientId } = entry;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onIceCandidate(callId, remoteClientId, JSON.stringify(event.candidate.toJSON()));
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      if (stream) {
        // Route remote audio through a PSTN telephone filter chain:
        // Bandpass 300–3400 Hz (ITU-T G.712) + dynamics compression + soft clip
        const ctx = new AudioContext();
        // Resume AudioContext — it starts suspended outside user gesture handlers
        ctx.resume().catch(() => {});
        const source = ctx.createMediaStreamSource(stream);

        // High-pass at 300 Hz — cuts low rumble
        const hpf = ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.value = 300;
        hpf.Q.value = 0.7;

        // Low-pass at 3400 Hz — cuts high-end clarity
        const lpf = ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.value = 3400;
        lpf.Q.value = 0.7;

        // Slight mid-presence boost at 1kHz (telephone resonance)
        const peak = ctx.createBiquadFilter();
        peak.type = 'peaking';
        peak.frequency.value = 1000;
        peak.gain.value = 3;
        peak.Q.value = 1.0;

        // Compressor — squashes dynamic range like a phone AGC
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -30;
        compressor.knee.value = 20;
        compressor.ratio.value = 8;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.1;

        // Waveshaper for subtle saturation / soft clipping
        const waveshaper = ctx.createWaveShaper();
        const samples = 256;
        const curve = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
          const x = (i * 2) / samples - 1;
          // tanh soft-clip
          curve[i] = Math.tanh(x * 1.5);
        }
        waveshaper.curve = curve;
        waveshaper.oversample = '2x';

        // Volume gain node (controlled by settings store)
        const gainNode = ctx.createGain();
        const vol = landlineSettingsStore.getSettings().headsetVolume;
        gainNode.gain.value = vol / 100;

        // Chain: source → HPF → LPF → peak → compressor → waveshaper → gain → destination
        const dest = ctx.createMediaStreamDestination();
        source.connect(hpf);
        hpf.connect(lpf);
        lpf.connect(peak);
        peak.connect(compressor);
        compressor.connect(waveshaper);
        waveshaper.connect(gainNode);
        gainNode.connect(dest);

        const audio = document.createElement('audio');
        audio.srcObject = dest.stream;
        audio.autoplay = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        audio.play().catch((err) => {
          console.warn('[Landline Peers] Autoplay blocked, retrying on user interaction:', err);
          const resume = () => {
            audio.play().catch(() => {});
            document.removeEventListener('click', resume);
          };
          document.addEventListener('click', resume, { once: true });
        });
        entry.audioElement = audio;
        // Keep AudioContext and gain node alive on the entry so GC doesn't collect them
        (entry as any)._audioCtx = ctx;
        (entry as any)._gainNode = gainNode;
        this.callbacks.onTrack(callId, stream);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        console.log('[Landline Peers] Peer disconnected:', callId, pc.iceConnectionState);
        this.callbacks.onDisconnected(callId);
      }
    };
  }

  destroy(): void {
    this.closeAll();
  }
}
