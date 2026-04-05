/**
 * PDU type definitions shared between client and server.
 * Mirrors src/lib/landline/types.ts — kept minimal for the server side.
 */

export type ClientId = string;
export type CallId = string;
export type FacilityId = string;
export type PositionName = string;
export type LineType = 0 | 1 | 2 | 3;

// ─── Client → Server PDUs ────────────────────────────────────────────────────

export interface RegisterPdu {
  type: 'REGISTER';
  facility: FacilityId;
  position: PositionName;
  assumedPositions: PositionName[];
}

export interface CallUSetupPdu {
  type: 'CALL_U_SETUP';
  callId: CallId;
  targetFacility: FacilityId;
  targetPosition: PositionName;
  lineType: LineType;
}

export interface CallAcceptedPdu {
  type: 'CALL_ACCEPTED';
  callId: CallId;
}

export interface CallEndPdu {
  type: 'CALL_END';
  callId: CallId;
}

export interface CallHoldPdu {
  type: 'CALL_HOLD';
  callId: CallId;
}

export interface CallRetrievePdu {
  type: 'CALL_RETRIEVE';
  callId: CallId;
}

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
  candidate: string;
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

// ─── Server → Client PDUs ────────────────────────────────────────────────────

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

export interface CallAcceptedRelayPdu {
  type: 'CALL_ACCEPTED';
  callId: CallId;
  acceptedByClientId: ClientId;
}

export interface CallEndRelayPdu {
  type: 'CALL_END';
  callId: CallId;
  endedByClientId: ClientId;
}

export interface CallHoldRelayPdu {
  type: 'CALL_HOLD';
  callId: CallId;
  heldByClientId: ClientId;
}

export interface CallRetrieveRelayPdu {
  type: 'CALL_RETRIEVE';
  callId: CallId;
  retrievedByClientId: ClientId;
}

export interface CallErrorPdu {
  type: 'CALL_ERROR';
  callId: CallId;
  reason: 'not_found' | 'busy' | 'rejected' | 'timeout' | 'error';
  message?: string;
}

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

// ─── Roster ──────────────────────────────────────────────────────────────────

export interface RosterEntry {
  clientId: ClientId;
  facility: FacilityId;
  position: PositionName;
  assumedPositions: PositionName[];
}

// ─── Active Call (server-side tracking) ──────────────────────────────────────

export interface ActiveCall {
  callId: CallId;
  initiatorClientId: ClientId;
  targetClientId: ClientId | null;
  targetFacility: FacilityId;
  targetPosition: PositionName;
  lineType: LineType;
  state: 'setup' | 'ringing' | 'accepted' | 'connected' | 'hold' | 'ended';
  createdAt: number;
}
