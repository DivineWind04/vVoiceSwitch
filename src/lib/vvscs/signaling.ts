/**
 * v-VSCS Socket.IO Signaling Client
 *
 * Manages the Socket.IO connection to wss://ws.atlcru.art,
 * handles registration, and emits/receives signaling events.
 */

import { io, Socket } from 'socket.io-client';
import type {
  FacilityId,
  PositionName,
  SocketId,
  LineId,
  RegisterPayload,
  RegisteredResponse,
  RosterEntry,
  OverrideActiveEvent,
  OverrideClosedEvent,
  ShoutActiveEvent,
  ShoutUpdatedEvent,
  ShoutClosedEvent,
  WebrtcOfferEvent,
  WebrtcAnswerEvent,
  WebrtcIceEvent,
  WebrtcErrorEvent,
  WebrtcPeerDisconnectedEvent,
} from './types';
import { VVSCS_SERVER_URL } from './types';

// ─── Event Types ─────────────────────────────────────────────────────────────

export type VvscsSignalingEvent =
  | { type: 'connected'; socketId: SocketId }
  | { type: 'disconnected'; reason: string }
  | { type: 'registered'; socketId: SocketId }
  | { type: 'registrationFailed'; error: string }
  | { type: 'rosterUpdated'; roster: RosterEntry[] }
  | { type: 'overrideActive'; data: OverrideActiveEvent }
  | { type: 'overrideClosed'; data: OverrideClosedEvent }
  | { type: 'shoutActive'; data: ShoutActiveEvent }
  | { type: 'shoutUpdated'; data: ShoutUpdatedEvent }
  | { type: 'shoutClosed'; data: ShoutClosedEvent }
  | { type: 'webrtcOffer'; data: WebrtcOfferEvent }
  | { type: 'webrtcAnswer'; data: WebrtcAnswerEvent }
  | { type: 'webrtcIce'; data: WebrtcIceEvent }
  | { type: 'webrtcError'; data: WebrtcErrorEvent }
  | { type: 'webrtcPeerDisconnected'; data: WebrtcPeerDisconnectedEvent };

export type VvscsSignalingEventHandler = (event: VvscsSignalingEvent) => void;

// ─── Client ──────────────────────────────────────────────────────────────────

export class VvscsSignalingClient {
  private socket: Socket | null = null;
  private handlers = new Set<VvscsSignalingEventHandler>();
  private _mySocketId: SocketId | null = null;
  private _facility: FacilityId | null = null;
  private _position: PositionName | null = null;
  private _assumedPositions: PositionName[] = [];

