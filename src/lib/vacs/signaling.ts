/**
 * VACS Signaling Client
 *
 * Manages the WebSocket connection to the VACS signaling server.
 * Handles authentication, reconnection, and message routing.
 *
 * Protocol: JSON over WebSocket, tagged by "type" field.
 * Reference: vacs-protocol/src/ws/ and vacs-signaling/src/client.rs
 */

import type {
  ClientMessage,
  ServerMessage,
  ClientInfo,
  VacsConfig,
  PositionId,
} from './types';
import { VACS_PROTOCOL_VERSION, VACS_DEV_CONFIG } from './types';

// ─── Connection State ────────────────────────────────────────────────────────

export type SignalingState = 'disconnected' | 'connecting' | 'connected' | 'loggedIn';

export type SignalingEvent =
  | { type: 'stateChange'; state: SignalingState }
  | { type: 'connected'; clientInfo: ClientInfo; profile: unknown }
  | { type: 'message'; message: ServerMessage }
  | { type: 'error'; error: string };

export type SignalingEventHandler = (event: SignalingEvent) => void;

// ─── Signaling Client ────────────────────────────────────────────────────────

export class VacsSignalingClient {
  private ws: WebSocket | null = null;
  private state: SignalingState = 'disconnected';
  private config: VacsConfig;
  private token: string = '';
  private positionId: PositionId | undefined;
  private clientInfo: ClientInfo | null = null;

  private listeners: Set<SignalingEventHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 8;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private intentionalDisconnect = false;

  /** Our own client ID, set after successful login */
  get myClientId(): string | null {
    return this.clientInfo?.id ?? null;
  }

  /** Our display name from the server */
  get myDisplayName(): string | null {
    return this.clientInfo?.displayName ?? null;
  }

  /** Current connection state */
  get currentState(): SignalingState {
    return this.state;
  }

  /** Whether we are authenticated and ready to send messages */
  get isReady(): boolean {
    return this.state === 'loggedIn';
  }

  constructor(config?: Partial<VacsConfig>) {
    this.config = { ...VACS_DEV_CONFIG, ...config };
  }

  // ─── Event Handling ──────────────────────────────────────────────────────

  /** Subscribe to signaling events */
  on(handler: SignalingEventHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  private emit(event: SignalingEvent): void {
    for (const handler of this.listeners) {
      try {
        handler(event);
      } catch (err) {
        console.error('[VACS Signaling] Event handler error:', err);
      }
    }
  }

  private setState(newState: SignalingState): void {
    if (this.state !== newState) {
      console.log(`[VACS Signaling] State: ${this.state} → ${newState}`);
      this.state = newState;
      this.emit({ type: 'stateChange', state: newState });
    }
  }

  // ─── Connection ──────────────────────────────────────────────────────────

  /**
   * Connect to the VACS signaling server.
   * @param token - WebSocket authentication token from /ws/token endpoint
   * @param positionId - Optional VATSIM position ID to register with
   */
  connect(token: string, positionId?: PositionId): void {
    if (this.ws) {
      console.warn('[VACS Signaling] Already connected, disconnecting first');
      this.disconnect();
    }

    this.token = token;
    this.positionId = positionId;
    this.intentionalDisconnect = false;
    this.doConnect();
  }

  /** Gracefully disconnect from the signaling server */
  disconnect(): void {
    this.intentionalDisconnect = true;
    this.clearReconnectTimer();
    this.clearPingInterval();

    if (this.ws) {
      // Send logout before closing
      if (this.state === 'loggedIn') {
        this.sendRaw({ type: 'logout' });
      }
      try {
        this.ws.close(1000, 'Client disconnect');
      } catch {
        // ignore
      }
      this.ws = null;
    }

    this.clientInfo = null;
    this.setState('disconnected');
  }

  private doConnect(): void {
    this.setState('connecting');

    try {
      this.ws = new WebSocket(this.config.signalingUrl);
    } catch (err) {
      console.error('[VACS Signaling] WebSocket creation failed:', err);
      this.emit({ type: 'error', error: `WebSocket creation failed: ${err}` });
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[VACS Signaling] WebSocket connected, sending Login');
      this.setState('connected');
      this.reconnectAttempts = 0;

      // Send Login message
      const loginMsg: ClientMessage = {
        type: 'login',
        token: this.token,
        protocolVersion: VACS_PROTOCOL_VERSION,
        customProfile: false,
        positionId: this.positionId,
      };
      this.sendRaw(loginMsg);

      // Start ping keepalive
      this.startPingInterval();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = (event) => {
      console.error('[VACS Signaling] WebSocket error:', event);
      this.emit({ type: 'error', error: 'WebSocket error' });
    };

    this.ws.onclose = (event) => {
      console.log(`[VACS Signaling] WebSocket closed: code=${event.code} reason=${event.reason}`);
      this.ws = null;
      this.clientInfo = null;
      this.clearPingInterval();
      this.setState('disconnected');

      if (!this.intentionalDisconnect) {
        this.scheduleReconnect();
      }
    };
  }

  // ─── Message Handling ────────────────────────────────────────────────────

  private handleMessage(raw: string): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch (err) {
      console.warn('[VACS Signaling] Failed to parse message:', raw);
      return;
    }

    // Handle login response
    if (msg.type === 'sessionInfo') {
      this.clientInfo = msg.client;
      this.setState('loggedIn');
      console.log(`[VACS Signaling] Login successful: ${msg.client.displayName} (${msg.client.id})`);
      this.emit({ type: 'connected', clientInfo: msg.client, profile: msg.profile });
      return;
    }

    if (msg.type === 'loginFailure') {
      console.error('[VACS Signaling] Login failed:', msg.reason);
      this.emit({ type: 'error', error: `Login failed: ${JSON.stringify(msg.reason)}` });
      this.intentionalDisconnect = true; // Don't reconnect on auth failure
      this.ws?.close();
      return;
    }

    if (msg.type === 'disconnected') {
      console.warn('[VACS Signaling] Server disconnected us:', msg.reason);
      this.emit({ type: 'error', error: `Server disconnected: ${JSON.stringify(msg.reason)}` });
      // Allow reconnect for non-terminal reasons
      if (msg.reason === 'terminated') {
        this.intentionalDisconnect = true;
      }
      return;
    }

    if (msg.type === 'error') {
      console.warn('[VACS Signaling] Server error:', msg);
      this.emit({ type: 'error', error: `Server error: ${JSON.stringify(msg.reason)}` });
      return;
    }

    // Forward all other messages to listeners
    this.emit({ type: 'message', message: msg });
  }

  // ─── Sending Messages ───────────────────────────────────────────────────

  /** Send a message to the signaling server (must be loggedIn for most messages) */
  send(msg: ClientMessage): boolean {
    if (this.state !== 'loggedIn' && msg.type !== 'login') {
      console.warn('[VACS Signaling] Cannot send message, not logged in');
      return false;
    }
    return this.sendRaw(msg);
  }

  private sendRaw(msg: ClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[VACS Signaling] Cannot send, WebSocket not open');
      return false;
    }
    try {
      this.ws.send(JSON.stringify(msg));
      return true;
    } catch (err) {
      console.error('[VACS Signaling] Send failed:', err);
      return false;
    }
  }

