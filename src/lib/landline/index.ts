/**
 * Landline WebRTC Integration
 *
 * WebRTC-based G/G voice communication using AFV landline PDU semantics.
 * Runs in parallel with AFV, VACS, and v-VSCS as a fourth transport.
 *
 * Architecture:
 *   LandlineClient (high-level API)
 *     ├── LandlineSignalingClient (WebSocket to signaling server)
 *     └── LandlinePeerManager
 *           └── RTCPeerConnection × N (one per active call)
 *
 * PDU Protocol (mirrors AFV Landline Concept):
 *   CALL_U_SETUP → CALL_ACCEPTED → TX/RX (WebRTC audio) → CALL_END
 *   CALL_HOLD / CALL_RETRIEVE for hold functionality
 *
 * Position JSON format:
 *   ["ll:ZOA:R62", 2, "NORCAL,CTR"]                  → Regular G/G to ZOA position R62
 *   ["ll:ZOA:R62", 0, "R62,OVR"]                      → Override line (auto-accept)
 *   ["ll:ZOA:R62", 1, "R62,RING"]                     → Ring line
 *   ["ll:ZLA:33_CTR", 2, "ZLA,HIGH"]                  → Cross-facility G/G to ZLA
 *   ["ll:NCT:A,NCT:B,NCT:C", 2, "S-BAY,CMB"]         → Shout to multiple positions (fan-out)
 *   ["ll:dial", 3, "E/W/V,,DIAL,993"]                 → Dial/trunk line (opens keypad)
 */

export { LandlineClient } from './client';
export type { LandlineClientEvent, LandlineClientEventHandler } from './client';

export { LandlineSignalingClient } from './signaling';
export type { LandlineSignalingEvent, LandlineSignalingEventHandler } from './signaling';

export { LandlinePeerManager } from './webrtc';

export { landlineStore, INITIAL_LANDLINE_STATE } from './store';
export type { LandlineStoreState, LandlineConfiguredLine, LandlineTarget } from './store';

export type {
  FacilityId,
  PositionName,
  ClientId,
  CallId,
  LineId,
  LineType,
  LandlineCallState,
  LandlineDialCodeTable,
  ActiveCall,
  RosterEntry,
} from './types';
export { LANDLINE_SERVER_URL, LANDLINE_ICE_SERVERS, resolveLandlineDialCode } from './types';
