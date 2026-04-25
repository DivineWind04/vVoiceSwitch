/**
 * Landline High-Level Client
 *
 * Coordinates the WebSocket signaling client and WebRTC peer manager
 * to provide a simple API for making/receiving G/G calls using the
 * AFV landline PDU protocol with WebRTC audio.
 *
 * Call flow (mirrors the AFV Landline Concept diagram):
 *
 *   Outgoing:
 *     idle → sendCallSetup() → setup → [CALL_ACCEPTED] → accepted
 *       → WebRTC offer/answer → connected → [CALL_END] → ended
 *
 *   Incoming:
 *     idle → [INCOMING_CALL] → ringing → acceptCall() → accepted
 *       → WebRTC offer/answer → connected → [CALL_END] → ended
 */

import { LandlineSignalingClient } from './signaling';
import type { LandlineSignalingEvent } from './signaling';
import { LandlinePeerManager, setMicGain } from './webrtc';
import type {
  FacilityId,
  PositionName,
  ClientId,
  CallId,
  LineType,
  ActiveCall,
  LandlineCallState,
  RosterEntry,
  IncomingCallPdu,
} from './types';
import { LANDLINE_SERVER_URL } from './types';
import { landlineSettingsStore } from './settingsStore';

// ─── Client Events ───────────────────────────────────────────────────────────

export type LandlineClientEvent =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'registered'; clientId: ClientId }
  | { type: 'registrationFailed'; error: string }
  | { type: 'rosterUpdated'; roster: RosterEntry[] }
  | { type: 'callStateChanged'; callId: CallId; state: LandlineCallState }
  | { type: 'callEnded'; callId: CallId }
  | { type: 'callError'; callId: CallId; reason: string }
  | { type: 'error'; error: string };

export type LandlineClientEventHandler = (event: LandlineClientEvent) => void;

// ─── UUID generator ──────────────────────────────────────────────────────────

