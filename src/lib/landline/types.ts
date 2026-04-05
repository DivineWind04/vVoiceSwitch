/**
 * Landline WebRTC Protocol Types
 *
 * PDU-based signaling protocol that mirrors the AFV Landline Concept.
 * Call flow: CALL_U_SETUP → CALL_ACCEPTED → TX/RX (WebRTC) → CALL_END
 *
 * This runs in parallel with AFV, using the same calling semantics
 * but routing audio over WebRTC instead of AFV packets.
 *
 * Signaling: WebSocket to a landline signaling server
 * Media: WebRTC peer-to-peer audio
 */

// ─── Configuration ───────────────────────────────────────────────────────────

/**
 * Default signaling server URL — override via connect().
 * Local dev: ws://localhost:8787/ws  (wrangler dev)
 * Production: wss://landline-signaling.domynguyen-4.workers.dev/ws
 */
export const LANDLINE_SERVER_URL = 'wss://landline-signaling.domynguyen-4.workers.dev/ws';

export const LANDLINE_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ─── Identity Types ──────────────────────────────────────────────────────────

/** Facility identifier, e.g. "ZOA" */
export type FacilityId = string;

/** Position name within a facility, e.g. "R62", "Norcal_5_CTR" */
export type PositionName = string;

/** Server-assigned client ID */
export type ClientId = string;

/** Unique call identifier (UUID) */
export type CallId = string;

/** Line identifier from position config */
export type LineId = string;

// ─── Call Types ──────────────────────────────────────────────────────────────

/**
 * Line type codes — matches AFV CRC convention:
 *   0 = override (bypass ring, immediate connect)
 *   1 = ring (intercom ring to destination)
 *   2 = regular G/G
 *   3 = dial/trunk (opens keypad, resolves via dial code table)
 */
export type LineType = 0 | 1 | 2 | 3;

/** Call state from the point of view of one side */
export type LandlineCallState =
  | 'idle'       // No active call
  | 'setup'      // CALL_U_SETUP sent, waiting for remote
  | 'ringing'    // CALL_U_SETUP received by remote, ringing at their HS/LS
  | 'accepted'   // CALL_ACCEPTED received, setting up WebRTC
  | 'connected'  // WebRTC audio flowing both ways
  | 'hold'       // Call held by one party
  | 'ended';     // CALL_END received, cleanup

// ─── Dial Code Table ─────────────────────────────────────────────────────────

/**
 * Landline dial code table for type 3 (trunk/dial) lines.
 * Maps trunk name → { dialCode → "FACILITY:POSITION" target }
 *
 * Example:
 *   {
 *     "E/W/V": { "02": "ZOA:R62",  "03": "ZOA:R63" },
 *     "S-BAY": { "34": "ZOA:NCT_B", "40": "ZOA:NCT_D" }
 *   }
 *
 * Stored in position JSON under facility.llDialCodeTable
 */
export type LandlineDialCodeTable = Record<string, Record<string, string>>;

/**
 * Resolve a dial code to a landline target ("FACILITY:POSITION").
 * Returns null if no match.
 */
export function resolveLandlineDialCode(
  table: LandlineDialCodeTable | null,
  trunkName: string,
  dialCode: string,
): { facility: FacilityId; position: PositionName } | null {
  if (!table) return null;
  const trunkCodes = table[trunkName];
  if (!trunkCodes) return null;
  const target = trunkCodes[dialCode];
  if (!target) return null;
  const sepIdx = target.indexOf(':');
  if (sepIdx === -1) return null;
  return {
    facility: target.substring(0, sepIdx),
    position: target.substring(sepIdx + 1),
  };
}

// ─── Roster ──────────────────────────────────────────────────────────────────

export interface RosterEntry {
  clientId: ClientId;
  facility: FacilityId;
  position: PositionName;
  /** Additional positions this client is working */
  assumedPositions: PositionName[];
}

// ─── PDU Messages (Client → Server) ─────────────────────────────────────────

export interface RegisterPdu {
  type: 'REGISTER';
  facility: FacilityId;
  position: PositionName;
  assumedPositions: PositionName[];
}

/**
 * CALL_U_SETUP — User initiates a G/G call.
 * Maps to: User presses DA button → sends setup to recipient.
 */
export interface CallUSetupPdu {
  type: 'CALL_U_SETUP';
  callId: CallId;
  targetFacility: FacilityId;
  targetPosition: PositionName;
  lineType: LineType;
}

/**
 * CALL_ACCEPTED — Recipient accepts the incoming call.
 * Both parties transition to TX/RX on ground channel.
 */
export interface CallAcceptedPdu {
  type: 'CALL_ACCEPTED';
  callId: CallId;
}

/**
 * CALL_END — Either party terminates the call.
 */
export interface CallEndPdu {
  type: 'CALL_END';
  callId: CallId;
}

/**
 * CALL_HOLD — Put the call on hold.
 */
export interface CallHoldPdu {
  type: 'CALL_HOLD';
  callId: CallId;
}

