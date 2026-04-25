/**
 * v-VSCS Store Bridge
 *
 * Singleton that manages the VvscsClient lifecycle and bridges v-VSCS call state
 * into the existing zustand gg_status array. This mirrors the VACS store bridge
 * pattern so the UI buttons render v-VSCS calls identically to AFV/VACS G/G lines.
 */

import { VvscsClient } from './client';
import type { VvscsClientEvent, VvscsClientEventHandler } from './client';
import type {
  FacilityId,
  PositionName,
  SocketId,
  LineId,
  RosterEntry,
} from './types';

// ─── Store State ─────────────────────────────────────────────────────────────

export interface VvscsStoreState {
  /** Whether the v-VSCS Socket.IO is connected and registered */
  vvscsConnected: boolean;
  /** v-VSCS connection status message for UI display */
  vvscsStatus: string;
  /** Our socket ID on the v-VSCS server */
  vvscsSocketId: SocketId | null;
  /** Facility roster (who's online) */
  vvscsRoster: RosterEntry[];
  /** Last v-VSCS error message */
  vvscsError: string | null;
}

export const INITIAL_VVSCS_STATE: VvscsStoreState = {
  vvscsConnected: false,
  vvscsStatus: 'disconnected',
  vvscsSocketId: null,
  vvscsRoster: [],
  vvscsError: null,
};

// ─── Configured Lines ────────────────────────────────────────────────────────

/** A v-VSCS line configured in the position JSON (e.g. ["vvscs:R62", 2, "NORCAL,CTR"]) */
export interface VvscsConfiguredLine {
  /** Target position name within the same or remote facility */
  target: PositionName;
  /** Target type: 'position' (intra-facility override) or 'shout' (inter-facility) */
  targetType: 'position' | 'shout';
  /** Optional remote facility ID for shout lines */
  remoteFacility?: FacilityId;
  /** Display label from position JSON */
  label: string;
  /** Line type (always 2 for G/G) */
  lineType: number;
  /** Sort index for preserving position config order */
  sortIndex: number;
}

// ─── Store Singleton ─────────────────────────────────────────────────────────

class VvscsStore {
  private client: VvscsClient | null = null;
  private storeSet: ((partial: any) => void) | null = null;
  private storeGet: (() => any) | null = null;
  private listeners = new Set<VvscsClientEventHandler>();
  /** v-VSCS lines from the position JSON config */
  private configuredLines: VvscsConfiguredLine[] = [];

  /** Bind to the zustand store's set/get functions */
  bindStore(set: (partial: any) => void, get: () => any): void {
    this.storeSet = set;
    this.storeGet = get;
  }

