/**
 * v-VSCS (Virtual VSCS) Integration
 *
 * Provides WebRTC-based G/G voice communication using the v-VSCS Socket.IO
 * signaling server at ws.atlcru.art. This is a third transport alongside
 * AFV (primary) and VACS.
 *
 * Architecture:
 *   VvscsClient (high-level API)
 *     ├── VvscsSignalingClient (Socket.IO to wss://ws.atlcru.art)
 *     └── VvscsPeerManager
 *           └── RTCPeerConnection × N (one per remote peer)
 *
 * No auth required — connection is open, registration by facility + position.
 *
 * Call types:
 *   - Override: 1:1 call to a specific position within the facility
 *   - Shout: Multi-party call across facilities
 *
 * Position JSON format:
 *   ["vvscs:R62", 2, "NORCAL,CTR"]           → Override to position R62
 *   ["vvscs:shout:SHOUT1:ZLA", 2, "ZLA,HIGH"] → Shout to ZLA
 */

export { VvscsClient } from './client';
export type { VvscsClientEvent, VvscsClientEventHandler } from './client';

export { VvscsSignalingClient } from './signaling';
export type { VvscsSignalingEvent, VvscsSignalingEventHandler } from './signaling';

export { VvscsPeerManager } from './webrtc';

export { vvscsStore, INITIAL_VVSCS_STATE } from './store';
export type { VvscsStoreState, VvscsConfiguredLine } from './store';

export type {
  FacilityId,
  PositionName,
  SocketId,
  LineId,
  RosterEntry,
  ActiveLine,
  VvscsCall,
  VvscsCallState,
} from './types';
export { VVSCS_SERVER_URL, VVSCS_ICE_SERVERS } from './types';
