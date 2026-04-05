/**
 * vNAS Types
 *
 * Type definitions for the vNAS (vATIS Network Automation System) integration.
 * Used for sweatbox/training mode: auto-detect position from vNAS session
 * using SignalR hub, and route calls over landline (since AFV doesn't work in sweatbox).
 */

// ─── Configuration ───────────────────────────────────────────────────────────

/** vNAS config URL — fetches available environments (live + sweatbox) */
export const VNAS_CONFIG_URL = 'https://data-api.vnas.vatsim.net/api/config';

/** VATSIM OAuth endpoints */
export const VATSIM_AUTH_URL = 'https://auth.vatsim.net/oauth/authorize';

// ─── Environment ─────────────────────────────────────────────────────────────

/** A vNAS server environment (live or sweatbox) */
export interface VnasEnvironment {
  name: string;
  apiBaseUrl: string;
  clientHubUrl: string;
  isSweatbox: boolean;
  isPrimary?: boolean;
  isDisabled?: boolean;
}

/** Top-level vNAS configuration response */
export interface VnasConfig {
  artccBoundariesUrl: string;
  artccAoisUrl: string;
  environments: VnasEnvironment[];
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/** Response from vNAS login (code exchange) */
export interface VnasLoginResponse {
  nasToken: string;
  vatsimToken: string;
}

// ─── Session / Position Detection ────────────────────────────────────────────

/** Position within a vNAS session */
export interface VnasSessionPosition {
  isPrimary: boolean;
  facilityId: string;
  position: {
    id: string;
    callsign: string;
    name: string;
    radioName: string;
    frequency: number;
    starred: boolean;
    eramConfiguration: {
      sectorId: string;
    } | null;
    starsConfiguration: unknown | null;
  };
}

/** A vNAS session (one per controller connection in vNAS) */
export interface VnasSession {
  id: string;
  artccId: string;
  isActive?: boolean;
  isPseudoController: boolean;
  callsign?: string;
  role?: string;
  positions: VnasSessionPosition[];
}
