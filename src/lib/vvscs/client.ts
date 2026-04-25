/**
 * v-VSCS High-Level Client
 *
 * Coordinates the Socket.IO signaling client and WebRTC peer manager
 * to provide a simple API for making/receiving override and shout calls.
 */

import { VvscsSignalingClient } from './signaling';
import type { VvscsSignalingEvent } from './signaling';
import { VvscsPeerManager } from './webrtc';
import type {
  FacilityId,
  PositionName,
  SocketId,
  LineId,
  RosterEntry,
  ActiveLine,
  VvscsCall,
  VvscsCallState,
  OverrideActiveEvent,
  ShoutActiveEvent,
} from './types';
import { VVSCS_SERVER_URL } from './types';

// ─── Client Events ───────────────────────────────────────────────────────────

export type VvscsClientEvent =
  | { type: 'connected'; socketId: SocketId }
  | { type: 'disconnected' }
  | { type: 'registered'; socketId: SocketId }
  | { type: 'registrationFailed'; error: string }
  | { type: 'rosterUpdated'; roster: RosterEntry[] }
  | { type: 'callStateChanged'; lineId: LineId }
  | { type: 'callEnded'; lineId: LineId }
  | { type: 'error'; error: string };

export type VvscsClientEventHandler = (event: VvscsClientEvent) => void;

// ─── Client ──────────────────────────────────────────────────────────────────

export class VvscsClient {
  private signaling: VvscsSignalingClient;
  private peers: VvscsPeerManager;
  private handlers = new Set<VvscsClientEventHandler>();
  private activeLines = new Map<LineId, ActiveLine>();
  private roster: RosterEntry[] = [];
  private unsubSignaling: (() => void) | null = null;

  constructor() {
    this.signaling = new VvscsSignalingClient();
    this.peers = new VvscsPeerManager({
      onOffer: (remoteSocketId, offer, lineId, isParticipant) => {
        this.signaling.sendWebrtcOffer(remoteSocketId, offer, lineId, isParticipant);
      },
      onAnswer: (remoteSocketId, answer) => {
        this.signaling.sendWebrtcAnswer(remoteSocketId, answer);
      },
      onIceCandidate: (remoteSocketId, candidate) => {
        this.signaling.sendWebrtcIce(remoteSocketId, candidate);
      },
      onTrack: (remoteSocketId, stream) => {
        console.log('[vVSCS Client] Remote audio track from:', remoteSocketId);
        // Find which line this peer belongs to and update state
        this.activeLines.forEach((line, lineId) => {
          if (line.type === 'override' && this.peers.getPeersForLine(lineId).includes(remoteSocketId)) {
            this.emitEvent({ type: 'callStateChanged', lineId });
          } else if (line.type === 'shout' && line.participantSocketIds.includes(remoteSocketId)) {
            this.emitEvent({ type: 'callStateChanged', lineId });
          }
        });
      },
      onDisconnected: (remoteSocketId) => {
        console.log('[vVSCS Client] Peer disconnected:', remoteSocketId);
      },
    });
  }

  get isConnected(): boolean {
    return this.signaling.isConnected;
  }

  get mySocketId(): SocketId | null {
    return this.signaling.mySocketId;
  }

  get facilityRoster(): RosterEntry[] {
    return this.roster;
  }

  get activeCalls(): VvscsCall[] {
    const calls: VvscsCall[] = [];
    this.activeLines.forEach((line, lineId) => {
      calls.push(this.lineToCall(lineId, line));
    });
    return calls;
  }

  // ─── Event Emitter ───────────────────────────────────────────────────

