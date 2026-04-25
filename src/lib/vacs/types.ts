/**
 * VACS (VATSIM ATC Communication System) Protocol Types
 *
 * TypeScript port of the vacs-protocol crate (v2.0.0).
 * All message types use camelCase and are tagged by a "type" discriminator,
 * matching serde(rename_all = "camelCase", tag = "type").
 *
 * Reference: https://github.com/vacs-project/vacs/tree/main/vacs-protocol
 */

export const VACS_PROTOCOL_VERSION = '2.0.0';

// ─── Primitive IDs ───────────────────────────────────────────────────────────

/** VATSIM CID (string form) */
export type ClientId = string;

/** VATSIM position identifier, e.g. "ZOA_33_CTR" – always uppercased */
export type PositionId = string;

/** Station identifier, e.g. "KSFO_TWR" – always uppercased */
export type StationId = string;

/** UUIDv7 call identifier */
export type CallId = string;

// ─── Shared Types ────────────────────────────────────────────────────────────

export interface CallSource {
  clientId: ClientId;
  positionId?: PositionId;
  stationId?: StationId;
}

export type CallTarget =
  | { client: ClientId }
  | { position: PositionId }
  | { station: StationId };

export type CallErrorReason =
  | 'targetNotFound'
  | 'callActive'
  | 'webrtcFailure'
  | 'audioFailure'
  | 'callFailure'
  | 'signalingFailure'
  | 'autoHangup'
  | 'other';

export interface CallInvite {
  callId: CallId;
  source: CallSource;
  target: CallTarget;
  prio: boolean;
}

export interface CallAccept {
  callId: CallId;
  acceptingClientId: ClientId;
}

export interface CallEnd {
  callId: CallId;
  endingClientId: ClientId;
}

export interface CallError {
  callId: CallId;
  reason: CallErrorReason;
  message?: string;
}

export type CallRejectReason = 'busy';

export interface CallReject {
  callId: CallId;
  rejectingClientId: ClientId;
  reason: CallRejectReason;
}

// ─── WebRTC Signaling ────────────────────────────────────────────────────────

export interface WebrtcOffer {
  callId: CallId;
  fromClientId: ClientId;
  toClientId: ClientId;
  sdp: string;
}

export interface WebrtcAnswer {
  callId: CallId;
  fromClientId: ClientId;
  toClientId: ClientId;
  sdp: string;
}

export interface WebrtcIceCandidate {
  callId: CallId;
  fromClientId: ClientId;
  toClientId: ClientId;
  candidate: string;
}

// ─── Error Types ─────────────────────────────────────────────────────────────

export type ErrorReason =
  | { malformedMessage: true }
  | { internal: string }
  | { peerConnection: true }
  | { unexpectedMessage: string }
  | { rateLimited: { retryAfterSecs: number } }
  | { clientNotFound: true };

export interface VacsError {
  reason: ErrorReason;
  clientId?: ClientId;
  callId?: CallId;
}

// ─── Client → Server Messages ────────────────────────────────────────────────

export interface LoginMessage {
  type: 'login';
  token: string;
  protocolVersion: string;
  customProfile: boolean;
  positionId?: PositionId;
}

export interface LogoutMessage {
  type: 'logout';
}

export interface CallInviteClientMessage {
  type: 'callInvite';
  callId: CallId;
  source: CallSource;
  target: CallTarget;
  prio: boolean;
}

export interface CallAcceptClientMessage {
  type: 'callAccept';
  callId: CallId;
  acceptingClientId: ClientId;
}

export interface CallEndClientMessage {
  type: 'callEnd';
  callId: CallId;
  endingClientId: ClientId;
}

export interface CallRejectClientMessage {
  type: 'callReject';
  callId: CallId;
  rejectingClientId: ClientId;
  reason: CallRejectReason;
}

export interface CallErrorClientMessage {
  type: 'callError';
  callId: CallId;
  reason: CallErrorReason;
  message?: string;
}

