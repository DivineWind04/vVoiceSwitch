/**
 * Landline Store Bridge
 *
 * Singleton that manages the LandlineClient lifecycle and bridges landline
 * call state into the existing zustand gg_status array. Mirrors the VACS
 * and v-VSCS store bridge pattern so the UI buttons render landline calls
 * identically to other G/G transports.
 *
 * Position JSON format:
 *   ["ll:ZOA:R62", 2, "NORCAL,CTR"]              → Call to R62 at ZOA
 *   ["ll:ZLA:33_CTR", 1, "ZLA,HIGH"]              → Ring call to ZLA position
 *   ["ll:ZOA:R62", 0, "R62,OVR"]                  → Override line to R62
 *   ["ll:NCT:A,NCT:B,NCT:C", 2, "S-BAY,CMB"]     → Shout to multiple positions (fan-out)
 */

import { LandlineClient } from './client';
import type { LandlineClientEvent, LandlineClientEventHandler } from './client';
import type {
  FacilityId,
  PositionName,
  ClientId,
  CallId,
  LineType,
  RosterEntry,
  LandlineDialCodeTable,
} from './types';
import { resolveLandlineDialCode } from './types';

// ─── Store State ─────────────────────────────────────────────────────────────

export interface LandlineStoreState {
  landlineConnected: boolean;
  landlineStatus: string;
  landlineClientId: ClientId | null;
  landlineRoster: RosterEntry[];
  landlineError: string | null;
}

export const INITIAL_LANDLINE_STATE: LandlineStoreState = {
  landlineConnected: false,
  landlineStatus: 'disconnected',
  landlineClientId: null,
  landlineRoster: [],
  landlineError: null,
};

// ─── Configured Lines ────────────────────────────────────────────────────────

/** A single target for a landline line */
export interface LandlineTarget {
  facility: FacilityId;
  position: PositionName;
}

/** A landline line configured in the position JSON */
export interface LandlineConfiguredLine {
  /** Primary target facility (first target for shout lines) */
  targetFacility: FacilityId;
  /** Primary target position (first target for shout lines) */
  targetPosition: PositionName;
  /** All targets for shout lines (fan-out). For single-target lines this has one entry. */
  targets: LandlineTarget[];
  /** Display label from position JSON */
  label: string;
  /** Line type: 0=override, 1=ring, 2=regular, 3=dial/trunk */
  lineType: LineType;
  /** Trunk name for type 3 dial lines (used to look up dial code table) */
  trunkName?: string;
  /** Sort index for preserving position config order */
  sortIndex: number;
}

// ─── Store Singleton ─────────────────────────────────────────────────────────

class LandlineStore {
  private client: LandlineClient | null = null;
  private storeSet: ((partial: any) => void) | null = null;
  private storeGet: (() => any) | null = null;
  private listeners = new Set<LandlineClientEventHandler>();
  private configuredLines: LandlineConfiguredLine[] = [];
  private llDialCodeTable: LandlineDialCodeTable | null = null;
  /** Maps a shout group key → active call IDs for that group */
  private shoutGroupCalls = new Map<string, CallId[]>();
  /** Path to override sound file (set by UI layer) */
  private overrideSoundPath: string | null = null;
  /** Path (or resolver function) for ring chime sound on incoming lineType 1 calls */
  private ringChimeSoundPath: string | (() => string) | null = null;
  /** Currently playing ring chime audio element */
  private activeChimeAudio: HTMLAudioElement | null = null;
  /** Call ID that the active chime is associated with */
  private activeChimeCallId: string | null = null;
  /** Currently playing ringback audio element (caller side) */
  private activeRingbackAudio: HTMLAudioElement | null = null;
  /** Call ID that the active ringback is associated with */
  private activeRingbackCallId: string | null = null;

  /** Set the override sound file to play when an override call connects */
  setOverrideSoundPath(path: string): void {
    this.overrideSoundPath = path;
  }

  /** Set the ring chime sound path (or a function returning the path) for incoming lineType 1 calls */
  setRingChimeSoundPath(pathOrGetter: string | (() => string)): void {
    this.ringChimeSoundPath = pathOrGetter;
  }

