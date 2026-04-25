/**
 * v-VSCS WebRTC Peer Connection Manager
 *
 * Manages RTCPeerConnection instances for v-VSCS calls.
 * Each remote socketId gets one peer connection.
 * Audio capture is shared across all connections.
 */

import type { SocketId, LineId } from './types';
import { VVSCS_ICE_SERVERS } from './types';

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

export interface VvscsPeerCallbacks {
  onOffer(remoteSocketId: SocketId, offer: RTCSessionDescriptionInit, lineId: LineId, isParticipant: boolean): void;
  onAnswer(remoteSocketId: SocketId, answer: RTCSessionDescriptionInit): void;
  onIceCandidate(remoteSocketId: SocketId, candidate: RTCIceCandidateInit): void;
  onTrack(remoteSocketId: SocketId, stream: MediaStream): void;
  onDisconnected(remoteSocketId: SocketId): void;
}

interface PeerEntry {
  lineId: LineId;
  remoteSocketId: SocketId;
  pc: RTCPeerConnection;
  isParticipant: boolean;
  audioElement: HTMLAudioElement | null;
  createdAt: number;
}

export class VvscsPeerManager {
  private peers = new Map<SocketId, PeerEntry>();
  private localStream: MediaStream | null = null;
  private callbacks: VvscsPeerCallbacks;

  constructor(callbacks: VvscsPeerCallbacks) {
    this.callbacks = callbacks;
  }

  /** Get the local microphone stream (lazy init) */
  private async ensureLocalStream(): Promise<MediaStream> {
    if (!this.localStream) {
      this.localStream = await acquireStream();
    }
    return this.localStream;
  }

  // ─── Create / Destroy ──────────────────────────────────────────────

  /**
   * Create a peer connection and send an offer.
   * Called when WE initiate a call to a remote socketId.
   */
  async createOffer(
    remoteSocketId: SocketId,
    lineId: LineId,
    isParticipant = true,
  ): Promise<void> {
    // Close existing connection to this peer if any
    this.closePeer(remoteSocketId);

    const stream = await this.ensureLocalStream();
    const pc = new RTCPeerConnection({ iceServers: VVSCS_ICE_SERVERS });

    // Add local tracks
    if (isParticipant && stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    const entry: PeerEntry = {
      lineId,
      remoteSocketId,
      pc,
      isParticipant,
      audioElement: null,
      createdAt: Date.now(),
    };
    this.peers.set(remoteSocketId, entry);

    this.setupPcListeners(entry);

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);
      this.callbacks.onOffer(remoteSocketId, pc.localDescription!, lineId, isParticipant);
    } catch (err) {
      console.error('[vVSCS Peers] Error creating offer:', err);
      this.closePeer(remoteSocketId);
    }
  }

  /**
   * Handle a received offer — create answer.
   * Called when a REMOTE peer initiates a call to us.
   */
  async handleOffer(
    remoteSocketId: SocketId,
    offer: RTCSessionDescriptionInit,
    lineId: LineId,
    isParticipant = true,
  ): Promise<void> {
    // Close existing connection to this peer if any
    this.closePeer(remoteSocketId);

    const stream = await this.ensureLocalStream();
    const pc = new RTCPeerConnection({ iceServers: VVSCS_ICE_SERVERS });

    // Add local tracks
    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    }

    const entry: PeerEntry = {
      lineId,
      remoteSocketId,
      pc,
      isParticipant,
      audioElement: null,
      createdAt: Date.now(),
    };
    this.peers.set(remoteSocketId, entry);

    this.setupPcListeners(entry);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.callbacks.onAnswer(remoteSocketId, pc.localDescription!);
    } catch (err) {
      console.error('[vVSCS Peers] Error handling offer:', err);
      this.closePeer(remoteSocketId);
    }
  }

  /** Handle a received answer */
  async handleAnswer(remoteSocketId: SocketId, answer: RTCSessionDescriptionInit): Promise<void> {
    const entry = this.peers.get(remoteSocketId);
    if (!entry) return;

    try {
      await entry.pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('[vVSCS Peers] Error handling answer:', err);
    }
  }

  /** Handle a received ICE candidate */
  async handleIceCandidate(remoteSocketId: SocketId, candidate: RTCIceCandidateInit): Promise<void> {
    const entry = this.peers.get(remoteSocketId);
    if (!entry) return;

    try {
      await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[vVSCS Peers] Error adding ICE candidate:', err);
    }
  }

  /** Close a single peer connection */
  closePeer(remoteSocketId: SocketId): void {
    const entry = this.peers.get(remoteSocketId);
    if (!entry) return;

    entry.pc.close();
    if (entry.audioElement) {
      entry.audioElement.pause();
      entry.audioElement.srcObject = null;
    }
    this.peers.delete(remoteSocketId);
  }

  /** Close all peer connections for a line */
  closeConnectionsForLine(lineId: LineId): void {
    const toClose: SocketId[] = [];
    this.peers.forEach((entry, socketId) => {
      if (entry.lineId === lineId) toClose.push(socketId);
    });
    toClose.forEach((sid) => this.closePeer(sid));
  }

  /** Close all peer connections */
  closeAll(): void {
    this.peers.forEach((_, sid) => this.closePeer(sid));
    if (this.localStream) {
      releaseStream();
      this.localStream = null;
    }
  }

  /** Get socket IDs with active connections for a line */
  getPeersForLine(lineId: LineId): SocketId[] {
    const result: SocketId[] = [];
    this.peers.forEach((entry, sid) => {
      if (entry.lineId === lineId) result.push(sid);
    });
    return result;
  }

  /** Number of active peers */
  get peerCount(): number {
    return this.peers.size;
  }

  // ─── Internal ──────────────────────────────────────────────────────

  private setupPcListeners(entry: PeerEntry): void {
    const { pc, remoteSocketId } = entry;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onIceCandidate(remoteSocketId, event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        // Auto-play remote audio
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        entry.audioElement = audio;
        this.callbacks.onTrack(remoteSocketId, stream);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        console.log('[vVSCS Peers] Peer disconnected:', remoteSocketId, pc.iceConnectionState);
        this.callbacks.onDisconnected(remoteSocketId);
      }
    };
  }

  /** Destroy everything */
  destroy(): void {
    this.closeAll();
  }
}
