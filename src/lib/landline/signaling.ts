/**
 * Landline WebSocket Signaling Client
 *
 * Manages a WebSocket connection to the landline signaling server.
 * Sends/receives PDU messages that mirror the AFV landline call flow:
 *   CALL_U_SETUP → CALL_ACCEPTED → CALL_END
 *
 * Uses plain WebSocket (like AFV CRC) rather than Socket.IO.
 */

import type {
  FacilityId,
  PositionName,
  ClientId,
  CallId,
  LineType,
  ClientPdu,
  ServerPdu,
  RosterEntry,
  IncomingCallPdu,
  CallAcceptedRelayPdu,
  CallEndRelayPdu,
  CallHoldRelayPdu,
  CallRetrieveRelayPdu,
  CallErrorPdu,
  WebrtcOfferRelayPdu,
  WebrtcAnswerRelayPdu,
  WebrtcIceRelayPdu,
} from './types';
import { LANDLINE_SERVER_URL } from './types';

// ─── Event Types ─────────────────────────────────────────────────────────────

export type LandlineSignalingEvent =
  | { type: 'connected' }
  | { type: 'disconnected'; reason: string }
  | { type: 'registered'; clientId: ClientId }
  | { type: 'registrationFailed'; reason: string }
  | { type: 'rosterUpdated'; roster: RosterEntry[] }
  | { type: 'incomingCall'; data: IncomingCallPdu }
  | { type: 'callAccepted'; data: CallAcceptedRelayPdu }
  | { type: 'callEnded'; data: CallEndRelayPdu }
  | { type: 'callHeld'; data: CallHoldRelayPdu }
  | { type: 'callRetrieved'; data: CallRetrieveRelayPdu }
  | { type: 'callError'; data: CallErrorPdu }
  | { type: 'webrtcOffer'; data: WebrtcOfferRelayPdu }
  | { type: 'webrtcAnswer'; data: WebrtcAnswerRelayPdu }
  | { type: 'webrtcIce'; data: WebrtcIceRelayPdu }
  | { type: 'serverError'; reason: string };

export type LandlineSignalingEventHandler = (event: LandlineSignalingEvent) => void;

// ─── Client ──────────────────────────────────────────────────────────────────