  // ─── Reconnection ───────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.intentionalDisconnect) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[VACS Signaling] Max reconnect attempts reached');
      this.emit({ type: 'error', error: 'Max reconnect attempts reached' });
      return;
    }

    // Exponential backoff with jitter: base * 2^attempt, capped at 10s
    const base = 100;
    const cap = 10000;
    const exp = Math.min(base * Math.pow(2, this.reconnectAttempts), cap);
    const jitter = Math.random() * exp;
    const delay = Math.round(jitter);

    this.reconnectAttempts++;
    console.log(`[VACS Signaling] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }

  // ─── Ping / Keepalive ───────────────────────────────────────────────────

  private startPingInterval(): void {
    this.clearPingInterval();
    // Send a ping every 30s to keep the connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // WebSocket API handles pings at protocol level, but we can also
        // send an empty message or rely on the browser's native ping
        try {
          this.ws.send(''); // empty ping
        } catch {
          // ignore
        }
      }
    }, 30000);
  }

  private clearPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // ─── Convenience Methods ─────────────────────────────────────────────────

  /** Request the list of connected clients */
  requestClientList(): boolean {
    return this.send({ type: 'listClients' });
  }

  /** Request the list of stations */
  requestStationList(): boolean {
    return this.send({ type: 'listStations' });
  }

  /** Send a call invite to a station, position, or client */
  sendCallInvite(
    callId: string,
    target: { station: string } | { position: string } | { client: string },
    prio = false,
  ): boolean {
    if (!this.myClientId) return false;
    return this.send({
      type: 'callInvite',
      callId,
      source: {
        clientId: this.myClientId,
        positionId: this.positionId,
      },
      target,
      prio,
    });
  }

  /** Accept an incoming call */
  sendCallAccept(callId: string): boolean {
    if (!this.myClientId) return false;
    return this.send({
      type: 'callAccept',
      callId,
      acceptingClientId: this.myClientId,
    });
  }

  /** End an active call */
  sendCallEnd(callId: string): boolean {
    if (!this.myClientId) return false;
    return this.send({
      type: 'callEnd',
      callId,
      endingClientId: this.myClientId,
    });
  }

  /** Reject an incoming call */
  sendCallReject(callId: string, reason: 'busy' = 'busy'): boolean {
    if (!this.myClientId) return false;
    return this.send({
      type: 'callReject',
      callId,
      rejectingClientId: this.myClientId,
      reason,
    });
  }

  /** Send a WebRTC offer to the remote peer (via signaling server) */
  sendWebrtcOffer(callId: string, toClientId: string, sdp: string): boolean {
    if (!this.myClientId) return false;
    return this.send({
      type: 'webrtcOffer',
      callId,
      fromClientId: this.myClientId,
      toClientId,
      sdp,
    });
  }

  /** Send a WebRTC answer to the remote peer (via signaling server) */
  sendWebrtcAnswer(callId: string, toClientId: string, sdp: string): boolean {
    if (!this.myClientId) return false;
    return this.send({
      type: 'webrtcAnswer',
      callId,
      fromClientId: this.myClientId,
      toClientId,
      sdp,
    });
  }

  /** Send an ICE candidate to the remote peer (via signaling server) */
  sendIceCandidate(callId: string, toClientId: string, candidate: string): boolean {
    if (!this.myClientId) return false;
    return this.send({
      type: 'webrtcIceCandidate',
      callId,
      fromClientId: this.myClientId,
      toClientId,
      candidate,
    });
  }

  /** Destroy the client - disconnect and clean up all resources */
  destroy(): void {
    this.disconnect();
    this.listeners.clear();
  }
}
