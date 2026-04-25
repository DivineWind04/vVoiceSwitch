/**
 * VACS WebRTC Peer Connection Manager
 *
 * Manages WebRTC peer connections for individual VACS calls.
 * Each active call gets its own RTCPeerConnection with an audio track.
 *
 * Audio: Opus codec at 48kHz, mono (matches VACS native client).
 * ICE: Cloudflare STUN by default, TURN if configured.
 *
 * Reference: vacs-webrtc/src/peer.rs, vacs-protocol/src/http/webrtc.rs
 */

import type { IceConfig, CallId } from './types';

// ─── Default ICE Config ──────────────────────────────────────────────────────

const DEFAULT_ICE_CONFIG: IceConfig = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
  ],
};

// ─── Peer Events ─────────────────────────────────────────────────────────────

export type PeerEvent =
  | { type: 'iceCandidate'; callId: CallId; candidate: string }
  | { type: 'remoteStream'; callId: CallId; stream: MediaStream }
  | { type: 'connected'; callId: CallId }
  | { type: 'disconnected'; callId: CallId }
  | { type: 'failed'; callId: CallId; error: string };

export type PeerEventHandler = (event: PeerEvent) => void;

// ─── Audio Track Management ──────────────────────────────────────────────────

let localStream: MediaStream | null = null;
let localStreamRefCount = 0;

/** Get or create the local microphone stream (shared across all calls) */
async function acquireLocalStream(): Promise<MediaStream> {
  if (localStream && localStream.getAudioTracks().length > 0) {
    localStreamRefCount++;
    return localStream;
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 48000,
        channelCount: 1, // mono, matching VACS
      },
      video: false,
    });
    localStreamRefCount = 1;
    console.log('[VACS WebRTC] Acquired local audio stream');
    return localStream;
  } catch (err) {
    console.error('[VACS WebRTC] Failed to acquire microphone:', err);
    throw err;
  }
}

/** Release the local stream reference (stops mic when all calls end) */
function releaseLocalStream(): void {
  localStreamRefCount--;
  if (localStreamRefCount <= 0 && localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
    localStreamRefCount = 0;
    console.log('[VACS WebRTC] Released local audio stream');
  }
}

// ─── Single Peer Connection ──────────────────────────────────────────────────

export class VacsPeerConnection {
  readonly callId: CallId;
  readonly remoteClientId: string;
  private pc: RTCPeerConnection;
  private onEvent: PeerEventHandler;
  private hasLocalStream = false;
  private remoteStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private muted = false;

  /** The underlying RTCPeerConnection */
  get peerConnection(): RTCPeerConnection {
    return this.pc;
  }

  /** The remote audio stream, if available */
  get stream(): MediaStream | null {
    return this.remoteStream;
  }