  /** Start playing the ring chime for an incoming call */
  private startRingChime(callId: string): void {
    this.stopRingChime(); // Stop any existing chime first
    const path = typeof this.ringChimeSoundPath === 'function'
      ? this.ringChimeSoundPath()
      : this.ringChimeSoundPath;
    if (!path) return;
    try {
      const audio = new Audio(path);
      audio.loop = true;
      audio.volume = 0.7;
      audio.play().catch(() => {});
      this.activeChimeAudio = audio;
      this.activeChimeCallId = callId;
    } catch (_) { /* ignore audio errors */ }
  }

  /** Stop the ring chime (optionally only if it matches a specific call) */
  private stopRingChime(callId?: string): void {
    if (callId && this.activeChimeCallId !== callId) return;
    if (this.activeChimeAudio) {
      try {
        this.activeChimeAudio.pause();
        this.activeChimeAudio.currentTime = 0;
      } catch (_) { /* ignore */ }
      this.activeChimeAudio = null;
      this.activeChimeCallId = null;
    }
  }

  /** Start playing ringback tone for an outgoing ring call (caller side) */
  private startRingback(callId: string): void {
    this.stopRingback(); // Stop any existing ringback first
    try {
      const audio = new Audio('/rdvs/RingBack.wav');
      audio.loop = true;
      audio.volume = 0.7;
      audio.play().catch(() => {});
      this.activeRingbackAudio = audio;
      this.activeRingbackCallId = callId;
    } catch (_) { /* ignore audio errors */ }
  }

  /** Stop the ringback tone (optionally only if it matches a specific call) */
  private stopRingback(callId?: string): void {
    if (callId && this.activeRingbackCallId !== callId) return;
    if (this.activeRingbackAudio) {
      try {
        this.activeRingbackAudio.pause();
        this.activeRingbackAudio.currentTime = 0;
      } catch (_) { /* ignore */ }
      this.activeRingbackAudio = null;
      this.activeRingbackCallId = null;
    }
  }

  /** Currently playing dial tone audio element */
  private activeDialToneAudio: HTMLAudioElement | null = null;

  /** Start playing dial tone (for lineType 3 dial lines) */
  startDialTone(): void {
    this.stopDialTone();
    try {
      const audio = new Audio('/rdvs/DialTone.wav');
      audio.loop = true;
      audio.volume = 0.7;
      audio.play().catch(() => {});
      this.activeDialToneAudio = audio;
    } catch (_) { /* ignore audio errors */ }
  }

  /** Stop the dial tone */
  stopDialTone(): void {
    if (this.activeDialToneAudio) {
      try {
        this.activeDialToneAudio.pause();
        this.activeDialToneAudio.currentTime = 0;
      } catch (_) { /* ignore */ }
      this.activeDialToneAudio = null;
    }
  }

  /** Bind to the zustand store's set/get functions */
  bindStore(set: (partial: any) => void, get: () => any): void {
    this.storeSet = set;
    this.storeGet = get;
  }

