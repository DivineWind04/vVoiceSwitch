/**
 * VACS Client
 *
 * High-level client that coordinates the signaling WebSocket and WebRTC
 * peer connections to provide a simple API for making/receiving VACS calls.
 *
 * This bridges the VACS call state into the format used by our existing
 * gg_status array in the zustand store, so the UI buttons work unchanged.
 *
 * Usage:
 *   const client = new VacsClient();
 *   client.on(event => { ... });
 *   client.connect(token, 'ZOA_33_CTR');
 *   client.call('KSFO_TWR');       // call a station
 *   client.acceptCall(callId);     // accept incoming
 *   client.endCall(callId);        // hang up
 */

import type {
  VacsConfig,
  VacsCall,
  VacsCallState,
  CallId,
  ClientId,
  PositionId,
  StationId,
  ClientInfo,
  ServerMessage,
  IceConfig,
} from './types';
import { VACS_DEV_CONFIG } from './types';
import { VacsSignalingClient, type SignalingEvent } from './signaling';
import { VacsPeerManager, type PeerEvent } from './webrtc';

// ─── Client Events ───────────────────────────────────────────────────────────

export type VacsClientEvent =
  | { type: 'connected'; clientInfo: ClientInfo }
  | { type: 'disconnected' }
  | { type: 'callStateChanged'; call: VacsCall }
  | { type: 'callEnded'; callId: CallId }
  | { type: 'clientsUpdated'; clients: ClientInfo[] }
  | { type: 'stationsUpdated'; stations: Array<{ id: StationId; own: boolean }> }
  | { type: 'error'; error: string };

export type VacsClientEventHandler = (event: VacsClientEvent) => void;

// ─── UUIDv7-ish generator ────────────────────────────────────────────────────