  /** Subscribe to v-VSCS client events */
  on(handler: VvscsClientEventHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  /** Whether v-VSCS is connected */
  get isConnected(): boolean {
    return this.client?.isConnected ?? false;
  }

  // ─── Configured Lines ──────────────────────────────────────────────

  /**
   * Set the v-VSCS lines parsed from the position JSON.
   * Called by model.ts resetWindow() when position config is loaded.
   */
  setConfiguredLines(lines: VvscsConfiguredLine[]): void {
    console.log('[vVSCS Store] setConfiguredLines called with', lines.length, 'lines:', lines);
    this.configuredLines = lines;
    this.refreshGgStatus();
    console.log('[vVSCS Store] After refreshGgStatus, gg_status has', this.storeGet?.()?.gg_status?.length, 'entries');
  }

  getConfiguredLines(): VvscsConfiguredLine[] {
    return this.configuredLines;
  }

  // ─── Connection ──────────────────────────────────────────────────────

  /**
   * Connect to the v-VSCS signaling server.
   * @param facility - Facility ID (e.g. "ZOA")
   * @param position - Position name (e.g. "R62")
   * @param assumedPositions - Additional positions
   */
  connectVvscs(
    facility: FacilityId,
    position: PositionName,
    assumedPositions: PositionName[] = [],
  ): void {
    if (this.client) {
      this.client.destroy();
    }

    this.client = new VvscsClient();
    this.client.on((event) => this.handleEvent(event));

    this.updateState({ vvscsStatus: 'connecting', vvscsError: null });
    this.client.connect(facility, position, assumedPositions);
  }

  /** Disconnect from v-VSCS */
  disconnectVvscs(): void {
    if (this.client) {
      this.client.disconnect();
      this.client.destroy();
      this.client = null;
    }
    this.updateState({ ...INITIAL_VVSCS_STATE });
    this.refreshGgStatus();
  }

  // ─── Call Management ─────────────────────────────────────────────────

  /** Open an override (1:1 call) to a position */
  openOverride(targetPosition: PositionName): void {
    this.client?.openOverride(targetPosition);
  }

  /** Close an override */
  closeOverride(lineId: LineId): void {
    this.client?.closeOverride(lineId);
  }

  /** Activate a shout to a remote facility */
  activateShout(line: string, remoteFacility: FacilityId): void {
    this.client?.activateShout(line, remoteFacility);
  }

  /** Join an active shout */
  joinShout(lineId: LineId): void {
    this.client?.joinShout(lineId);
  }

  /** Leave a shout */
  leaveShout(lineId: LineId): void {
    this.client?.leaveShout(lineId);
  }

  /** End any call by line ID */
  endCall(lineId: LineId): void {
    this.client?.endCall(lineId);
  }

  /**
   * Handle a G/G button press for a v-VSCS call.
   * @param vvscsLineId - The line ID or config placeholder
   * @param currentStatus - Current button status (off, chime, ringing, ok, etc.)
   */
  handleButtonPress(vvscsLineId: string, currentStatus: string): void {
    switch (currentStatus) {
      case 'off':
        // Button was idle — check if this is a configured line to initiate
        if (vvscsLineId.startsWith('vvscs_cfg:')) {
          if (!this.client) {
            console.warn('[vVSCS Store] Cannot call: not connected to v-VSCS');
            return;
          }
          const parts = vvscsLineId.split(':');
          const targetType = parts[1]; // pos or shout
          const targetId = parts.slice(2).join(':');

          if (targetType === 'pos') {
            this.openOverride(targetId);
          } else if (targetType === 'shout') {
            // Shout format: vvscs_cfg:shout:lineName:remoteFacility
            const shoutParts = targetId.split(':');
            const lineName = shoutParts[0] || targetId;
            const remoteFacility = shoutParts[1] || '';
            this.activateShout(lineName, remoteFacility);
          }
        }
        break;
      case 'chime':
        // Incoming call — accept (for overrides, WebRTC is auto-handled)
        // For shouts we may need to join
        if (!vvscsLineId.startsWith('vvscs_cfg:')) {
          this.joinShout(vvscsLineId);
        }
        break;
      case 'ringing':
        // Outgoing call ringing — cancel
        if (!vvscsLineId.startsWith('vvscs_cfg:')) {
          this.endCall(vvscsLineId);
        }
        break;
      case 'ok':
      case 'active':
        // Active call — end it
        if (!vvscsLineId.startsWith('vvscs_cfg:')) {
          this.endCall(vvscsLineId);
        }
        break;
      default:
        if (vvscsLineId && !vvscsLineId.startsWith('vvscs_cfg:')) {
          this.endCall(vvscsLineId);
        }
        break;
    }
  }

  // ─── G/G Status Bridge ──────────────────────────────────────────────

  /**
   * Get v-VSCS entries for gg_status.
   * Merges configured (static) lines with active call state.
   */
  getGgStatusEntries(): any[] {
    const activeEntries = this.client?.getGgStatusEntries() ?? [];

    if (this.configuredLines.length === 0) {
      return activeEntries;
    }

    const entries: any[] = [];
    const matchedLineIds = new Set<string>();

    for (const cfgLine of this.configuredLines) {
      // Try to find an active call matching this configured target
      const matchingCall = activeEntries.find((entry: any) => {
        const remoteName = (entry.call_name || '').toUpperCase();
        return remoteName === cfgLine.target.toUpperCase();
      });

      if (matchingCall) {
        matchedLineIds.add(matchingCall.vvscsLineId);
        entries.push({
          ...matchingCall,
          call_name: cfgLine.label, // Prefer config label
          lineType: cfgLine.lineType,
          vvscsTarget: cfgLine.target,
          vvscsTargetType: cfgLine.targetType,
        });
      } else {
        // No active call — show as idle button
        const abbrevType = cfgLine.targetType === 'position' ? 'pos' : 'shout';
        const cfgId = cfgLine.remoteFacility
          ? `vvscs_cfg:${abbrevType}:${cfgLine.target}:${cfgLine.remoteFacility}`
          : `vvscs_cfg:${abbrevType}:${cfgLine.target}`;
        entries.push({
          call: `VVSCS_${cfgLine.target}`,
          call_name: cfgLine.label,
          status: 'off',
          isVvscs: true,
          vvscsLineId: cfgId,
          vvscsTarget: cfgLine.target,
          vvscsTargetType: cfgLine.targetType,
          lineType: cfgLine.lineType,
        });
      }
    }

    // Add any active calls that don't match a configured line
    for (const entry of activeEntries) {
      if (!matchedLineIds.has(entry.vvscsLineId)) {
        entries.push(entry);
      }
    }

    return entries;
  }

  // ─── Event Handling ──────────────────────────────────────────────────

  private handleEvent(event: VvscsClientEvent): void {
    // Forward to external listeners
    for (const handler of this.listeners) {
      try {
        handler(event);
      } catch (err) {
        console.error('[vVSCS Store] Event handler error:', err);
      }
    }

    switch (event.type) {
      case 'connected':
        this.updateState({
          vvscsStatus: 'connected',
          vvscsError: null,
        });
        break;

      case 'disconnected':
        this.updateState({
          vvscsConnected: false,
          vvscsStatus: 'disconnected',
          vvscsSocketId: null,
          vvscsRoster: [],
        });
        this.refreshGgStatus();
        break;

      case 'registered':
        this.updateState({
          vvscsConnected: true,
          vvscsStatus: 'registered',
          vvscsSocketId: event.socketId,
        });
        break;

      case 'registrationFailed':
        this.updateState({
          vvscsConnected: false,
          vvscsStatus: 'registration failed',
          vvscsError: event.error,
        });
        break;

      case 'rosterUpdated':
        this.updateState({
          vvscsRoster: event.roster,
        });
        break;

      case 'callStateChanged':
        this.refreshGgStatus();
        break;

      case 'callEnded':
        this.refreshGgStatus();
        break;

      case 'error':
        this.updateState({
          vvscsError: event.error,
        });
        break;
    }
  }

  /** Update the zustand store with v-VSCS state */
  private updateState(partial: Partial<VvscsStoreState>): void {
    if (this.storeSet) {
      this.storeSet(partial);
    }
  }

  /**
   * Trigger a refresh of gg_status to include v-VSCS entries.
   */
  private refreshGgStatus(): void {
    if (!this.storeGet || !this.storeSet) {
      console.warn('[vVSCS Store] refreshGgStatus: storeGet/storeSet not bound yet!');
      return;
    }

    const state = this.storeGet();
    const currentGg = state.gg_status || [];

    // Filter out previous v-VSCS entries
    const nonVvscsGg = currentGg.filter((entry: any) => !entry.isVvscs);

    // Get current v-VSCS entries
    const vvscsGg = this.getGgStatusEntries();
    console.log('[vVSCS Store] refreshGgStatus: nonVvscs=', nonVvscsGg.length, 'vvscsEntries=', vvscsGg.length, vvscsGg);

    // Merge
    const merged = [...nonVvscsGg, ...vvscsGg];
    this.storeSet({ gg_status: merged });
  }

  /** Clean up all resources */
  destroy(): void {
    this.client?.destroy();
    this.client = null;
    this.listeners.clear();
  }
}

/** Singleton v-VSCS store bridge */
export const vvscsStore = new VvscsStore();