/**
 * CALL_RETRIEVE — Retrieve from hold.
 */
export interface CallRetrievePdu {
  type: 'CALL_RETRIEVE';
  callId: CallId;
}

/** WebRTC offer, answer, ICE candidate relay */
export interface WebrtcOfferPdu {
  type: 'WEBRTC_OFFER';
  callId: CallId;
  toClientId: ClientId;
  sdp: string;
}

export interface WebrtcAnswerPdu {
  type: 'WEBRTC_ANSWER';
  callId: CallId;
  toClientId: ClientId;
  sdp: string;
}

export interface WebrtcIcePdu {
  type: 'WEBRTC_ICE';
  callId: CallId;
  toClientId: ClientId;
  candidate: string; // JSON-encoded RTCIceCandidateInit
}

export type ClientPdu =
  | RegisterPdu
  | CallUSetupPdu
  | CallAcceptedPdu
  | CallEndPdu
  | CallHoldPdu
  | CallRetrievePdu
  | WebrtcOfferPdu
  | WebrtcAnswerPdu
  | WebrtcIcePdu;

// ─── PDU Messages (Server → Client) ─────────────────────────────────────────

export interface RegisteredPdu {
  type: 'REGISTERED';
  clientId: ClientId;
}

export interface RegisterFailedPdu {
  type: 'REGISTER_FAILED';
  reason: string;
}

export interface RosterUpdatePdu {
  type: 'ROSTER_UPDATE';
  roster: RosterEntry[];
}

/**
 * Server relays CALL_U_SETUP to recipient.
 * Includes caller info so recipient can display who's calling.
 */
export interface IncomingCallPdu {
  type: 'INCOMING_CALL';
  callId: CallId;
  fromClientId: ClientId;
  fromFacility: FacilityId;
  fromPosition: PositionName;
  lineType: LineType;
  /** Which position was targeted (useful when receiving via assumedPositions) */
  targetPosition?: PositionName;
}

/** Server relays CALL_ACCEPTED back to initiator */
export interface CallAcceptedRelayPdu {
  type: 'CALL_ACCEPTED';
  callId: CallId;
  acceptedByClientId: ClientId;
}

/** Server relays CALL_END to the other party */
export interface CallEndRelayPdu {
  type: 'CALL_END';
  callId: CallId;
  endedByClientId: ClientId;
}

/** Server relays CALL_HOLD */
export interface CallHoldRelayPdu {
  type: 'CALL_HOLD';
  callId: CallId;
  heldByClientId: ClientId;
}

/** Server relays CALL_RETRIEVE */
export interface CallRetrieveRelayPdu {
  type: 'CALL_RETRIEVE';
  callId: CallId;
  retrievedByClientId: ClientId;
}

/** Call failed (target not found, busy, etc.) */
export interface CallErrorPdu {
  type: 'CALL_ERROR';
  callId: CallId;
  reason: 'not_found' | 'busy' | 'rejected' | 'timeout' | 'error';
  message?: string;
}

/** WebRTC relay messages from server */
export interface WebrtcOfferRelayPdu {
  type: 'WEBRTC_OFFER';
  callId: CallId;
  fromClientId: ClientId;
  sdp: string;
}

export interface WebrtcAnswerRelayPdu {
  type: 'WEBRTC_ANSWER';
  callId: CallId;
  fromClientId: ClientId;
  sdp: string;
}

export interface WebrtcIceRelayPdu {
  type: 'WEBRTC_ICE';
  callId: CallId;
  fromClientId: ClientId;
  candidate: string;
}

export interface ServerErrorPdu {
  type: 'ERROR';
  reason: string;
}

export type ServerPdu =
  | RegisteredPdu
  | RegisterFailedPdu
  | RosterUpdatePdu
  | IncomingCallPdu
  | CallAcceptedRelayPdu
  | CallEndRelayPdu
  | CallHoldRelayPdu
  | CallRetrieveRelayPdu
  | CallErrorPdu
  | WebrtcOfferRelayPdu
  | WebrtcAnswerRelayPdu
  | WebrtcIceRelayPdu
  | ServerErrorPdu;

// ─── Active Call Tracking ────────────────────────────────────────────────────

export interface ActiveCall {
  callId: CallId;
  state: LandlineCallState;
  /** Who initiated the call */
  direction: 'outgoing' | 'incoming';
  /** Remote party info */
  remoteClientId: ClientId | null;
  remoteFacility: FacilityId;
  remotePosition: PositionName;
  /** Line type for this call */
  lineType: LineType;
  /** Display name resolved from config */
  displayName: string;
  /** When the call was created */
  createdAt: number;
  /**
   * Shout (type 2) incoming: WebRTC is connected (receiver hears caller)
   * but receiver's mic is muted until they press the DA button to pick up.
   */
  shoutPendingPickup?: boolean;
  /**
   * For incoming calls: which of our positions was targeted.
   * Set when the call arrives via an assumed position, so the UI
   * can match the call to the correct configured button.
   */
  targetPosition?: PositionName;
}