function generateCallId(): string {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: simple v4-like UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── VACS Client ─────────────────────────────────────────────────────────────

export class VacsClient {
  private signaling: VacsSignalingClient;
  private peers: VacsPeerManager;
  private calls = new Map<CallId, VacsCall>();
  private clients = new Map<ClientId, ClientInfo>();
  private stations: Array<{ id: StationId; own: boolean }> = [];
  private listeners = new Set<VacsClientEventHandler>();
  private config: VacsConfig;

  /** Whether the VACS client is connected and authenticated */
  get isConnected(): boolean {
    return this.signaling.isReady;
  }

  /** Our own client ID (VATSIM CID) */
  get myClientId(): string | null {
    return this.signaling.myClientId;
  }

  /** All active calls */
  get activeCalls(): VacsCall[] {
    return Array.from(this.calls.values());
  }

  /** All known connected clients */
  get connectedClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  /** Known stations */
  get knownStations(): Array<{ id: StationId; own: boolean }> {
    return this.stations;
  }

  constructor(config?: Partial<VacsConfig>) {
    this.config = { ...VACS_DEV_CONFIG, ...config };

    // Create signaling client
    this.signaling = new VacsSignalingClient(this.config);
    this.signaling.on((event) => this.handleSignalingEvent(event));

    // Create WebRTC peer manager
    this.peers = new VacsPeerManager((event) => this.handlePeerEvent(event));
  }

  // ─── Event Handling ──────────────────────────────────────────────────────

  /** Subscribe to client events */
  on(handler: VacsClientEventHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  private emit(event: VacsClientEvent): void {
    for (const handler of this.listeners) {
      try {
        handler(event);
      } catch (err) {
        console.error('[VACS Client] Event handler error:', err);
      }
    }
  }

  // ─── Connection ──────────────────────────────────────────────────────────

  /**
   * Connect to the VACS signaling server.
   * @param token - WebSocket token obtained from the VACS HTTP auth flow
   * @param positionId - VATSIM position callsign (e.g. "ZOA_33_CTR")
   */
  connect(token: string, positionId?: PositionId): void {
    this.signaling.connect(token, positionId);
  }

  /** Disconnect from VACS, ending all calls */
  disconnect(): void {
    // End all active calls
    for (const [callId] of this.calls) {
      this.endCall(callId);
    }
    this.peers.closeAll();
    this.calls.clear();
    this.clients.clear();
    this.stations = [];
    this.signaling.disconnect();
    this.emit({ type: 'disconnected' });
  }

  /** Fetch ICE config from the VACS HTTP API and update the peer manager */
  async fetchIceConfig(): Promise<void> {
    try {
      const resp = await fetch(`${this.config.httpBaseUrl}/webrtc/ice`, {
        credentials: 'include',
      });
      if (resp.ok) {
        const config = (await resp.json()) as IceConfig;
        this.peers.setIceConfig(config);
      }
    } catch (err) {
      console.warn('[VACS Client] Failed to fetch ICE config, using defaults:', err);
    }
  }

  // ─── Call Management ─────────────────────────────────────────────────────

  /**
   * Initiate a call to a station.
   * @param stationId - Target station (e.g. "KSFO_TWR")
   * @param prio - Priority call flag
   * @returns The call ID, or null if not connected
   */
  callStation(stationId: StationId, prio = false): CallId | null {
    if (!this.isConnected) return null;
    const callId = generateCallId();
    this.signaling.sendCallInvite(callId, { station: stationId }, prio);
    this.upsertCall(callId, {
      callId,
      remoteClientId: '', // Will be set when call is accepted
      remoteDisplayName: stationId,
      remoteStationId: stationId,
      direction: 'outgoing',
      prio,
      state: 'inviting',
      startedAt: Date.now(),
    });
    return callId;
  }

  /**
   * Initiate a call to a position.
   * @param positionId - Target position (e.g. "ZOA_33_CTR")
   * @param prio - Priority call flag
   */
  callPosition(positionId: PositionId, prio = false): CallId | null {
    if (!this.isConnected) return null;
    const callId = generateCallId();
    this.signaling.sendCallInvite(callId, { position: positionId }, prio);
    this.upsertCall(callId, {
      callId,
      remoteClientId: '',
      remoteDisplayName: positionId,
      remotePositionId: positionId,
      direction: 'outgoing',
      prio,
      state: 'inviting',
      startedAt: Date.now(),
    });
    return callId;
  }

  /**
   * Initiate a call to a specific client.
   * @param clientId - Target client ID (CID)
   * @param prio - Priority call flag
   */
  callClient(clientId: ClientId, prio = false): CallId | null {
    if (!this.isConnected) return null;
    const callId = generateCallId();
    const info = this.clients.get(clientId);
    this.signaling.sendCallInvite(callId, { client: clientId }, prio);
    this.upsertCall(callId, {
      callId,
      remoteClientId: clientId,
      remoteDisplayName: info?.displayName ?? clientId,
      remotePositionId: info?.positionId,
      direction: 'outgoing',
      prio,
      state: 'inviting',
      startedAt: Date.now(),
    });
    return callId;
  }

  /** Accept an incoming call */
  async acceptCall(callId: CallId): Promise<void> {
    const call = this.calls.get(callId);
    if (!call || call.state !== 'ringing') {
      console.warn(`[VACS Client] Cannot accept call ${callId}: not ringing`);
      return;
    }

    this.signaling.sendCallAccept(callId);
    this.updateCallState(callId, 'accepting');

    // The caller will send us a WebrtcOffer after we accept
  }

  /** Reject an incoming call */
  rejectCall(callId: CallId): void {
    const call = this.calls.get(callId);
    if (!call || call.state !== 'ringing') return;

    this.signaling.sendCallReject(callId);
    this.removeCall(callId);
  }

  /** End an active or ringing call */
  endCall(callId: CallId): void {
    const call = this.calls.get(callId);
    if (!call) return;

    this.signaling.sendCallEnd(callId);
    this.peers.closePeer(callId);
    this.removeCall(callId);
  }

  // ─── Store Bridge ────────────────────────────────────────────────────────

  /**
   * Get VACS calls formatted for insertion into the gg_status array.
   * Each call becomes a G/G button object matching the existing format:
   *   { call: string, call_name: string, status: string, isVacs: true, vacsCallId, ... }
   */
  getGgStatusEntries(): any[] {
    const entries: any[] = [];
    for (const call of this.calls.values()) {
      const status = this.mapCallStateToGgStatus(call.state);
      entries.push({
        call: `VACS_${call.remoteStationId || call.remotePositionId || call.remoteClientId}`,
        call_name: call.remoteDisplayName,
        status,
        isVacs: true,
        vacsCallId: call.callId,
        vacsPrio: call.prio,
        vacsDirection: call.direction,
        lineType: 2, // Regular G/G type
      });
    }
    return entries;
  }

  /** Map VACS call state to the G/G status strings used by our UI */
  private mapCallStateToGgStatus(state: VacsCallState): string {
    switch (state) {
      case 'idle': return 'off';
      case 'inviting': return 'ringing'; // outgoing ring
      case 'ringing': return 'chime';    // incoming ring
      case 'accepting': return 'chime';
      case 'connecting': return 'ringing';
      case 'connected': return 'ok';     // active call
      case 'ended': return 'off';
      case 'error': return 'off';
      default: return 'off';
    }
  }

  // ─── Signaling Event Handling ────────────────────────────────────────────

  private handleSignalingEvent(event: SignalingEvent): void {
    switch (event.type) {
      case 'connected':
        this.emit({ type: 'connected', clientInfo: event.clientInfo });
        // Fetch client/station lists
        this.signaling.requestClientList();
        this.signaling.requestStationList();
        // Fetch ICE config
        this.fetchIceConfig();
        break;

      case 'stateChange':
        if (event.state === 'disconnected') {
          this.emit({ type: 'disconnected' });
        }
        break;

      case 'message':
        this.handleServerMessage(event.message);
        break;

      case 'error':
        this.emit({ type: 'error', error: event.error });
        break;
    }
  }

  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      // ─── Call Signaling ──────────────────────────────────────────────

      case 'callInvite':
        this.handleIncomingCall(msg);
        break;

      case 'callAccept':
        this.handleCallAccepted(msg);
        break;

      case 'callEnd':
        this.handleCallEnded(msg.callId);
        break;

      case 'callCancelled':
        this.handleCallCancelled(msg.callId, msg.reason);
        break;

      case 'callError':
        this.handleCallError(msg.callId, msg.reason, msg.message);
        break;

      // ─── WebRTC Signaling ───────────────────────────────────────────

      case 'webrtcOffer':
        this.handleWebrtcOffer(msg.callId, msg.fromClientId, msg.sdp);
        break;

      case 'webrtcAnswer':
        this.handleWebrtcAnswer(msg.callId, msg.sdp);
        break;

      case 'webrtcIceCandidate':
        this.handleIceCandidate(msg.callId, msg.candidate);
        break;

      // ─── Client/Station Updates ─────────────────────────────────────

      case 'clientList':
        this.clients.clear();
        for (const c of msg.clients) {
          this.clients.set(c.id, c);
        }
        this.emit({ type: 'clientsUpdated', clients: msg.clients });
        break;

      case 'clientConnected':
        this.clients.set(msg.client.id, msg.client);
        this.emit({ type: 'clientsUpdated', clients: Array.from(this.clients.values()) });
        break;

      case 'clientDisconnected':
        this.clients.delete(msg.clientId);
        this.emit({ type: 'clientsUpdated', clients: Array.from(this.clients.values()) });
        break;

      case 'stationList':
        this.stations = msg.stations;
        this.emit({ type: 'stationsUpdated', stations: msg.stations });
        break;

      case 'stationChanges':
        for (const change of msg.changes) {
          if (change.type === 'online') {
            // Add station if not already known
            if (!this.stations.find((s) => s.id === change.stationId)) {
              this.stations.push({ id: change.stationId, own: false });
            }
          } else if (change.type === 'offline') {
            this.stations = this.stations.filter((s) => s.id !== change.stationId);
          }
        }
        this.emit({ type: 'stationsUpdated', stations: this.stations });
        break;
    }
  }

  // ─── Call Signaling Handlers ─────────────────────────────────────────────

  private handleIncomingCall(msg: ServerMessage & { type: 'callInvite' }): void {
    console.log(`[VACS Client] Incoming call ${msg.callId} from ${msg.source.clientId}`);

    const sourceInfo = this.clients.get(msg.source.clientId);
    const displayName = sourceInfo?.displayName ?? msg.source.stationId ?? msg.source.positionId ?? msg.source.clientId;

    this.upsertCall(msg.callId, {
      callId: msg.callId,
      remoteClientId: msg.source.clientId,
      remoteDisplayName: displayName,
      remotePositionId: msg.source.positionId,
      remoteStationId: msg.source.stationId,
      direction: 'incoming',
      prio: msg.prio,
      state: 'ringing',
      startedAt: Date.now(),
    });
  }

  private async handleCallAccepted(msg: ServerMessage & { type: 'callAccept' }): Promise<void> {
    const call = this.calls.get(msg.callId);
    if (!call) return;

    console.log(`[VACS Client] Call ${msg.callId} accepted by ${msg.acceptingClientId}`);

    // Update remote client ID
    call.remoteClientId = msg.acceptingClientId;
    const info = this.clients.get(msg.acceptingClientId);
    if (info) {
      call.remoteDisplayName = info.displayName;
    }

    // If we initiated the call, we send the WebRTC offer
    if (call.direction === 'outgoing') {
      this.updateCallState(msg.callId, 'connecting');

      try {
        const peer = this.peers.createPeer(msg.callId, msg.acceptingClientId);
        const sdp = await peer.createOffer();
        this.signaling.sendWebrtcOffer(msg.callId, msg.acceptingClientId, sdp);
      } catch (err) {
        console.error(`[VACS Client] Failed to create WebRTC offer for ${msg.callId}:`, err);
        this.updateCallState(msg.callId, 'error');
        this.signaling.send({
          type: 'callError',
          callId: msg.callId,
          reason: 'webrtcFailure',
          message: `${err}`,
        });
      }
    }
  }

  private handleCallEnded(callId: CallId): void {
    console.log(`[VACS Client] Call ${callId} ended`);
    this.peers.closePeer(callId);
    this.removeCall(callId);
  }

  private handleCallCancelled(callId: CallId, reason: any): void {
    console.log(`[VACS Client] Call ${callId} cancelled:`, reason);
    this.peers.closePeer(callId);
    this.removeCall(callId);
  }

  private handleCallError(callId: CallId, reason: string, message?: string): void {
    console.error(`[VACS Client] Call ${callId} error: ${reason}`, message);
    this.updateCallState(callId, 'error');
    setTimeout(() => {
      this.peers.closePeer(callId);
      this.removeCall(callId);
    }, 2000);
  }

  // ─── WebRTC Signaling Handlers ───────────────────────────────────────────

  private async handleWebrtcOffer(callId: CallId, fromClientId: ClientId, sdp: string): Promise<void> {
    const call = this.calls.get(callId);
    if (!call) {
      console.warn(`[VACS Client] Received WebRTC offer for unknown call ${callId}`);
      return;
    }

    console.log(`[VACS Client] Received WebRTC offer for call ${callId}`);
    this.updateCallState(callId, 'connecting');

    try {
      const peer = this.peers.createPeer(callId, fromClientId);
      const answerSdp = await peer.handleOffer(sdp);
      this.signaling.sendWebrtcAnswer(callId, fromClientId, answerSdp);
    } catch (err) {
      console.error(`[VACS Client] Failed to handle WebRTC offer for ${callId}:`, err);
      this.updateCallState(callId, 'error');
      this.signaling.send({
        type: 'callError',
        callId,
        reason: 'webrtcFailure',
        message: `${err}`,
      });
    }
  }

  private async handleWebrtcAnswer(callId: CallId, sdp: string): Promise<void> {
    const peer = this.peers.getPeer(callId);
    if (!peer) {
      console.warn(`[VACS Client] Received WebRTC answer for unknown peer ${callId}`);
      return;
    }

    console.log(`[VACS Client] Received WebRTC answer for call ${callId}`);
    try {
      await peer.handleAnswer(sdp);
    } catch (err) {
      console.error(`[VACS Client] Failed to handle WebRTC answer for ${callId}:`, err);
      this.updateCallState(callId, 'error');
    }
  }

  private async handleIceCandidate(callId: CallId, candidate: string): Promise<void> {
    const peer = this.peers.getPeer(callId);
    if (!peer) {
      // Queue for later? For now just log
      console.warn(`[VACS Client] Received ICE candidate for unknown peer ${callId}`);
      return;
    }
    await peer.addIceCandidate(candidate);
  }

  // ─── Peer Event Handling ─────────────────────────────────────────────────

  private handlePeerEvent(event: PeerEvent): void {
    switch (event.type) {
      case 'connected':
        this.updateCallState(event.callId, 'connected');
        break;

      case 'disconnected':
        this.updateCallState(event.callId, 'ended');
        setTimeout(() => this.removeCall(event.callId), 1000);
        break;

      case 'failed':
        console.error(`[VACS Client] Peer failed for ${event.callId}:`, event.error);
        this.updateCallState(event.callId, 'error');
        this.signaling.sendCallEnd(event.callId);
        setTimeout(() => this.removeCall(event.callId), 2000);
        break;

      case 'iceCandidate':
        // Forward ICE candidates to remote peer via signaling
        const call = this.calls.get(event.callId);
        if (call?.remoteClientId) {
          this.signaling.sendIceCandidate(event.callId, call.remoteClientId, event.candidate);
        }
        break;

      case 'remoteStream':
        // Audio playback is handled by VacsPeerConnection itself
        break;
    }
  }

  // ─── Internal Call State ─────────────────────────────────────────────────

  private upsertCall(callId: CallId, call: VacsCall): void {
    this.calls.set(callId, call);
    this.emit({ type: 'callStateChanged', call });
  }

  private updateCallState(callId: CallId, state: VacsCallState): void {
    const call = this.calls.get(callId);
    if (call) {
      call.state = state;
      this.emit({ type: 'callStateChanged', call });
    }
  }

  private removeCall(callId: CallId): void {
    if (this.calls.delete(callId)) {
      this.emit({ type: 'callEnded', callId });
    }
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  /** Destroy the client and release all resources */
  destroy(): void {
    this.disconnect();
    this.peers.closeAll();
    this.signaling.destroy();
    this.listeners.clear();
  }
}