export class LandlineSignalingClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<LandlineSignalingEventHandler>();
  private _clientId: ClientId | null = null;
  private _facility: FacilityId | null = null;
  private _position: PositionName | null = null;
  private _assumedPositions: PositionName[] = [];
  private _serverUrl: string = LANDLINE_SERVER_URL;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private shouldReconnect = false;

  get clientId(): ClientId | null {
    return this._clientId;
  }
  get facility(): FacilityId | null {
    return this._facility;
  }
  get position(): PositionName | null {
    return this._position;
  }
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Subscribe to signaling events */
  on(handler: LandlineSignalingEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(event: LandlineSignalingEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('[Landline Signaling] Handler error:', err);
      }
    }
  }

  // ─── Connection ──────────────────────────────────────────────────────

  connect(
    facility: FacilityId,
    position: PositionName,
    assumedPositions: PositionName[] = [],
    serverUrl: string = LANDLINE_SERVER_URL,
  ): void {
    if (this.ws) {
      this.disconnect();
    }

    this._facility = facility;
    this._position = position;
    this._assumedPositions = assumedPositions;
    this._serverUrl = serverUrl;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;

    console.log('[Landline Signaling] Connecting to', serverUrl, 'as', facility, position);
    this.openSocket();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect on intentional close
      this.ws.close();
      this.ws = null;
    }
    this._clientId = null;
  }

  private openSocket(): void {
    try {
      this.ws = new WebSocket(this._serverUrl);
    } catch (err) {
      console.error('[Landline Signaling] Failed to create WebSocket:', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[Landline Signaling] Connected');
      this.reconnectAttempts = 0;
      this.emit({ type: 'connected' });
      this.register();
    };

    this.ws.onclose = (event) => {
      console.log('[Landline Signaling] Disconnected:', event.code, event.reason);
      this._clientId = null;
      this.emit({ type: 'disconnected', reason: event.reason || `code ${event.code}` });
      this.scheduleReconnect();
    };

    this.ws.onerror = (event) => {
      console.error('[Landline Signaling] WebSocket error');
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Landline Signaling] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    console.log(`[Landline Signaling] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  // ─── Message Handling ────────────────────────────────────────────────

  private handleMessage(raw: string | ArrayBuffer | Blob): void {
    if (typeof raw !== 'string') return;

    let pdu: ServerPdu;
    try {
      pdu = JSON.parse(raw) as ServerPdu;
    } catch {
      console.error('[Landline Signaling] Invalid JSON:', raw);
      return;
    }
    console.log('[Landline Signaling] <<< RECV:', pdu.type, pdu);

    switch (pdu.type) {
      case 'REGISTERED':
        this._clientId = pdu.clientId;
        console.log('[Landline Signaling] Registered as:', pdu.clientId);
        this.emit({ type: 'registered', clientId: pdu.clientId });
        break;

      case 'REGISTER_FAILED':
        console.error('[Landline Signaling] Registration failed:', pdu.reason);
        this.emit({ type: 'registrationFailed', reason: pdu.reason });
        break;

      case 'ROSTER_UPDATE':
        this.emit({ type: 'rosterUpdated', roster: pdu.roster });
        break;

      case 'INCOMING_CALL':
        this.emit({ type: 'incomingCall', data: pdu });
        break;

      case 'CALL_ACCEPTED':
        this.emit({ type: 'callAccepted', data: pdu });
        break;

      case 'CALL_END':
        this.emit({ type: 'callEnded', data: pdu });
        break;

      case 'CALL_HOLD':
        this.emit({ type: 'callHeld', data: pdu });
        break;

      case 'CALL_RETRIEVE':
        this.emit({ type: 'callRetrieved', data: pdu });
        break;

      case 'CALL_ERROR':
        this.emit({ type: 'callError', data: pdu });
        break;

      case 'WEBRTC_OFFER':
        this.emit({ type: 'webrtcOffer', data: pdu });
        break;

      case 'WEBRTC_ANSWER':
        this.emit({ type: 'webrtcAnswer', data: pdu });
        break;

      case 'WEBRTC_ICE':
        this.emit({ type: 'webrtcIce', data: pdu });
        break;

      case 'ERROR':
        this.emit({ type: 'serverError', reason: pdu.reason });
        break;
    }
  }

  // ─── Send Helpers ────────────────────────────────────────────────────

  private send(pdu: ClientPdu): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[Landline Signaling] Cannot send: not connected, readyState:', this.ws?.readyState);
      return false;
    }
    console.log('[Landline Signaling] >>> SEND:', pdu.type, pdu);
    this.ws.send(JSON.stringify(pdu));
    return true;
  }

  // ─── Registration ────────────────────────────────────────────────────

  private register(): void {
    if (!this._facility || !this._position) return;
    this.send({
      type: 'REGISTER',
      facility: this._facility,
      position: this._position,
      assumedPositions: this._assumedPositions,
    });
  }

  // ─── Call PDUs ───────────────────────────────────────────────────────

  /** Send CALL_U_SETUP to initiate a G/G call to a position */
  sendCallSetup(
    callId: CallId,
    targetFacility: FacilityId,
    targetPosition: PositionName,
    lineType: LineType,
  ): boolean {
    return this.send({
      type: 'CALL_U_SETUP',
      callId,
      targetFacility,
      targetPosition,
      lineType,
    });
  }

  /** Send CALL_ACCEPTED to accept an incoming call */
  sendCallAccepted(callId: CallId): boolean {
    return this.send({ type: 'CALL_ACCEPTED', callId });
  }

  /** Send CALL_END to terminate a call */
  sendCallEnd(callId: CallId): boolean {
    return this.send({ type: 'CALL_END', callId });
  }

  /** Send CALL_HOLD to put a call on hold */
  sendCallHold(callId: CallId): boolean {
    return this.send({ type: 'CALL_HOLD', callId });
  }

  /** Send CALL_RETRIEVE to take a call off hold */
  sendCallRetrieve(callId: CallId): boolean {
    return this.send({ type: 'CALL_RETRIEVE', callId });
  }

  // ─── WebRTC Signaling ────────────────────────────────────────────────

  sendWebrtcOffer(callId: CallId, toClientId: ClientId, sdp: string): boolean {
    return this.send({ type: 'WEBRTC_OFFER', callId, toClientId, sdp });
  }

  sendWebrtcAnswer(callId: CallId, toClientId: ClientId, sdp: string): boolean {
    return this.send({ type: 'WEBRTC_ANSWER', callId, toClientId, sdp });
  }

  sendWebrtcIce(callId: CallId, toClientId: ClientId, candidate: string): boolean {
    return this.send({ type: 'WEBRTC_ICE', callId, toClientId, candidate });
  }

  /** Destroy all resources */
  destroy(): void {
    this.disconnect();
    this.handlers.clear();
  }
}
