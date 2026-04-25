/**
 * SignalingRoom — Cloudflare Durable Object
 *
 * A single instance holds all connected WebSocket clients,
 * the roster of registered positions, and active call state.
 * All PDU routing happens here.
 */

import type {
  ClientId,
  ClientPdu,
  ServerPdu,
  RosterEntry,
  ActiveCall,
  FacilityId,
  PositionName,
} from './types';

interface ConnectedClient {
  clientId: ClientId;
  ws: WebSocket;
  facility: FacilityId | null;
  position: PositionName | null;
  assumedPositions: PositionName[];
  registered: boolean;
}

export class SignalingRoom implements DurableObject {
  private clients = new Map<ClientId, ConnectedClient>();
  private activeCalls = new Map<string, ActiveCall>();
  private nextClientNum = 1;

  constructor(
    private state: DurableObjectState,
    private env: Record<string, unknown>,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      // Use traditional (non-hibernatable) WebSocket handling for local dev compatibility
      server.accept();
      this.handleNewConnection(server);

      // Wire up event handlers directly on the server-side WebSocket
      server.addEventListener('message', (event: MessageEvent) => {
        console.log('[Room] WS message received, data type:', typeof event.data);
        if (typeof event.data === 'string') {
          const cl = this.findClientByWs(server);
          if (!cl) return;
          let pdu: ClientPdu;
          try {
            pdu = JSON.parse(event.data) as ClientPdu;
          } catch {
            this.sendTo(server, { type: 'ERROR', reason: 'Invalid JSON' });
            return;
          }
          this.handlePdu(cl, pdu);
        }
      });
      server.addEventListener('close', () => this.handleDisconnect(server));
      server.addEventListener('error', () => this.handleDisconnect(server));

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/health') {
      return Response.json({
        ok: true,
        clients: this.clients.size,
        activeCalls: this.activeCalls.size,
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  // ─── Durable Object WebSocket Handlers ───────────────────────────────

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    const client = this.findClientByWs(ws);
    if (!client) return;

    let pdu: ClientPdu;
    try {
      pdu = JSON.parse(message) as ClientPdu;
    } catch {
      this.sendTo(ws, { type: 'ERROR', reason: 'Invalid JSON' });
      return;
    }

    this.handlePdu(client, pdu);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    this.handleDisconnect(ws);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    this.handleDisconnect(ws);
  }

  // ─── Connection Management ───────────────────────────────────────────

  private handleNewConnection(ws: WebSocket): void {
    const clientId = `c_${this.nextClientNum++}_${Date.now().toString(36)}`;
    const client: ConnectedClient = {
      clientId,
      ws,
      facility: null,
      position: null,
      assumedPositions: [],
      registered: false,
    };
    this.clients.set(clientId, client);
  }

  private handleDisconnect(ws: WebSocket): void {
    const client = this.findClientByWs(ws);
    if (!client) return;

    // End all calls involving this client
    this.activeCalls.forEach((call, callId) => {
      if (call.initiatorClientId === client.clientId || call.targetClientId === client.clientId) {
        const otherClientId = call.initiatorClientId === client.clientId
          ? call.targetClientId
          : call.initiatorClientId;

        if (otherClientId) {
          const otherClient = this.clients.get(otherClientId);
          if (otherClient) {
            this.sendTo(otherClient.ws, {
              type: 'CALL_END',
              callId,
              endedByClientId: client.clientId,
            });
          }
        }
        this.activeCalls.delete(callId);
      }
    });

    this.clients.delete(client.clientId);

    // Broadcast updated roster if they were registered
    if (client.registered) {
      this.broadcastRoster();
    }

    try { ws.close(1000, 'Client disconnected'); } catch { /* already closed */ }
  }

  // ─── PDU Router ──────────────────────────────────────────────────────

  private handlePdu(client: ConnectedClient, pdu: ClientPdu): void {
    console.log('[Room] PDU from', client.clientId, ':', pdu.type, JSON.stringify(pdu));
    switch (pdu.type) {
      case 'REGISTER':
        this.handleRegister(client, pdu.facility, pdu.position, pdu.assumedPositions);
        break;

      case 'CALL_U_SETUP':
        if (!client.registered) {
          this.sendTo(client.ws, { type: 'ERROR', reason: 'Not registered' });
          return;
        }
        this.handleCallSetup(client, pdu.callId, pdu.targetFacility, pdu.targetPosition, pdu.lineType);
        break;

      case 'CALL_ACCEPTED':
        this.handleCallAccepted(client, pdu.callId);
        break;

      case 'CALL_END':
        this.handleCallEnd(client, pdu.callId);
        break;

      case 'CALL_HOLD':
        this.handleCallHold(client, pdu.callId);
        break;

      case 'CALL_RETRIEVE':
        this.handleCallRetrieve(client, pdu.callId);
        break;

      case 'WEBRTC_OFFER':
        this.relayWebrtc(client, pdu.toClientId, {
          type: 'WEBRTC_OFFER',
          callId: pdu.callId,
          fromClientId: client.clientId,
          sdp: pdu.sdp,
        });
        break;

      case 'WEBRTC_ANSWER':
        this.relayWebrtc(client, pdu.toClientId, {
          type: 'WEBRTC_ANSWER',
          callId: pdu.callId,
          fromClientId: client.clientId,
          sdp: pdu.sdp,
        });
        break;

      case 'WEBRTC_ICE':
        this.relayWebrtc(client, pdu.toClientId, {
          type: 'WEBRTC_ICE',
          callId: pdu.callId,
          fromClientId: client.clientId,
          candidate: pdu.candidate,
        });
        break;
    }
  }

  // ─── REGISTER ────────────────────────────────────────────────────────

  private handleRegister(
    client: ConnectedClient,
    facility: FacilityId,
    position: PositionName,
    assumedPositions: PositionName[],
  ): void {
    // Check for duplicate position in same facility
    for (const [, other] of this.clients) {
      if (
        other.clientId !== client.clientId &&
        other.registered &&
        other.facility === facility &&
        other.position === position
      ) {
        this.sendTo(client.ws, {
          type: 'REGISTER_FAILED',
          reason: `Position ${position} at ${facility} is already taken`,
        });
        return;
      }
    }

    client.facility = facility;
    client.position = position;
    client.assumedPositions = assumedPositions;
    client.registered = true;

    this.sendTo(client.ws, {
      type: 'REGISTERED',
      clientId: client.clientId,
    });

    this.broadcastRoster();
  }

  // ─── CALL_U_SETUP ───────────────────────────────────────────────────

  private handleCallSetup(
    initiator: ConnectedClient,
    callId: string,
    targetFacility: FacilityId,
    targetPosition: PositionName,
    lineType: 0 | 1 | 2 | 3,
  ): void {
    // Find target client by facility + position (including assumed positions)
    // Exclude the initiator so calls don't route back to self
    const target = this.findClientByPosition(targetFacility, targetPosition, initiator.clientId);

    if (!target) {
      this.sendTo(initiator.ws, {
        type: 'CALL_ERROR',
        callId,
        reason: 'not_found',
        message: `No client at ${targetFacility}/${targetPosition}`,
      });
      return;
    }

    // Track the call
    const call: ActiveCall = {
      callId,
      initiatorClientId: initiator.clientId,
      targetClientId: target.clientId,
      targetFacility,
      targetPosition,
      lineType,
      state: 'ringing',
      createdAt: Date.now(),
    };
    this.activeCalls.set(callId, call);

    // Relay to target as INCOMING_CALL
    this.sendTo(target.ws, {
      type: 'INCOMING_CALL',
      callId,
      fromClientId: initiator.clientId,
      fromFacility: initiator.facility!,
      fromPosition: initiator.position!,
      lineType,
      targetPosition,
    });
  }

  // ─── CALL_ACCEPTED ──────────────────────────────────────────────────

  private handleCallAccepted(client: ConnectedClient, callId: string): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    // Only the target can accept
    if (call.targetClientId !== client.clientId) return;

    call.state = 'accepted';

    // Relay back to initiator
    const initiator = this.clients.get(call.initiatorClientId);
    if (initiator) {
      this.sendTo(initiator.ws, {
        type: 'CALL_ACCEPTED',
        callId,
        acceptedByClientId: client.clientId,
      });
    }
  }

  // ─── CALL_END ────────────────────────────────────────────────────────

  private handleCallEnd(client: ConnectedClient, callId: string): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    // Either party can end
    const otherClientId = call.initiatorClientId === client.clientId
      ? call.targetClientId
      : call.initiatorClientId;

    if (otherClientId) {
      const otherClient = this.clients.get(otherClientId);
      if (otherClient) {
        this.sendTo(otherClient.ws, {
          type: 'CALL_END',
          callId,
          endedByClientId: client.clientId,
        });
      }
    }

    this.activeCalls.delete(callId);
  }