function generateCallId(): CallId {
  return crypto.randomUUID();
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class LandlineClient {
  private signaling: LandlineSignalingClient;
  private peers: LandlinePeerManager;
  private handlers = new Set<LandlineClientEventHandler>();
  private activeCalls = new Map<CallId, ActiveCall>();
  private roster: RosterEntry[] = [];
  private unsubSignaling: (() => void) | null = null;
  private unsubPtt: (() => void) | null = null;
  private unsubSettings: (() => void) | null = null;

  constructor() {
    this.signaling = new LandlineSignalingClient();
    this.peers = new LandlinePeerManager({
      onOffer: (callId, toClientId, sdp) => {
        this.signaling.sendWebrtcOffer(callId, toClientId, sdp);
      },
      onAnswer: (callId, toClientId, sdp) => {
        this.signaling.sendWebrtcAnswer(callId, toClientId, sdp);
      },
      onIceCandidate: (callId, toClientId, candidate) => {
        this.signaling.sendWebrtcIce(callId, toClientId, candidate);
      },
      onTrack: (callId, _stream) => {
        console.log('[Landline Client] Remote audio track for call:', callId);
        const call = this.activeCalls.get(callId);
        if (call) {
          if (call.shoutPendingPickup) {
            // Shout line: WebRTC connected but receiver hasn't picked up yet.
            // Mute our local tracks (one-way: caller → receiver only).
            // Keep state as 'ringing' so the button shows indication.
            this.peers.muteLocalTracks(callId);
            call.state = 'ringing';
            this.emitEvent({ type: 'callStateChanged', callId, state: 'ringing' });
          } else {
            call.state = 'connected';
            this.emitEvent({ type: 'callStateChanged', callId, state: 'connected' });
            // PTT: For non-override/non-outgoing-shout calls, mute mic unless PTT is held
            // Override (type 0) and outgoing shout (type 2) are always hot mic
            const isHotMic = call.lineType === 0 || (call.lineType === 2 && call.direction === 'outgoing');
            if (!isHotMic && !landlineSettingsStore.isPttPressed()) {
              this.peers.muteLocalTracks(callId);
            }
          }
        }
      },
      onDisconnected: (callId) => {
        console.log('[Landline Client] WebRTC peer disconnected for call:', callId);
        // Peer ICE failure — signal call end
        const call = this.activeCalls.get(callId);
        if (call && call.state === 'connected') {
          this.signaling.sendCallEnd(callId);
          this.cleanupCall(callId);
        }
      },
    });

    // PTT listener: mute/unmute non-override calls based on key state
    this.unsubPtt = landlineSettingsStore.onPttChange((pressed) => {
      this.activeCalls.forEach((call, callId) => {
        // Override (type 0) calls are always hot mic — skip them
        if (call.lineType === 0) return;
        // Outgoing shout (type 2) calls are hot mic — caller pressed button to talk
        if (call.lineType === 2 && call.direction === 'outgoing') return;
        // Shout lines pending pickup are already muted by their own logic
        if (call.shoutPendingPickup) return;
        // Only affect connected calls
        if (call.state !== 'connected') return;

        if (pressed) {
          this.peers.unmuteLocalTracks(callId);
        } else {
          this.peers.muteLocalTracks(callId);
        }
      });
    });

    // Volume change listener
    this.unsubSettings = landlineSettingsStore.onSettingsChange((settings) => {
      this.peers.setVolume(settings.headsetVolume);
      setMicGain(settings.micGain);
    });
  }

  get isConnected(): boolean {
    return this.signaling.isConnected;
  }

  get clientId(): ClientId | null {
    return this.signaling.clientId;
  }

  /** Get info about an active call by ID */
  getCallInfo(callId: CallId): ActiveCall | undefined {
    return this.activeCalls.get(callId);
  }

  get facilityRoster(): RosterEntry[] {
    return this.roster;
  }

  get calls(): ActiveCall[] {
    return Array.from(this.activeCalls.values());
  }

  // ─── Event Emitter ───────────────────────────────────────────────────

  on(handler: LandlineClientEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emitEvent(event: LandlineClientEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('[Landline Client] Event handler error:', err);
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
    this.unsubSignaling = this.signaling.on((event) => this.handleSignalingEvent(event));
    this.signaling.connect(facility, position, assumedPositions, serverUrl);
  }

  disconnect(): void {
    // End all active calls cleanly
    this.activeCalls.forEach((call, callId) => {
      if (call.state !== 'ended') {
        this.signaling.sendCallEnd(callId);
      }
      this.peers.closePeer(callId);
    });
    this.activeCalls.clear();

    this.signaling.disconnect();
    if (this.unsubSignaling) {
      this.unsubSignaling();
      this.unsubSignaling = null;
    }
    if (this.unsubPtt) {
      this.unsubPtt();
      this.unsubPtt = null;
    }
    if (this.unsubSettings) {
      this.unsubSettings();
      this.unsubSettings = null;
    }
  }

  // ─── Call Initiation (CALL_U_SETUP) ──────────────────────────────────

  /**
   * Initiate a G/G call to a position.
   * Sends CALL_U_SETUP to the signaling server, which relays it to the target.
   * Returns the callId for tracking, or null if not connected.
   */
  callPosition(
    targetFacility: FacilityId,
    targetPosition: PositionName,
    lineType: LineType = 2,
  ): CallId | null {
    if (!this.signaling.isConnected) {
      console.error('[Landline Client] Cannot call: not connected');
      return null;
    }

    const callId = generateCallId();

    const call: ActiveCall = {
      callId,
      state: 'setup',
      direction: 'outgoing',
      remoteClientId: null,
      remoteFacility: targetFacility,
      remotePosition: targetPosition,
      lineType,
      displayName: targetPosition,
      createdAt: Date.now(),
    };
    this.activeCalls.set(callId, call);

    this.signaling.sendCallSetup(callId, targetFacility, targetPosition, lineType);
    this.emitEvent({ type: 'callStateChanged', callId, state: 'setup' });

    return callId;
  }

  // ─── Call Accept (CALL_ACCEPTED) ─────────────────────────────────────

  /**
   * Accept an incoming call. Sends CALL_ACCEPTED and begins WebRTC setup.
   * The acceptor creates the WebRTC offer (caller answers).
   *
   * For shout lines (type 2) with shoutPendingPickup, WebRTC connects
   * but our local mic tracks are muted. The call stays in 'ringing'
   * state until the user picks up via pickupShoutCall().
   */
  acceptCall(callId: CallId): void {
    const call = this.activeCalls.get(callId);
    if (!call || call.state !== 'ringing') {
      console.warn('[Landline Client] Cannot accept call:', callId, 'state:', call?.state);
      return;
    }

    call.state = 'accepted';
    this.signaling.sendCallAccepted(callId);
    this.emitEvent({ type: 'callStateChanged', callId, state: 'accepted' });

    // Acceptor creates the WebRTC offer
    if (call.remoteClientId) {
      this.peers.createOffer(callId, call.remoteClientId);
    }
  }

  /**
   * Pick up a shout call that was auto-accepted with one-way audio.
   * Unmutes local mic tracks → full duplex audio.
   */
  pickupShoutCall(callId: CallId): void {
    const call = this.activeCalls.get(callId);
    if (!call || !call.shoutPendingPickup) {
      console.warn('[Landline Client] Cannot pickup shout call:', callId, 'pending:', call?.shoutPendingPickup);
      return;
    }

    console.log('[Landline Client] Shout pickup — enabling full duplex:', callId);
    call.shoutPendingPickup = false;
    call.state = 'connected';
    // After shout pickup, respect PTT: only unmute if PTT is held (shout = type 2, not override)
    if (landlineSettingsStore.isPttPressed()) {
      this.peers.unmuteLocalTracks(callId);
    }
    this.emitEvent({ type: 'callStateChanged', callId, state: 'connected' });
  }

  // ─── Call End (CALL_END) ─────────────────────────────────────────────

  /** End any active call */
  endCall(callId: CallId): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    this.signaling.sendCallEnd(callId);
    this.cleanupCall(callId);
  }

  // ─── Call Hold/Retrieve ──────────────────────────────────────────────

  holdCall(callId: CallId): void {
    const call = this.activeCalls.get(callId);
    if (!call || call.state !== 'connected') return;

    call.state = 'hold';
    this.signaling.sendCallHold(callId);
    this.emitEvent({ type: 'callStateChanged', callId, state: 'hold' });
  }

  retrieveCall(callId: CallId): void {
    const call = this.activeCalls.get(callId);
    if (!call || call.state !== 'hold') return;

    call.state = 'connected';
    this.signaling.sendCallRetrieve(callId);
    this.emitEvent({ type: 'callStateChanged', callId, state: 'connected' });
  }

  // ─── G/G Status Bridge ──────────────────────────────────────────────

  /**
   * Get active calls formatted for the gg_status array.
   * Each call maps to a G/G button with isLandline: true.
   */
  getGgStatusEntries(): any[] {
    const entries: any[] = [];
    this.activeCalls.forEach((call) => {
      entries.push({
        call: `LL_${call.remotePosition}`,
        call_name: call.displayName,
        status: this.mapCallStateToGgStatus(call.state),
        isLandline: true,
        landlineCallId: call.callId,
        landlineDirection: call.direction,
        lineType: call.lineType,
        otherPosition: call.remotePosition,
        targetPosition: call.targetPosition,
      });
    });
    return entries;
  }

  private mapCallStateToGgStatus(state: LandlineCallState): string {
    switch (state) {
      case 'idle':
      case 'ended':
        return 'off';
      case 'setup':
        return 'ringing';    // Outgoing → ringback
      case 'ringing':
        return 'chime';      // Incoming → chime
      case 'accepted':
        return 'ringing';    // WebRTC connecting → still ringing
      case 'connected':
        return 'ok';
      case 'hold':
        return 'hold';
      default:
        return 'off';
    }
  }

  // ─── Internal: Signaling Event Handler ───────────────────────────────

  private handleSignalingEvent(event: LandlineSignalingEvent): void {
    switch (event.type) {
      case 'connected':
        this.emitEvent({ type: 'connected' });
        break;

      case 'disconnected':
        this.activeCalls.clear();
        this.peers.closeAll();
        this.roster = [];
        this.emitEvent({ type: 'disconnected' });
        break;

      case 'registered':
        this.emitEvent({ type: 'registered', clientId: event.clientId });
        break;

      case 'registrationFailed':
        this.emitEvent({ type: 'registrationFailed', error: event.reason });
        break;

      case 'rosterUpdated':
        this.roster = event.roster;
        this.emitEvent({ type: 'rosterUpdated', roster: event.roster });
        break;

      case 'incomingCall':
        this.handleIncomingCall(event.data);
        break;

      case 'callAccepted':
        this.handleCallAccepted(event.data.callId, event.data.acceptedByClientId);
        break;

      case 'callEnded':
        this.cleanupCall(event.data.callId);
        break;

      case 'callHeld':
        this.handleCallHeld(event.data.callId);
        break;

      case 'callRetrieved':
        this.handleCallRetrieved(event.data.callId);
        break;

      case 'callError':
        this.handleCallError(event.data.callId, event.data.reason, event.data.message);
        break;

      case 'webrtcOffer':
        this.handleWebrtcOffer(event.data.callId, event.data.fromClientId, event.data.sdp);
        break;

      case 'webrtcAnswer':
        this.peers.handleAnswer(event.data.callId, event.data.sdp);
        break;

      case 'webrtcIce':
        this.peers.handleIceCandidate(event.data.callId, event.data.candidate);
        break;

      case 'serverError':
        this.emitEvent({ type: 'error', error: event.reason });
        break;
    }
  }

  // ─── Incoming Call Handling ──────────────────────────────────────────

  /**
   * INCOMING_CALL received — a remote user sent us a CALL_U_SETUP.
   * Call begins ringing at our HS/LS. User must press button to accept.
   */
  private handleIncomingCall(data: IncomingCallPdu): void {
    // ─── Shout glare detection ─────────────────────────────────────────
    // When both sides press a shout button simultaneously, two independent
    // calls are created (A→B and B→A).  Resolve by tie-breaking on
    // client ID: lower ID keeps its outgoing call, higher ID yields.
    // The losing side auto-accepts since both users already pressed the button.
    let shoutGlareAutoAccept = false;
    if (data.lineType === 2) {
      const existingOutgoing = Array.from(this.activeCalls.values()).find(
        (c) =>
          c.direction === 'outgoing' &&
          c.remotePosition === data.fromPosition &&
          c.lineType === 2 &&
          c.state !== 'ended',
      );

      if (existingOutgoing) {
        const myId = this.signaling.clientId;
        if (myId && myId < data.fromClientId) {
          // We win — reject the incoming call, keep our outgoing
          console.log('[Landline Client] Shout glare: we win, rejecting incoming:', data.callId);
          this.signaling.sendCallEnd(data.callId);
          return;
        } else {
          // We lose — cancel our outgoing, auto-accept incoming (both sides want to talk)
          console.log('[Landline Client] Shout glare: we lose, canceling outgoing:', existingOutgoing.callId);
          this.signaling.sendCallEnd(existingOutgoing.callId);
          this.cleanupCall(existingOutgoing.callId);
          shoutGlareAutoAccept = true;
        }
      }
    }

    const call: ActiveCall = {
      callId: data.callId,
      state: 'ringing',
      direction: 'incoming',
      remoteClientId: data.fromClientId,
      remoteFacility: data.fromFacility,
      remotePosition: data.fromPosition,
      lineType: data.lineType,
      displayName: data.fromPosition,
      createdAt: Date.now(),
      targetPosition: data.targetPosition,
    };
    this.activeCalls.set(data.callId, call);

    // Override (type 0) always auto-accepts — bypass ring, immediate connect
    // Shout glare (both sides pressed simultaneously) also auto-accepts fully
    if (data.lineType === 0 || shoutGlareAutoAccept) {
      console.log('[Landline Client] Auto-accepting call:', data.callId, shoutGlareAutoAccept ? '(shout glare)' : '(override)');
      this.acceptCall(data.callId);
      return;
    }

    // Shout (type 2): auto-accept WebRTC so receiver hears caller (one-way),
    // but mute our mic until receiver presses the DA button to pick up.
    if (data.lineType === 2) {
      console.log('[Landline Client] Shout call — establishing one-way audio, awaiting pickup:', data.callId);
      call.shoutPendingPickup = true;
      this.acceptCall(data.callId);
      return;
    }

    // Ring (type 1) lines require manual pickup
    this.emitEvent({ type: 'callStateChanged', callId: data.callId, state: 'ringing' });
  }

  /**
   * CALL_ACCEPTED received — the remote party accepted our outgoing call.
   * Now set up WebRTC. The initiator waits for a WebRTC offer from the acceptor.
   */
  private handleCallAccepted(callId: CallId, acceptedByClientId: ClientId): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    call.state = 'accepted';
    call.remoteClientId = acceptedByClientId;
    this.emitEvent({ type: 'callStateChanged', callId, state: 'accepted' });

    // WebRTC: acceptor sends offer, we wait for it via webrtcOffer event
  }

  private handleCallHeld(callId: CallId): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;
    call.state = 'hold';
    this.emitEvent({ type: 'callStateChanged', callId, state: 'hold' });
  }

  private handleCallRetrieved(callId: CallId): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;
    call.state = 'connected';
    this.emitEvent({ type: 'callStateChanged', callId, state: 'connected' });
  }

  private handleCallError(callId: CallId, reason: string, message?: string): void {
    console.error('[Landline Client] Call error:', callId, reason, message);
    this.emitEvent({ type: 'callError', callId, reason });
    this.cleanupCall(callId);
  }

  private handleWebrtcOffer(callId: CallId, fromClientId: ClientId, sdp: string): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;
    this.peers.handleOffer(callId, fromClientId, sdp);
  }

  private cleanupCall(callId: CallId): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    call.state = 'ended';
    this.peers.closePeer(callId);
    this.activeCalls.delete(callId);
    this.emitEvent({ type: 'callEnded', callId });
  }

  /** Destroy all resources */
  destroy(): void {
    this.disconnect();
    this.peers.destroy();
    this.handlers.clear();
  }
}
