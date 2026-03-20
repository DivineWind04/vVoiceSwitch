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

// ─── Shared Microphone Stream ────────────────────────────────────────────────

let sharedStream: MediaStream | null = null;
let streamRefCount = 0;

async function acquireStream(): Promise<MediaStream> {
  if (sharedStream && sharedStream.getAudioTracks().length > 0) {
    streamRefCount++;
    return sharedStream;
  }
  sharedStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1,
    },
    video: false,
  });
  streamRefCount = 1;
  return sharedStream;
}

function releaseStream(): void {
  streamRefCount = Math.max(0, streamRefCount - 1);
  if (streamRefCount === 0 && sharedStream) {
    sharedStream.getTracks().forEach((t) => t.stop());
    sharedStream = null;
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
    if (!this.localStream) {
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

  /** Check if a call has an active peer connection */
  hasPeer(callId: CallId): boolean {
    return this.peers.has(callId);
  }

  get peerCount(): number {
    return this.peers.size;
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
      const stream = event.streams[0];
      if (stream) {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.play().catch((err) => {
          console.warn('[Landline Peers] Autoplay blocked, retrying on user interaction:', err);
          const resume = () => {
            audio.play().catch(() => {});
            document.removeEventListener('click', resume);
          };
          document.addEventListener('click', resume, { once: true });
        });
        entry.audioElement = audio;
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