  constructor(
    callId: CallId,
    remoteClientId: string,
    onEvent: PeerEventHandler,
    iceConfig?: IceConfig,
  ) {
    this.callId = callId;
    this.remoteClientId = remoteClientId;
    this.onEvent = onEvent;

    const config = iceConfig ?? DEFAULT_ICE_CONFIG;
    const rtcConfig: RTCConfiguration = {
      iceServers: config.iceServers.map((s) => ({
        urls: s.urls,
        username: s.username,
        credential: s.credential,
      })),
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };

    this.pc = new RTCPeerConnection(rtcConfig);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate as JSON string (matches VACS protocol)
        this.onEvent({
          type: 'iceCandidate',
          callId: this.callId,
          candidate: JSON.stringify(event.candidate.toJSON()),
        });
      }
    };

    this.pc.ontrack = (event) => {
      console.log(`[VACS WebRTC] Remote track received for call ${this.callId}`);
      this.remoteStream = event.streams[0] ?? new MediaStream([event.track]);

      // Create audio element for playback
      this.setupAudioPlayback();

      this.onEvent({
        type: 'remoteStream',
        callId: this.callId,
        stream: this.remoteStream,
      });
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      console.log(`[VACS WebRTC] Connection state for ${this.callId}: ${state}`);

      switch (state) {
        case 'connected':
          this.onEvent({ type: 'connected', callId: this.callId });
          break;
        case 'disconnected':
          this.onEvent({ type: 'disconnected', callId: this.callId });
          break;
        case 'failed':
          this.onEvent({ type: 'failed', callId: this.callId, error: 'ICE connection failed' });
          break;
        case 'closed':
          this.onEvent({ type: 'disconnected', callId: this.callId });
          break;
      }
    };

    this.pc.onicegatheringstatechange = () => {
      console.log(`[VACS WebRTC] ICE gathering state for ${this.callId}: ${this.pc.iceGatheringState}`);
    };
  }

  // ─── Audio Playback ────────────────────────────────────────────────────

  private setupAudioPlayback(): void {
    if (!this.remoteStream) return;

    // Remove previous audio element if any
    this.destroyAudioPlayback();

    this.audioElement = document.createElement('audio');
    this.audioElement.autoplay = true;
    this.audioElement.srcObject = this.remoteStream;
    this.audioElement.muted = this.muted;

    // Attach to DOM (required for autoplay in some browsers)
    this.audioElement.style.display = 'none';
    document.body.appendChild(this.audioElement);

    this.audioElement.play().catch((err) => {
      console.warn(`[VACS WebRTC] Audio autoplay blocked for ${this.callId}:`, err);
    });
  }

  private destroyAudioPlayback(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement.remove();
      this.audioElement = null;
    }
  }

  /** Mute/unmute the remote audio for this call */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.audioElement) {
      this.audioElement.muted = muted;
    }
  }

  // ─── Offer/Answer Flow ─────────────────────────────────────────────────

  /**
   * Create an SDP offer (caller side).
   * Adds local audio track and generates the offer.
   */
  async createOffer(): Promise<string> {
    await this.addLocalAudioTrack();

    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await this.pc.setLocalDescription(offer);
    console.log(`[VACS WebRTC] Created offer for call ${this.callId}`);
    return offer.sdp!;
  }

  /**
   * Handle an incoming SDP offer (callee side).
   * Returns the SDP answer.
   */
  async handleOffer(sdp: string): Promise<string> {
    await this.addLocalAudioTrack();

    await this.pc.setRemoteDescription({
      type: 'offer',
      sdp,
    });

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    console.log(`[VACS WebRTC] Created answer for call ${this.callId}`);
    return answer.sdp!;
  }

  /**
   * Handle an incoming SDP answer (caller side).
   */
  async handleAnswer(sdp: string): Promise<void> {
    await this.pc.setRemoteDescription({
      type: 'answer',
      sdp,
    });
    console.log(`[VACS WebRTC] Remote answer set for call ${this.callId}`);
  }

  /**
   * Add a remote ICE candidate.
   */
  async addIceCandidate(candidateJson: string): Promise<void> {
    try {
      const candidate = JSON.parse(candidateJson) as RTCIceCandidateInit;
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn(`[VACS WebRTC] Failed to add ICE candidate for ${this.callId}:`, err);
    }
  }

  // ─── Local Audio ───────────────────────────────────────────────────────

  private async addLocalAudioTrack(): Promise<void> {
    if (this.hasLocalStream) return;

    const stream = await acquireLocalStream();
    for (const track of stream.getAudioTracks()) {
      this.pc.addTrack(track, stream);
    }
    this.hasLocalStream = true;
    console.log(`[VACS WebRTC] Added local audio track for call ${this.callId}`);
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────

  /** Close the peer connection and release resources */
  close(): void {
    this.destroyAudioPlayback();

    if (this.hasLocalStream) {
      releaseLocalStream();
      this.hasLocalStream = false;
    }

    try {
      this.pc.close();
    } catch {
      // ignore
    }

    this.remoteStream = null;
    console.log(`[VACS WebRTC] Peer connection closed for call ${this.callId}`);
  }
}

// ─── Peer Connection Manager ─────────────────────────────────────────────────

/**
 * Manages all active VACS WebRTC peer connections.
 * Each call gets its own VacsPeerConnection.
 */
export class VacsPeerManager {
  private peers = new Map<CallId, VacsPeerConnection>();
  private iceConfig: IceConfig = DEFAULT_ICE_CONFIG;
  private onEvent: PeerEventHandler;

  constructor(onEvent: PeerEventHandler) {
    this.onEvent = onEvent;
  }

  /** Update the ICE server configuration (e.g. after fetching from VACS HTTP API) */
  setIceConfig(config: IceConfig): void {
    this.iceConfig = config;
    console.log('[VACS WebRTC] ICE config updated:', config.iceServers.length, 'servers');
  }

  /** Get an existing peer connection for a call */
  getPeer(callId: CallId): VacsPeerConnection | undefined {
    return this.peers.get(callId);
  }

  /** Get all active peers */
  getAllPeers(): Map<CallId, VacsPeerConnection> {
    return new Map(this.peers);
  }

  /** Number of active peer connections */
  get activeCount(): number {
    return this.peers.size;
  }

  /**
   * Create a new peer connection for a call.
   * If one already exists for this callId, it is closed and replaced.
   */
  createPeer(callId: CallId, remoteClientId: string): VacsPeerConnection {
    // Close existing peer if any
    const existing = this.peers.get(callId);
    if (existing) {
      console.warn(`[VACS WebRTC] Replacing existing peer for call ${callId}`);
      existing.close();
    }

    const peer = new VacsPeerConnection(callId, remoteClientId, this.onEvent, this.iceConfig);
    this.peers.set(callId, peer);
    console.log(`[VACS WebRTC] Created peer for call ${callId} with ${remoteClientId}`);
    return peer;
  }

  /** Close and remove a peer connection for a call */
  closePeer(callId: CallId): void {
    const peer = this.peers.get(callId);
    if (peer) {
      peer.close();
      this.peers.delete(callId);
    }
  }

  /** Close all peer connections */
  closeAll(): void {
    for (const [callId, peer] of this.peers) {
      peer.close();
    }
    this.peers.clear();
    console.log('[VACS WebRTC] All peers closed');
  }
}