export interface WebrtcOfferClientMessage {
  type: 'webrtcOffer';
  callId: CallId;
  fromClientId: ClientId;
  toClientId: ClientId;
  sdp: string;
}

export interface WebrtcAnswerClientMessage {
  type: 'webrtcAnswer';
  callId: CallId;
  fromClientId: ClientId;
  toClientId: ClientId;
  sdp: string;
}

export interface WebrtcIceCandidateClientMessage {
  type: 'webrtcIceCandidate';
  callId: CallId;
  fromClientId: ClientId;
  toClientId: ClientId;
  candidate: string;
}

export interface ListClientsMessage {
  type: 'listClients';
}

export interface ListStationsMessage {
  type: 'listStations';
}

export interface DisconnectMessage {
  type: 'disconnect';
}

export interface ErrorClientMessage {
  type: 'error';
  reason: ErrorReason;
  clientId?: ClientId;
  callId?: CallId;
}

export type ClientMessage =
  | LoginMessage
  | LogoutMessage
  | CallInviteClientMessage
  | CallAcceptClientMessage
  | CallEndClientMessage
  | CallRejectClientMessage
  | CallErrorClientMessage
  | WebrtcOfferClientMessage
  | WebrtcAnswerClientMessage
  | WebrtcIceCandidateClientMessage
  | ListClientsMessage
  | ListStationsMessage
  | DisconnectMessage
  | ErrorClientMessage;

// ─── Server → Client Messages ────────────────────────────────────────────────

export type LoginFailureReason =
  | 'unauthorized'
  | 'duplicateId'
  | 'invalidCredentials'
  | 'noActiveVatsimConnection'
  | { ambiguousVatsimPosition: PositionId[] }
  | 'invalidVatsimPosition'
  | 'timeout'
  | 'incompatibleProtocolVersion';

export interface LoginFailureMessage {
  type: 'loginFailure';
  reason: LoginFailureReason;
}

export interface ClientInfo {
  id: ClientId;
  displayName: string;
  frequency: string;
  positionId?: PositionId;
}

export interface SessionInfoMessage {
  type: 'sessionInfo';
  client: ClientInfo;
  profile: { type: 'unchanged' } | { type: 'changed'; activeProfile: unknown };
}

export interface ClientConnectedMessage {
  type: 'clientConnected';
  client: ClientInfo;
}

export interface ClientDisconnectedMessage {
  type: 'clientDisconnected';
  clientId: ClientId;
}

export interface ClientListMessage {
  type: 'clientList';
  clients: ClientInfo[];
}

export interface StationInfo {
  id: StationId;
  own: boolean;
}

export interface StationListMessage {
  type: 'stationList';
  stations: StationInfo[];
}

export type StationChange =
  | { type: 'online'; stationId: StationId; positionId: PositionId }
  | { type: 'handoff'; stationId: StationId; fromPositionId: PositionId; toPositionId: PositionId }
  | { type: 'offline'; stationId: StationId };

export interface StationChangesMessage {
  type: 'stationChanges';
  changes: StationChange[];
}

export type CallCancelReason =
  | { answeredElsewhere: ClientId }
  | 'callerCancelled'
  | 'disconnected'
  | { errored: CallErrorReason }
  | { rejected: CallRejectReason };

export interface CallCancelledMessage {
  type: 'callCancelled';
  callId: CallId;
  reason: CallCancelReason;
}

export type DisconnectReason =
  | 'terminated'
  | 'noActiveVatsimConnection'
  | { ambiguousVatsimPosition: PositionId[] };

export interface DisconnectedMessage {
  type: 'disconnected';
  reason: DisconnectReason;
}

export interface CallInviteServerMessage {
  type: 'callInvite';
  callId: CallId;
  source: CallSource;
  target: CallTarget;
  prio: boolean;
}

export interface CallAcceptServerMessage {
  type: 'callAccept';
  callId: CallId;
  acceptingClientId: ClientId;
}

