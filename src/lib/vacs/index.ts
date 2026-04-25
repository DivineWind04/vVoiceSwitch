/**
 * VACS (VATSIM ATC Communication System) Integration
 *
 * Provides WebRTC-based G/G voice communication using the VACS signaling server.
 * This is the secondary transport alongside the existing AFV WebSocket backend.
 *
 * Architecture:
 *   VacsClient (high-level API)
 *     ├── VacsSignalingClient (WebSocket to wss://vacs.network/ws)
 *     └── VacsPeerManager
 *           └── VacsPeerConnection × N (one per active call, browser WebRTC)
 *
 * Auth flow:
 *   1. /api/vacs/auth/login → get VATSIM Connect OAuth2 URL
 *   2. User authenticates with VATSIM
 *   3. /api/vacs/auth/callback → exchange code for session
 *   4. /api/vacs/token → get WebSocket token
 *   5. VacsClient.connect(token, positionId)
 */

export { VacsClient } from './client';
export type { VacsClientEvent, VacsClientEventHandler } from './client';

export { VacsSignalingClient } from './signaling';
export type { SignalingState, SignalingEvent, SignalingEventHandler } from './signaling';

export { VacsPeerConnection, VacsPeerManager } from './webrtc';
export type { PeerEvent, PeerEventHandler } from './webrtc';

export { vacsStore } from './store';
export type { VacsStoreState } from './store';
export { INITIAL_VACS_STATE } from './store';

export type {
  // Primitive IDs
  ClientId,
  PositionId,
  StationId,
  CallId,
  // Shared types
  CallSource,
  CallTarget,
  CallInvite,
  CallAccept,
  CallEnd,
  CallError,
  CallReject,
  // WebRTC signaling
  WebrtcOffer,
  WebrtcAnswer,
  WebrtcIceCandidate,
  // HTTP
  IceServer,
  IceConfig,
  // Client state
  VacsCall,
  VacsCallState,
  VacsConfig,
  ClientInfo,
  StationInfo,
  ServerMessage,
  ClientMessage,
} from './types';

export {
  VACS_PROTOCOL_VERSION,
  VACS_DEV_CONFIG,
  VACS_PROD_CONFIG,
} from './types';