  get mySocketId(): SocketId | null {
    return this._mySocketId;
  }
  get facility(): FacilityId | null {
    return this._facility;
  }
  get position(): PositionName | null {
    return this._position;
  }
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /** Subscribe to signaling events */
  on(handler: VvscsSignalingEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(event: VvscsSignalingEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('[vVSCS Signaling] Handler error:', err);
      }
    }
  }

  // ─── Connection ──────────────────────────────────────────────────────

  /**
   * Connect to the v-VSCS signaling server.
   * @param facility - Facility ID (e.g. "ZOA")
   * @param position - Primary position name (e.g. "R62")
   * @param assumedPositions - Additional positions being worked
   */
  connect(
    facility: FacilityId,
    position: PositionName,
    assumedPositions: PositionName[] = [],
    serverUrl: string = VVSCS_SERVER_URL,
  ): void {
    if (this.socket) {
      this.disconnect();
    }

    this._facility = facility;
    this._position = position;
    this._assumedPositions = assumedPositions;

    console.log('[vVSCS Signaling] Connecting to', serverUrl, 'as', facility, position);

    this.socket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      timeout: 5000,
    });

    this.setupListeners();
  }

  /** Disconnect from the server */
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
    }
    this._mySocketId = null;
    this._facility = null;
    this._position = null;
    this._assumedPositions = [];
  }

  private setupListeners(): void {
    const s = this.socket;
    if (!s) return;

    s.on('connect', () => {
      console.log('[vVSCS Signaling] Connected, socketId:', s.id);
      this._mySocketId = s.id ?? null;
      this.emit({ type: 'connected', socketId: s.id ?? '' });

      // Automatically register
      this.register();
    });

    s.on('disconnect', (reason: string) => {
      console.log('[vVSCS Signaling] Disconnected:', reason);
      this._mySocketId = null;
      this.emit({ type: 'disconnected', reason });
    });

    s.on('connect_error', (err: Error) => {
      console.error('[vVSCS Signaling] Connect error:', err.message);
    });

    s.on('reconnect', (attemptNumber: number) => {
      console.log(`[vVSCS Signaling] Reconnected after ${attemptNumber} tries`);
      this.register();
    });

    s.on('registered', (data: RegisteredResponse) => {
      if (data.success && data.socketId) {
        console.log('[vVSCS Signaling] Registered:', data.socketId);
        this._mySocketId = data.socketId;
        this.emit({ type: 'registered', socketId: data.socketId });
      } else {
        console.error('[vVSCS Signaling] Registration failed:', data.error);
        this.emit({ type: 'registrationFailed', error: data.error || 'Unknown error' });
      }
    });

    s.on('facility-roster', (roster: RosterEntry[]) => {
      this.emit({ type: 'rosterUpdated', roster });
    });

    // Override events
    s.on('override-active', (data: OverrideActiveEvent) => {
      this.emit({ type: 'overrideActive', data });
    });
    s.on('override-closed', (data: OverrideClosedEvent) => {
      this.emit({ type: 'overrideClosed', data });
    });

    // Shout events
    s.on('shout-active', (data: ShoutActiveEvent) => {
      this.emit({ type: 'shoutActive', data });
    });
    s.on('shout-updated', (data: ShoutUpdatedEvent) => {
      this.emit({ type: 'shoutUpdated', data });
    });
    s.on('shout-closed', (data: ShoutClosedEvent) => {
      this.emit({ type: 'shoutClosed', data });
    });

    // WebRTC signaling relay
    s.on('webrtc-offer', (data: WebrtcOfferEvent) => {
      this.emit({ type: 'webrtcOffer', data });
    });
    s.on('webrtc-answer', (data: WebrtcAnswerEvent) => {
      this.emit({ type: 'webrtcAnswer', data });
    });
    s.on('webrtc-ice', (data: WebrtcIceEvent) => {
      this.emit({ type: 'webrtcIce', data });
    });
    s.on('webrtc-error', (data: WebrtcErrorEvent) => {
      this.emit({ type: 'webrtcError', data });
    });
    s.on('webrtc-peer-disconnected', (data: WebrtcPeerDisconnectedEvent) => {
      this.emit({ type: 'webrtcPeerDisconnected', data });
    });
  }

  // ─── Registration ────────────────────────────────────────────────────

  private register(): void {
    if (!this.socket || !this._facility || !this._position) return;
    const payload: RegisterPayload = {
      facility: this._facility,
      position: this._position,
      assumedPositions: this._assumedPositions,
    };
    console.log('[vVSCS Signaling] Registering:', payload);
    this.socket.emit('register', payload);
  }

  // ─── Override / Shout Commands ────────────────────────────────────────

  /** Open an override (1:1 call) to a position */
  sendOpenOverride(to: PositionName): void {
    this.socket?.emit('open-override', { to });
  }

  /** Close an override by its lineId */
  sendCloseOverride(lineId: LineId): void {
    this.socket?.emit('close-override', { lineId });
  }

  /** Activate a shout (inter-facility broadcast) */
  sendActivateShout(line: string, remoteFacility: FacilityId): void {
    this.socket?.emit('activate-shout', { line, remoteFacility });
  }

  /** Join an active shout */
  sendJoinShout(lineId: LineId): void {
    this.socket?.emit('join-shout', { lineId });
  }

  /** Leave a shout */
  sendLeaveShout(lineId: LineId): void {
    this.socket?.emit('leave-shout', { lineId });
  }

  // ─── WebRTC Signaling ────────────────────────────────────────────────

  /** Send a WebRTC offer */
  sendWebrtcOffer(
    to: SocketId,
    offer: RTCSessionDescriptionInit,
    lineId: LineId,
    isParticipant = true,
  ): void {
    this.socket?.emit('webrtc-offer', { to, offer, lineId, isParticipant });
  }

  /** Send a WebRTC answer */
  sendWebrtcAnswer(to: SocketId, answer: RTCSessionDescriptionInit): void {
    this.socket?.emit('webrtc-answer', { to, answer });
  }

  /** Send an ICE candidate */
  sendWebrtcIce(to: SocketId, candidate: RTCIceCandidateInit): void {
    this.socket?.emit('webrtc-ice', { to, candidate });
  }

  /** Destroy all resources */
  destroy(): void {
    this.disconnect();
    this.handlers.clear();
  }
}