  /** Subscribe to landline client events */
  on(handler: LandlineClientEventHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  get isConnected(): boolean {
    return this.client?.isConnected ?? false;
  }

  // ─── Configured Lines ──────────────────────────────────────────────

  /**
   * Set the landline lines parsed from the position JSON.
   * Called by model.ts resetWindow() when position config is loaded.
   */
  setConfiguredLines(lines: LandlineConfiguredLine[]): void {
    console.log('[Landline Store] setConfiguredLines:', lines.length, 'lines');
    this.configuredLines = lines;
    this.refreshGgStatus();
  }

  getConfiguredLines(): LandlineConfiguredLine[] {
    return this.configuredLines;
  }

  /**
   * Set the landline dial code table for type 3 (trunk/dial) lines.
   * Called by model.ts resetWindow() when position config is loaded.
   */
  setLlDialCodeTable(table: LandlineDialCodeTable | null): void {
    console.log('[Landline Store] setLlDialCodeTable:', table ? Object.keys(table).length + ' trunks' : 'null');
    this.llDialCodeTable = table;
  }

  getLlDialCodeTable(): LandlineDialCodeTable | null {
    return this.llDialCodeTable;
  }

  /**
   * Resolve a dial code and initiate a landline call to the resolved target.
   * Called by the keypad UI after the user enters a 2-digit dial code on a type 3 line.
   *
   * @param trunkName - The trunk name from the type 3 line label (e.g. "E/W/V", "S-BAY")
   * @param dialCode - The 2-digit code entered by the user (e.g. "42")
   * @returns callId if call was initiated, null otherwise
   */
  sendLandlineDialCall(trunkName: string, dialCode: string): CallId | null {
    const resolved = resolveLandlineDialCode(this.llDialCodeTable, trunkName, dialCode);
    if (!resolved) {
      console.error('[Landline Store] Could not resolve dial code:', { trunkName, dialCode });
      return null;
    }

    console.log('[Landline Store] Dial resolved:', { trunkName, dialCode, target: resolved });
    // Type 3 dial calls resolve to a ring call (lineType 1) at the target
    return this.callPosition(resolved.facility, resolved.position, 1);
  }

  // ─── Connection ──────────────────────────────────────────────────────

  /**
   * Connect to the landline signaling server.
   * @param facility - Facility ID (e.g. "ZOA")
   * @param position - Position name (e.g. "R62")
   * @param assumedPositions - Additional positions
   * @param serverUrl - Signaling server WebSocket URL
   */
  connectLandline(
    facility: FacilityId,
    position: PositionName,
    assumedPositions: PositionName[] = [],
    serverUrl?: string,
  ): void {
    console.log('[Landline Store] connectLandline called:', { facility, position, assumedPositions, serverUrl: serverUrl || 'default (ws://localhost:8787/ws)' });
    if (this.client) {
      console.log('[Landline Store] Destroying previous client');
      this.client.destroy();
    }

    this.client = new LandlineClient();
    this.client.on((event) => this.handleEvent(event));

    this.updateState({ landlineStatus: 'connecting', landlineError: null });
    this.client.connect(facility, position, assumedPositions, serverUrl);
    console.log('[Landline Store] connect() dispatched, waiting for WebSocket...');
  }

  /** Disconnect from landline */
  disconnectLandline(): void {
    if (this.client) {
      this.client.disconnect();
      this.client.destroy();
      this.client = null;
    }
    this.updateState({ ...INITIAL_LANDLINE_STATE });
    this.refreshGgStatus();
  }

  // ─── Call Management ─────────────────────────────────────────────────

  /** Initiate a G/G call to a position (CALL_U_SETUP) */
  callPosition(
    targetFacility: FacilityId,
    targetPosition: PositionName,
    lineType: LineType = 2,
  ): CallId | null {
    console.log('[Landline Store] callPosition:', { targetFacility, targetPosition, lineType, isConnected: this.client?.isConnected });
    return this.client?.callPosition(targetFacility, targetPosition, lineType) ?? null;
  }

  /** Accept an incoming call (CALL_ACCEPTED) */
  acceptCall(callId: CallId): void {
    this.client?.acceptCall(callId);
  }

  /** End a call (CALL_END) */
  endCall(callId: CallId): void {
    this.client?.endCall(callId);
  }

  /** Hold a call (CALL_HOLD) */
  holdCall(callId: CallId): void {
    this.client?.holdCall(callId);
  }

  /** Retrieve from hold (CALL_RETRIEVE) */
  retrieveCall(callId: CallId): void {
    this.client?.retrieveCall(callId);
  }

  /**
   * Handle a G/G button press for a landline call.
   * @param landlineCallId - The call ID or config placeholder
   * @param currentStatus - Current button status (off, chime, ringing, ok, hold)
   */
  handleButtonPress(landlineCallId: string, currentStatus: string): void {
    console.log('[Landline Store] handleButtonPress:', { landlineCallId, currentStatus, isConnected: this.isConnected, hasClient: !!this.client });
    switch (currentStatus) {
      case 'off':
        // Button was idle — initiate a call from config
        if (landlineCallId.startsWith('ll_cfg:')) {
          if (!this.client) {
            console.warn('[Landline Store] Cannot call: no client instance. Was connectLandline() called?');
            return;
          }
          if (!this.client.isConnected) {
            console.warn('[Landline Store] Cannot call: client exists but WebSocket not connected. Check ws://localhost:8787/ws');
            return;
          }
          // Find the configured line that produced this cfgId
          const cfgLine = this.configuredLines.find(l => this.makeCfgId(l) === landlineCallId);
          if (cfgLine && cfgLine.targets.length > 1) {
            // Multi-target line — fan out to all targets (backend), UI shows one composite button
            this.initiateShout(cfgLine);
          } else {
            // Single-target line
            const parts = landlineCallId.split(':');
            const facility = parts[1] || '';
            const position = parts[2] || '';
            const lineType = (parseInt(parts[3] || '2', 10) as LineType);
            this.callPosition(facility, position, lineType);
          }
        }
        break;

      case 'chime':
        // Incoming call ringing — accept / pickup
        if (!landlineCallId.startsWith('ll_cfg:')) {
          const callInfo = this.client?.getCallInfo(landlineCallId);
          if (callInfo?.shoutPendingPickup) {
            // Shout line: WebRTC already connected one-way, now enable full duplex
            this.client?.pickupShoutCall(landlineCallId);
          } else {
            this.acceptCall(landlineCallId);
          }
        }
        break;

      case 'ringing':
        // Outgoing call ringing — cancel
        if (!landlineCallId.startsWith('ll_cfg:')) {
          this.endCall(landlineCallId);
        }
        break;

      case 'ok':
      case 'active':
        // Active call — end it (but NOT if we're the overridden party on a type-0 call)
        if (landlineCallId.startsWith('ll_cfg:')) {
          // Shout line still active — end all sub-calls
          this.endShoutGroup(landlineCallId);
        } else {
          const callInfo = this.client?.getCallInfo(landlineCallId);
          if (callInfo && callInfo.lineType === 0 && callInfo.direction === 'incoming') {
            // Overridden party cannot hang up an override call — only the caller can
            console.log('[Landline Store] Override call — overridden party cannot hang up:', landlineCallId);
            return;
          }
          this.endCall(landlineCallId);
        }
        break;

      case 'hold':
        // Held call — retrieve it
        if (!landlineCallId.startsWith('ll_cfg:')) {
          this.retrieveCall(landlineCallId);
        }
        break;

      default:
        if (landlineCallId && !landlineCallId.startsWith('ll_cfg:')) {
          this.endCall(landlineCallId);
        }
        break;
    }
  }

  // ─── Shout Fan-Out ─────────────────────────────────────────────────

  /** Initiate calls to all targets in a multi-target line */
  private initiateShout(cfgLine: LandlineConfiguredLine): void {
    const groupKey = this.makeCfgId(cfgLine);

    // Pre-register the group key BEFORE making calls, so that refreshGgStatus()
    // triggered by each callPosition() can find the group and won't leak sub-calls
    // as individual unmatched buttons.
    this.shoutGroupCalls.set(groupKey, []);

    const callIds: CallId[] = [];
    for (const target of cfgLine.targets) {
      const callId = this.callPosition(target.facility, target.position, cfgLine.lineType);
      if (callId) {
        callIds.push(callId);
        // Update the group incrementally so mid-loop refreshes see all IDs so far
        this.shoutGroupCalls.set(groupKey, [...callIds]);
      }
    }

    if (callIds.length === 0) {
      this.shoutGroupCalls.delete(groupKey);
    }
    console.log('[Landline Store] Multi-target initiated:', groupKey, callIds.length, 'calls');
  }

  /** For non-shout multi-target lines (override/ring): call the first online target from the roster */
  private initiateToFirstOnline(cfgLine: LandlineConfiguredLine): void {
    const roster: RosterEntry[] = this.storeGet?.()?.landlineRoster ?? [];
    // Find the first target whose position appears in the current roster
    const onlineTarget = cfgLine.targets.find(t =>
      roster.some(r =>
        r.position.toUpperCase() === t.position.toUpperCase() ||
        (r.assumedPositions || []).some(ap => ap.toUpperCase() === t.position.toUpperCase())
      )
    );

    if (onlineTarget) {
      console.log('[Landline Store] Multi-target override/ring — calling first online target:', onlineTarget.position);
      this.callPosition(onlineTarget.facility, onlineTarget.position, cfgLine.lineType);
    } else {
      // No target online — try the first target anyway (server will reject if not available)
      console.log('[Landline Store] Multi-target override/ring — no target online, trying first target:', cfgLine.targets[0]?.position);
      const first = cfgLine.targets[0];
      if (first) {
        this.callPosition(first.facility, first.position, cfgLine.lineType);
      }
    }
  }

  /** End all calls in a shout group */
  private endShoutGroup(cfgId: string): void {
    const callIds = this.shoutGroupCalls.get(cfgId);
    if (callIds) {
      for (const callId of callIds) {
        this.endCall(callId);
      }
      this.shoutGroupCalls.delete(cfgId);
    }
  }

  /** Build the cfg ID string for a configured line */
  private makeCfgId(cfgLine: LandlineConfiguredLine): string {
    return `ll_cfg:${cfgLine.targetFacility}:${cfgLine.targetPosition}:${cfgLine.lineType}`;
  }

  // ─── G/G Status Bridge ──────────────────────────────────────────────

  /**
   * Get landline entries for gg_status.
   * Merges configured (static) lines with active call state.
   */
  getGgStatusEntries(): any[] {
    const activeEntries = this.client?.getGgStatusEntries() ?? [];

    if (this.configuredLines.length === 0) {
      return activeEntries;
    }

    const entries: any[] = [];
    const matchedCallIds = new Set<string>();

    for (const cfgLine of this.configuredLines) {
      const cfgId = this.makeCfgId(cfgLine);

      // Check for multi-target (shout group) calls
      const shoutCallIds = this.shoutGroupCalls.get(cfgId);
      if (shoutCallIds) {
        // Match sub-calls by call ID, and also by target position name (catches any
        // calls made before the group map was populated mid-loop).
        // For incoming calls with targetPosition (instructor mode), match by targeted position.
        const targetNames = new Set(cfgLine.targets.map(t => t.position.toUpperCase()));
        const shoutEntries = activeEntries.filter((e: any) =>
          shoutCallIds.includes(e.landlineCallId) ||
          (e.landlineDirection === 'outgoing' && targetNames.has((e.otherPosition || '').toUpperCase())) ||
          (e.landlineDirection === 'incoming' && e.targetPosition && targetNames.has((e.targetPosition || '').toUpperCase()))
        );
        for (const e of shoutEntries) matchedCallIds.add(e.landlineCallId);

        // Derive composite status: any connected → ok, any ringing → ringing, else ended → off
        const statuses = shoutEntries.map((e: any) => e.status);
        let compositeStatus = 'off';
        if (statuses.includes('ok') || statuses.includes('active')) compositeStatus = 'ok';
        else if (statuses.includes('ringing') || statuses.includes('setup')) compositeStatus = 'ringing';
        else if (statuses.includes('chime')) compositeStatus = 'chime';

        // Clean up ended shout groups
        const aliveIds = shoutCallIds.filter(id => activeEntries.some((e: any) => e.landlineCallId === id));
        if (aliveIds.length === 0 && shoutEntries.length === 0) {
          this.shoutGroupCalls.delete(cfgId);
          compositeStatus = 'off';
        } else if (aliveIds.length > 0) {
          this.shoutGroupCalls.set(cfgId, aliveIds);
        }

        entries.push({
          call: `LL_GROUP_${cfgLine.targetPosition}`,
          call_name: cfgLine.label,
          status: compositeStatus,
          isLandline: true,
          landlineCallId: cfgId,
          landlineTargetFacility: cfgLine.targetFacility,
          landlineTargetPosition: cfgLine.targetPosition,
          lineType: cfgLine.lineType,
          isShout: cfgLine.targets.length > 1,
          shoutCallIds: aliveIds,
        });
        continue;
      }

      // Single or multi-target without active shout group: match by target position
      const targetNames = new Set(cfgLine.targets.map(t => t.position.toUpperCase()));
      const matchingCalls = activeEntries.filter((entry: any) => {
        if (matchedCallIds.has(entry.landlineCallId)) return false;
        const remoteName = (entry.otherPosition || '').toUpperCase();
        // Outgoing calls: match by remote position (who we called)
        if (entry.landlineDirection === 'outgoing') {
          return targetNames.has(remoteName);
        }
        // Incoming calls: if targetPosition is set (instructor receiving via
        // assumed position), match by which of our positions was targeted.
        // Otherwise fall back to matching by caller position (otherPosition).
        const incomingTarget = (entry.targetPosition || '').toUpperCase();
        if (incomingTarget && targetNames.has(incomingTarget)) {
          return true;
        }
        return targetNames.has(remoteName);
      });

      if (matchingCalls.length > 0) {
        for (const mc of matchingCalls) matchedCallIds.add(mc.landlineCallId);
        // Use the first matching call for display status, but mark all as matched
        const firstMatch = matchingCalls[0];
        entries.push({
          ...firstMatch,
          call_name: cfgLine.label,
          lineType: cfgLine.lineType,
          landlineTargetFacility: cfgLine.targetFacility,
          landlineTargetPosition: cfgLine.targetPosition,
        });
      } else {
        // No active call — show idle button
        entries.push({
          call: `LL_${cfgLine.targetPosition}`,
          call_name: cfgLine.label,
          status: 'off',
          isLandline: true,
          landlineCallId: cfgId,
          landlineTargetFacility: cfgLine.targetFacility,
          landlineTargetPosition: cfgLine.targetPosition,
          lineType: cfgLine.lineType,
          // For type 3 dial lines, include trunk name so UI can open keypad
          ...(cfgLine.lineType === 3 && cfgLine.trunkName ? { trunkName: cfgLine.trunkName } : {}),
        });
      }
    }

    // Add active calls that don't match a configured line (dynamic incoming)
    for (const entry of activeEntries) {
      if (!matchedCallIds.has(entry.landlineCallId)) {
        entries.push(entry);
      }
    }

    return entries;
  }

  // ─── Event Handling ──────────────────────────────────────────────────

  private handleEvent(event: LandlineClientEvent): void {
    console.log('[Landline Store] Event:', event.type, event);
    // Forward to external listeners
    for (const handler of this.listeners) {
      try {
        handler(event);
      } catch (err) {
        console.error('[Landline Store] Event handler error:', err);
      }
    }

    switch (event.type) {
      case 'connected':
        console.log('[Landline Store] WebSocket connected successfully');
        this.updateState({ landlineStatus: 'connected', landlineError: null });
        break;

      case 'disconnected':
        console.warn('[Landline Store] WebSocket disconnected');
        this.stopRingChime(); // Stop any active chime
        this.stopRingback(); // Stop any active ringback
        this.updateState({
          landlineConnected: false,
          landlineStatus: 'disconnected',
          landlineClientId: null,
          landlineRoster: [],
        });
        this.refreshGgStatus();
        break;

      case 'registered':
        this.updateState({
          landlineConnected: true,
          landlineStatus: 'registered',
          landlineClientId: event.clientId,
        });
        break;

      case 'registrationFailed':
        this.updateState({
          landlineConnected: false,
          landlineStatus: 'registration failed',
          landlineError: event.error,
        });
        break;

      case 'rosterUpdated':
        this.updateState({ landlineRoster: event.roster });
        break;

      case 'callStateChanged':
        // Play override sound when an override call (lineType 0) connects
        if (event.state === 'connected' && this.overrideSoundPath) {
          const call = this.client?.getCallInfo(event.callId);
          if (call && call.lineType === 0) {
            try {
              const tone = new Audio(this.overrideSoundPath);
              tone.volume = 0.7;
              tone.play().catch(() => {});
            } catch (_) { /* ignore audio errors */ }
          }
        }
        // Start ring chime for incoming lineType 1 (ring) calls only — NOT shout (type 2)
        if (event.state === 'ringing') {
          const call = this.client?.getCallInfo(event.callId);
          if (call && call.lineType === 1 && call.direction === 'incoming') {
            this.startRingChime(event.callId);
          }
        }
        // Start ringback for outgoing lineType 1 (ring) calls only — NOT shout (type 2)
        if (event.state === 'setup') {
          const call = this.client?.getCallInfo(event.callId);
          if (call && call.lineType === 1 && call.direction === 'outgoing') {
            this.startRingback(event.callId);
          }
        }
        // Stop ring chime and ringback when call connects or is accepted
        if (event.state === 'connected' || event.state === 'accepted') {
          this.stopRingChime(event.callId);
          this.stopRingback(event.callId);
        }
        this.refreshGgStatus();
        break;

      case 'callEnded':
        this.stopRingChime(event.callId);
        this.stopRingback(event.callId);
        this.refreshGgStatus();
        break;

      case 'callError':
        this.updateState({ landlineError: `Call error: ${event.reason}` });
        this.refreshGgStatus();
        break;

      case 'error':
        this.updateState({ landlineError: event.error });
        break;
    }
  }

  private updateState(partial: Partial<LandlineStoreState>): void {
    if (this.storeSet) {
      this.storeSet(partial);
    }
  }

  private refreshGgStatus(): void {
    if (!this.storeGet || !this.storeSet) return;

    const state = this.storeGet();
    const currentGg = state.gg_status || [];

    // Filter out previous landline entries
    const nonLandlineGg = currentGg.filter((entry: any) => !entry.isLandline);

    // Get current landline entries
    const landlineGg = this.getGgStatusEntries();

    const merged = [...nonLandlineGg, ...landlineGg];
    this.storeSet({ gg_status: merged });
  }

  destroy(): void {
    this.client?.destroy();
    this.client = null;
    this.listeners.clear();
  }
}

/** Singleton landline store bridge */
export const landlineStore = new LandlineStore();