export interface CallEndServerMessage {
  type: 'callEnd';
  callId: CallId;
  endingClientId: ClientId;
}

export interface CallErrorServerMessage {
  type: 'callError';
  callId: CallId;
  reason: CallErrorReason;
  message?: string;
}

export interface WebrtcOfferServerMessage {
  type: 'webrtcOffer';
  callId: CallId;
  fromClientId: ClientId;
  toClientId: ClientId;
  sdp: string;
}

export interface WebrtcAnswerServerMessage {
  type: 'webrtcAnswer';
  callId: CallId;
  fromClientId: ClientId;
  toClientId: ClientId;
  sdp: string;
}

export interface WebrtcIceCandidateServerMessage {
  type: 'webrtcIceCandidate';
  callId: CallId;
  fromClientId: ClientId;
  toClientId: ClientId;
  candidate: string;
}

export interface ClientInfoServerMessage {
  type: 'clientInfo';
  id: ClientId;
  displayName: string;
  frequency: string;
  positionId?: PositionId;
}

export interface ErrorServerMessage {
  type: 'error';
  reason: ErrorReason;
  clientId?: ClientId;
  callId?: CallId;
}

export type ServerMessage =
  | LoginFailureMessage
  | SessionInfoMessage
  | ClientConnectedMessage
  | ClientDisconnectedMessage
  | ClientListMessage
  | StationListMessage
  | StationChangesMessage
  | CallInviteServerMessage
  | CallAcceptServerMessage
  | CallEndServerMessage
  | CallCancelledMessage
  | CallErrorServerMessage
  | WebrtcOfferServerMessage
  | WebrtcAnswerServerMessage
  | WebrtcIceCandidateServerMessage
  | ClientInfoServerMessage
  | DisconnectedMessage
  | ErrorServerMessage;

// ─── HTTP Types ──────────────────────────────────────────────────────────────

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface IceConfig {
  iceServers: IceServer[];
  expiresAt?: number;
}

export interface InitVatsimLogin {
  url: string;
}

export interface AuthExchangeToken {
  code: string;
  state: string;
}

export interface WebSocketToken {
  token: string;
}

// ─── Call State (for our UI) ─────────────────────────────────────────────────

export type VacsCallState =
  | 'idle'        // No call activity
  | 'inviting'    // Outgoing call invite sent, waiting for accept
  | 'ringing'     // Incoming call invite received
  | 'accepting'   // CallAccept sent, awaiting WebRTC setup
  | 'connecting'  // WebRTC negotiation in progress
  | 'connected'   // Call established, audio flowing
  | 'ended'       // Call ended
  | 'error';      // Call failed

export interface VacsCall {
  callId: CallId;
  remoteClientId: ClientId;
  remoteDisplayName: string;
  remotePositionId?: PositionId;
  remoteStationId?: StationId;
  direction: 'incoming' | 'outgoing';
  prio: boolean;
  state: VacsCallState;
  startedAt: number;
  peerConnection?: RTCPeerConnection;
  remoteStream?: MediaStream;
}

// ─── VACS Connection Config ──────────────────────────────────────────────────

export interface VacsConfig {
  /** Signaling WebSocket URL (default: wss://dev.vacs.network/ws) */
  signalingUrl: string;
  /** HTTP base URL for auth/ICE (default: https://dev.vacs.network) */
  httpBaseUrl: string;
  /** Whether to use the dev (sandbox) environment */
  useDev: boolean;
}

export const VACS_DEV_CONFIG: VacsConfig = {
  signalingUrl: 'wss://dev.vacs.network/ws',
  httpBaseUrl: 'https://dev.vacs.network',
  useDev: true,
};

export const VACS_PROD_CONFIG: VacsConfig = {
  signalingUrl: 'wss://vacs.network/ws',
  httpBaseUrl: 'https://vacs.network',
  useDev: false,
};
