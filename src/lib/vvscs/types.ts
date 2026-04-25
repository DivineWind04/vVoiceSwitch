/**
 * v-VSCS (Virtual VSCS) Protocol Types
 *
 * TypeScript types for the v-VSCS Socket.IO signaling protocol
 * reverse-engineered from the v-VSCS Electron app.
 *
 * Server: wss://ws.atlcru.art (Socket.IO v3+)
 * Auth: none (open connection, register with facility+position)
 */

// ─── Configuration ───────────────────────────────────────────────────────────

export const VVSCS_SERVER_URL = 'https://ws.atlcru.art';

export const VVSCS_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ─── Identity Types ──────────────────────────────────────────────────────────

/** Facility identifier, e.g. "ZOA" */
export type FacilityId = string;

/** Position name within a facility, e.g. "R62", "Norcal 5" */
export type PositionName = string;

/** Socket.IO socket ID (server-assigned) */
export type SocketId = string;

/** Unique line identifier for overrides/shouts */
export type LineId = string;

// ─── Roster ──────────────────────────────────────────────────────────────────

export interface RosterEntry {
  position: PositionName;
  socketId: SocketId;
  /** Other properties the server may include */
  [key: string]: any;
}

// ─── Client → Server Events ─────────────────────────────────────────────────

export interface RegisterPayload {
  facility: FacilityId;
  position: PositionName;
  assumedPositions: PositionName[];
}

export interface OpenOverridePayload {
  to: PositionName;
}

export interface CloseOverridePayload {
  lineId: LineId;
}

export interface ActivateShoutPayload {
  line: string;
  remoteFacility: FacilityId;
}

export interface JoinShoutPayload {
  lineId: LineId;
}

export interface LeaveShoutPayload {
  lineId: LineId;
}

export interface WebrtcOfferPayload {
  to: SocketId;
  offer: RTCSessionDescriptionInit;
  lineId: LineId;
  isParticipant: boolean;
}

export interface WebrtcAnswerPayload {
  to: SocketId;
  answer: RTCSessionDescriptionInit;
}

export interface WebrtcIcePayload {
  to: SocketId;
  candidate: RTCIceCandidateInit;
}

export interface CloudAuthLoginPayload {
  username: string;
  password: string;
}

// ─── Server → Client Events ─────────────────────────────────────────────────

export interface RegisteredResponse {
  success: boolean;
  socketId?: SocketId;
  error?: string;
}

export interface OverrideActiveEvent {
  lineId: LineId;
  positions: PositionName[];
  initiator: PositionName;
  initiatorSocketId?: SocketId;
}

export interface OverrideClosedEvent {
  lineId: LineId;
}

export interface ShoutActiveEvent {
  lineId: LineId;
  line: string;
  facilities: FacilityId[];
  initiatorSocketId: SocketId;
  mode: 'headset' | 'speaker';
}

export interface ShoutUpdatedEvent {
  lineId: LineId;
  participantSocketIds: SocketId[];
  [key: string]: any;
}

export interface ShoutClosedEvent {
  lineId: LineId;
}

export interface WebrtcOfferEvent {
  from: SocketId;
  offer: RTCSessionDescriptionInit;
  lineId?: LineId;
  isParticipant?: boolean;
}

export interface WebrtcAnswerEvent {
  from: SocketId;
  answer: RTCSessionDescriptionInit;
}

export interface WebrtcIceEvent {
  from: SocketId;
  candidate: RTCIceCandidateInit;
}

export interface WebrtcErrorEvent {
  error: string;
  targetSocketId: SocketId;
}

export interface WebrtcPeerDisconnectedEvent {
  disconnectedSocketId: SocketId;
}

// ─── Active Line State ───────────────────────────────────────────────────────

export type LineType = 'override' | 'shout';

export interface ActiveOverrideLine {
  lineId: LineId;
  type: 'override';
  positions: PositionName[];
  initiatedByMe: boolean;
}

export interface ActiveShoutLine {
  lineId: LineId;
  type: 'shout';
  mode: 'headset' | 'speaker';
  participantSocketIds: SocketId[];
  participants: PositionName[];
}

export type ActiveLine = ActiveOverrideLine | ActiveShoutLine;

// ─── Peer Connection State ──────────────────────────────────────────────────

export interface VvscsPeerState {
  lineId: LineId;
  remoteSocketId: SocketId;
  peerConnection: RTCPeerConnection;
  audioElements: Record<string, HTMLAudioElement>;
  state: 'initiating' | 'connecting' | 'connected' | 'failed';
  isParticipant: boolean;
  createdAt: number;
  stream?: MediaStream;
}

// ─── Call Representation (for G/G button mapping) ────────────────────────────

export type VvscsCallState = 'idle' | 'initiating' | 'ringing' | 'active' | 'closing';

export interface VvscsCall {
  lineId: LineId;
  lineType: LineType;
  state: VvscsCallState;
  /** The remote position(s) this call connects to */
  remotePositions: PositionName[];
  /** Display name for G/G button */
  displayName: string;
  /** Whether we initiated the call */
  initiatedByMe: boolean;
  /** Remote socket IDs with active peer connections */
  peerSocketIds: SocketId[];
}