  // ─── CALL_HOLD ───────────────────────────────────────────────────────

  private handleCallHold(client: ConnectedClient, callId: string): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    call.state = 'hold';

    const otherClientId = call.initiatorClientId === client.clientId
      ? call.targetClientId
      : call.initiatorClientId;

    if (otherClientId) {
      const otherClient = this.clients.get(otherClientId);
      if (otherClient) {
        this.sendTo(otherClient.ws, {
          type: 'CALL_HOLD',
          callId,
          heldByClientId: client.clientId,
        });
      }
    }
  }

  // ─── CALL_RETRIEVE ──────────────────────────────────────────────────

  private handleCallRetrieve(client: ConnectedClient, callId: string): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    call.state = 'connected';

    const otherClientId = call.initiatorClientId === client.clientId
      ? call.targetClientId
      : call.initiatorClientId;

    if (otherClientId) {
      const otherClient = this.clients.get(otherClientId);
      if (otherClient) {
        this.sendTo(otherClient.ws, {
          type: 'CALL_RETRIEVE',
          callId,
          retrievedByClientId: client.clientId,
        });
      }
    }
  }

  // ─── WebRTC Relay ────────────────────────────────────────────────────

  private relayWebrtc(from: ConnectedClient, toClientId: string, pdu: ServerPdu): void {
    const target = this.clients.get(toClientId);
    if (!target) {
      this.sendTo(from.ws, {
        type: 'CALL_ERROR',
        callId: (pdu as any).callId || '',
        reason: 'not_found',
        message: `Client ${toClientId} not connected`,
      });
      return;
    }
    this.sendTo(target.ws, pdu);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private findClientByWs(ws: WebSocket): ConnectedClient | undefined {
    for (const [, client] of this.clients) {
      if (client.ws === ws) return client;
    }
    return undefined;
  }

  private findClientByPosition(
    facility: FacilityId,
    position: PositionName,
    excludeClientId?: string,
  ): ConnectedClient | undefined {
    const upperPos = position.toUpperCase();
    const upperFac = facility.toUpperCase();

    // First try exact facility + position match
    for (const [, client] of this.clients) {
      if (!client.registered) continue;
      if (excludeClientId && client.clientId === excludeClientId) continue;
      if (client.facility?.toUpperCase() !== upperFac) continue;

      if (
        client.position?.toUpperCase() === upperPos ||
        client.assumedPositions.some((p) => p.toUpperCase() === upperPos)
      ) {
        return client;
      }
    }

    // Fall back to position-only match (cross-facility calls, e.g. ARTCC ↔ TRACON)
    for (const [, client] of this.clients) {
      if (!client.registered) continue;
      if (excludeClientId && client.clientId === excludeClientId) continue;

      if (
        client.position?.toUpperCase() === upperPos ||
        client.assumedPositions.some((p) => p.toUpperCase() === upperPos)
      ) {
        return client;
      }
    }

    return undefined;
  }

  private sendTo(ws: WebSocket, pdu: ServerPdu): void {
    try {
      console.log('[Room] Sending:', pdu.type, JSON.stringify(pdu));
      ws.send(JSON.stringify(pdu));
    } catch {
      // Client may have disconnected
    }
  }

  private broadcastRoster(): void {
    const roster: RosterEntry[] = [];
    for (const [, client] of this.clients) {
      if (!client.registered) continue;
      roster.push({
        clientId: client.clientId,
        facility: client.facility!,
        position: client.position!,
        assumedPositions: client.assumedPositions,
      });
    }

    const pdu: ServerPdu = { type: 'ROSTER_UPDATE', roster };
    for (const [, client] of this.clients) {
      if (client.registered) {
        this.sendTo(client.ws, pdu);
      }
    }
  }
}