  on(handler: VvscsClientEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emitEvent(event: VvscsClientEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('[vVSCS Client] Event handler error:', err);
      }
    }
  }

  // ─── Connection ──────────────────────────────────────────────────────

  connect(
    facility: FacilityId,
    position: PositionName,
    assumedPositions: PositionName[] = [],
    serverUrl: string = VVSCS_SERVER_URL,
  ): void {
    this.unsubSignaling = this.signaling.on((event) => this.handleSignalingEvent(event));
    this.signaling.connect(facility, position, assumedPositions, serverUrl);
  }

  disconnect(): void {
    // Close all active lines
    this.activeLines.forEach((line, lineId) => {
      this.peers.closeConnectionsForLine(lineId);
    });
    this.activeLines.clear();

    this.signaling.disconnect();
    if (this.unsubSignaling) {
      this.unsubSignaling();
      this.unsubSignaling = null;
    }
  }

  // ─── Override Calls (1:1) ────────────────────────────────────────────

  /**
   * Open an override (1:1 call) to a position.
   * The server will respond with an override-active event.
   */
  openOverride(targetPosition: PositionName): void {
    if (!this.signaling.isConnected) {
      console.error('[vVSCS Client] Cannot open override: not connected');
      return;
    }
    console.log('[vVSCS Client] Opening override to:', targetPosition);
    this.signaling.sendOpenOverride(targetPosition);
  }

  /**
   * Close an active override by line ID.
   */
  closeOverride(lineId: LineId): void {
    const line = this.activeLines.get(lineId);
    if (!line || line.type !== 'override') return;

    this.signaling.sendCloseOverride(lineId);
    this.peers.closeConnectionsForLine(lineId);
    this.activeLines.delete(lineId);
    this.emitEvent({ type: 'callEnded', lineId });
  }

  // ─── Shout Lines (Multi-party) ──────────────────────────────────────

  /**
   * Activate a shout line to a remote facility.
   */
  activateShout(line: string, remoteFacility: FacilityId): void {
    if (!this.signaling.isConnected) {
      console.error('[vVSCS Client] Cannot activate shout: not connected');
      return;
    }
    console.log('[vVSCS Client] Activating shout:', line, 'to', remoteFacility);
    this.signaling.sendActivateShout(line, remoteFacility);
  }

  /**
   * Join an active shout line.
   */
  joinShout(lineId: LineId): void {
    this.signaling.sendJoinShout(lineId);
  }

  /**
   * Leave a shout line.
   */
  leaveShout(lineId: LineId): void {
    const line = this.activeLines.get(lineId);
    if (!line || line.type !== 'shout') return;

    this.signaling.sendLeaveShout(lineId);
    this.peers.closeConnectionsForLine(lineId);
    this.activeLines.delete(lineId);
    this.emitEvent({ type: 'callEnded', lineId });
  }

  // ─── Generic End Call ────────────────────────────────────────────────

  /** End any active line by its ID */
  endCall(lineId: LineId): void {
    const line = this.activeLines.get(lineId);
    if (!line) return;

    if (line.type === 'override') {
      this.closeOverride(lineId);
    } else if (line.type === 'shout') {
      this.leaveShout(lineId);
    }
  }

  // ─── G/G Status Bridge ──────────────────────────────────────────────

  /**
   * Get active calls formatted for insertion into the gg_status array.
   * Each call maps to a G/G button with isVvscs: true.
   */
  getGgStatusEntries(): any[] {
    const entries: any[] = [];
    this.activeLines.forEach((line, lineId) => {
      const call = this.lineToCall(lineId, line);
      const status = this.mapCallStateToGgStatus(call.state);
      entries.push({
        call: `VVSCS_${call.displayName}`,
        call_name: call.displayName,
        status,
        isVvscs: true,
        vvscsLineId: lineId,
        vvscsLineType: line.type,
        lineType: 2, // Regular G/G type
      });
    });
    return entries;
  }

  // ─── Internal: Signaling Event Handler ───────────────────────────────

  private handleSignalingEvent(event: VvscsSignalingEvent): void {
    switch (event.type) {
      case 'connected':
        this.emitEvent({ type: 'connected', socketId: event.socketId });
        break;

      case 'disconnected':
        this.activeLines.clear();
        this.peers.closeAll();
        this.roster = [];
        this.emitEvent({ type: 'disconnected' });
        break;

      case 'registered':
        this.emitEvent({ type: 'registered', socketId: event.socketId });
        break;

      case 'registrationFailed':
        this.emitEvent({ type: 'error', error: `Registration failed: ${event.error}` });
        break;

      case 'rosterUpdated':
        this.roster = event.roster;
        this.emitEvent({ type: 'rosterUpdated', roster: event.roster });
        break;

      case 'overrideActive':
        this.handleOverrideActive(event.data);
        break;

      case 'overrideClosed':
        this.handleOverrideClosed(event.data.lineId);
        break;

      case 'shoutActive':
        this.handleShoutActive(event.data);
        break;

      case 'shoutUpdated':
        this.handleShoutUpdated(event.data);
        break;

      case 'shoutClosed':
        this.handleShoutClosed(event.data.lineId);
        break;

      case 'webrtcOffer':
        this.peers.handleOffer(
          event.data.from,
          event.data.offer,
          event.data.lineId || 'unknown',
          event.data.isParticipant ?? true,
        );
        break;

      case 'webrtcAnswer':
        this.peers.handleAnswer(event.data.from, event.data.answer);
        break;

      case 'webrtcIce':
        this.peers.handleIceCandidate(event.data.from, event.data.candidate);
        break;

      case 'webrtcError':
        console.error('[vVSCS Client] WebRTC error:', event.data.error, 'target:', event.data.targetSocketId);
        break;

      case 'webrtcPeerDisconnected':
        this.peers.closePeer(event.data.disconnectedSocketId);
        break;
    }
  }

  // ─── Override Handling ───────────────────────────────────────────────

  private handleOverrideActive(data: OverrideActiveEvent): void {
    const myPosition = this.signaling.position;
    const initiatedByMe = data.initiator === myPosition;

    const line: ActiveLine = {
      lineId: data.lineId,
      type: 'override',
      positions: data.positions,
      initiatedByMe,
    };
    this.activeLines.set(data.lineId, line);
    this.emitEvent({ type: 'callStateChanged', lineId: data.lineId });

    // If we initiated, set up WebRTC to the target
    if (initiatedByMe) {
      const targetPosition = data.positions.find((p) => p !== myPosition);
      if (targetPosition) {
        const rosterEntry = this.roster.find((r) => r.position === targetPosition);
        if (rosterEntry && rosterEntry.socketId !== this.mySocketId) {
          console.log('[vVSCS Client] Initiating WebRTC for override to:', targetPosition, rosterEntry.socketId);
          this.peers.createOffer(rosterEntry.socketId, data.lineId);
        }
      }
    }
    // If we did NOT initiate, the server tells the initiator our socketId,
    // and they will send us a WebRTC offer. We handle it via webrtcOffer event.
  }

  private handleOverrideClosed(lineId: LineId): void {
    const line = this.activeLines.get(lineId);
    if (!line) return;

    this.peers.closeConnectionsForLine(lineId);
    this.activeLines.delete(lineId);
    this.emitEvent({ type: 'callEnded', lineId });
  }

  // ─── Shout Handling ──────────────────────────────────────────────────

  private handleShoutActive(data: ShoutActiveEvent): void {
    const line: ActiveLine = {
      lineId: data.lineId,
      type: 'shout',
      mode: data.mode,
      participantSocketIds: [data.initiatorSocketId],
      participants: [],
    };
    this.activeLines.set(data.lineId, line);
    this.emitEvent({ type: 'callStateChanged', lineId: data.lineId });

    // If someone else initiated, connect to them
    if (data.initiatorSocketId !== this.mySocketId) {
      const isHeadset = data.mode === 'headset';
      console.log('[vVSCS Client] Joining shout, connecting to initiator:', data.initiatorSocketId);
      this.peers.createOffer(data.initiatorSocketId, data.lineId, isHeadset);
    }
  }

  private handleShoutUpdated(data: { lineId: LineId; participantSocketIds?: SocketId[]; [key: string]: any }): void {
    const line = this.activeLines.get(data.lineId);
    if (!line || line.type !== 'shout') return;

    if (data.participantSocketIds) {
      // Connect to any new participants
      const newParticipants = data.participantSocketIds.filter(
        (sid) => sid !== this.mySocketId && !line.participantSocketIds.includes(sid)
      );
      for (const sid of newParticipants) {
        this.peers.createOffer(sid, data.lineId, true);
      }
      line.participantSocketIds = data.participantSocketIds;
    }

    this.emitEvent({ type: 'callStateChanged', lineId: data.lineId });
  }

  private handleShoutClosed(lineId: LineId): void {
    const line = this.activeLines.get(lineId);
    if (!line) return;

    this.peers.closeConnectionsForLine(lineId);
    this.activeLines.delete(lineId);
    this.emitEvent({ type: 'callEnded', lineId });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private lineToCall(lineId: LineId, line: ActiveLine): VvscsCall {
    const peerSocketIds = this.peers.getPeersForLine(lineId);
    let state: VvscsCallState = 'idle';

    if (peerSocketIds.length > 0) {
      state = 'active';
    } else if (line.type === 'override' && line.initiatedByMe) {
      state = 'initiating';
    } else if (line.type === 'override' && !line.initiatedByMe) {
      state = 'ringing';
    } else {
      state = 'initiating';
    }

    const displayName = line.type === 'override'
      ? line.positions.filter((p) => p !== this.signaling.position).join(', ') || line.positions.join(', ')
      : `SHOUT:${lineId.substring(0, 8)}`;

    return {
      lineId,
      lineType: line.type,
      state,
      remotePositions: line.type === 'override' ? line.positions : [],
      displayName,
      initiatedByMe: line.type === 'override' ? line.initiatedByMe : true,
      peerSocketIds,
    };
  }

  private mapCallStateToGgStatus(state: VvscsCallState): string {
    switch (state) {
      case 'idle': return 'off';
      case 'initiating': return 'ringing';
      case 'ringing': return 'chime';
      case 'active': return 'ok';
      case 'closing': return 'terminate';
    }
  }

  /** Destroy all resources */
  destroy(): void {
    this.disconnect();
    this.signaling.destroy();
    this.peers.destroy();
    this.handlers.clear();
  }
}
