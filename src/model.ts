import { create } from 'zustand'
import type { RDVSColorPattern } from './types/ted_pattern_types';

interface Position {
    cs: string;
    pos: string;
    freq: number;
    rn: string;
    lines: any[];
}

// DialCodeTable maps trunk names to code->target mappings
// e.g., { "APCH": { "11": "OAK_40_CTR", "12": "SFO_U_APP" }, ... }
export type DialCodeTable = Record<string, Record<string, string>>;

export interface Facility {
    childFacilities: Facility[];
    id: string;
    name: string;
    positions: Position[];
    dialCodeTable?: DialCodeTable;
    rdvsColorPattern?: RDVSColorPattern;
}

// Helper function to find a dialCodeTable for a given position
// Searches up the facility tree from the position's parent facility
export function findDialCodeTable(positionData: Facility, positionCallsign: string): DialCodeTable | null {
    // Recursive search through facility tree
    function searchFacility(facility: Facility): { dialCodeTable?: DialCodeTable; hasPosition: boolean } {
        // Check if this facility has the position
        const hasPosition = facility.positions?.some(p => p.cs === positionCallsign);
        
        // If this facility has the position and a dialCodeTable, return it
        if (hasPosition && facility.dialCodeTable) {
            return { dialCodeTable: facility.dialCodeTable, hasPosition: true };
        }
        
        // Search child facilities
        for (const child of facility.childFacilities || []) {
            const result = searchFacility(child);
            if (result.hasPosition) {
                // Position found in child - return child's dialCodeTable if exists, otherwise this facility's
                return {
                    dialCodeTable: result.dialCodeTable || facility.dialCodeTable,
                    hasPosition: true
                };
            }
        }
        
        return { hasPosition: false };
    }
    
    const result = searchFacility(positionData);
    return result.dialCodeTable || null;
}

// Helper function to find the rdvsColorPattern for a given position
// Searches up the facility tree from the position's parent facility
export function findRdvsColorPattern(positionData: Facility, positionCallsign: string): RDVSColorPattern | null {
    // Recursive search through facility tree
    function searchFacility(facility: Facility): { rdvsColorPattern?: RDVSColorPattern; hasPosition: boolean } {
        // Check if this facility has the position
        const hasPosition = facility.positions?.some(p => p.cs === positionCallsign);

        // If this facility has the position, return it with its color pattern (if any)
        if (hasPosition) {
            return { rdvsColorPattern: facility.rdvsColorPattern, hasPosition: true };
        }

        // Search child facilities
        for (const child of facility.childFacilities || []) {
            const result = searchFacility(child);
            if (result.hasPosition) {
                // Position found in child - return child's rdvsColorPattern if exists, otherwise this facility's
                return {
                    rdvsColorPattern: result.rdvsColorPattern || facility.rdvsColorPattern,
                    hasPosition: true
                };
            }
        }

        return { hasPosition: false };
    }

    const result = searchFacility(positionData);
    return result.rdvsColorPattern || null;
}

// Helper function to resolve a dial code to a target callsign
// trunkName: The trunk name from the type 3 line label (e.g., "APCH", "S-BAY")
// dialCode: The 2-digit code entered by the user (e.g., "11", "42")
export function resolveDialCode(dialCodeTable: DialCodeTable | null, trunkName: string, dialCode: string): string | null {
    if (!dialCodeTable) return null;
    const trunkCodes = dialCodeTable[trunkName];
    if (!trunkCodes) return null;
    return trunkCodes[dialCode] || null;
}

interface CoreState {
    connected: boolean;
    afv_version: string;
    ptt: boolean;
    cid: number;
    positionData: Facility;
    callsign: string;
    selectedPositions: Position[],
    currentUI: string; // Current UI context (vscs, etvs, stvs, ivsr, rdvs, lstar)
    currentConfig: any; // The current config for the selected position

    ag_status: any[],
    gg_status: any[],
    vscs_status: any[],
    
    // Override tracking for R/T functionality
    overrideStatus: any[], // Tracks OV_ prefixed calls (incoming overrides)
    isBeingOverridden: boolean, // True when there's an active incoming override
    overrideCallStatus: string, // Status of the override call: 'off', 'ok', 'active', 'hold', etc.
    
    // Dial call state for type 3 lines
    activeDialLine: { trunkName: string; lineType: number } | null;
    dialCallStatus: 'idle' | 'dialing' | 'ringback' | 'connected' | 'busy' | 'error';

    // IA DISPLAY area state
    iaDisplayBuffer: string; // Shows dialed digits for outgoing calls
    callerIdBuffer: string;  // Shows caller ID for incoming calls
    setIaDisplayBuffer: (buffer: string) => void;
    setCallerIdBuffer: (buffer: string) => void;
    appendToIaDisplay: (digit: string) => void;
    clearIaDisplay: () => void;
    backspaceIaDisplay: () => void;

    // G/G Chime selection (1-13)
    selectedChime: number;
    setSelectedChime: (chime: number) => void;
    cycleChime: () => void;

    // UI brightness control (0-100, default 100)
    brightness: number;
    setBrightness: (brightness: number) => void;
    adjustBrightness: (delta: number) => void;

    // VSCS-specific props
    activeLandlines: any[];
    incomingLandlines: any[];
    outgoingLandlines: any[];
    heldLandlines: string[];
    buttonPress: (id: string, type: any) => void;
    holdBtn: () => void;
    releaseBtn: () => void;
    toggleGg: () => void;
    toggleOver: () => void;
    ggLoud: boolean;
    overrideLoud: boolean;
    settingsEdit: (val: boolean) => void;
    volume: { volume: number; setVolume: (val: number) => void };
    playError: () => void;
    metadata: { position: string; sector: string; facilityId: string };

    setPositionData: (data: any) => void;
    setConnected: (status: boolean) => void;
    updateSelectedPositions: (poss: Position[]) => void;
    setCallsign: (call_sign: string, cid: number) => void;
    sendMessageNow: (data: any) => void;
    setCurrentUI: (ui: string) => void;
    setCurrentConfig: (config: any) => void;
    
    // Dial call functions
    setActiveDialLine: (dialLine: { trunkName: string; lineType: number } | null) => void;
    sendDialCall: (trunkName: string, dialCode: string) => void;
}

let call_table: Record<string, [string, number]> = {}
let line_order: Record<string, number> = {} // Track original line order for sorting
let placeholder_indices: number[] = [] // Track indices where empty placeholder buttons should appear

// RDVS-specific types
export interface RDVSButton {
    id: string;
    label: string;
    status: string;
    group: number;
    type: string;
}

export interface RDVSGroup {
    id: number;
    buttons: RDVSButton[];
}

export interface RDVSPage {
    id: number;
    groups: RDVSGroup[];
    footer: string[];
}

// RDVS fields are now part of the main CoreState and store definition below.
interface AudioConfig {
    ringback: string;
    ggchime: string;
    override?: string;
}

const audioConfigs: Record<string, AudioConfig> = {
    vscs: {
        ringback: 'Ringback.wav',
        ggchime: 'GGChime.mp3',
        override: 'Override.mp3'
    },
    etvs: {
        ringback: 'Override_Term.wav',
        ggchime: 'RDVS_Chime.m4a'
    },
    stvs: {
        ringback: 'Override_Term.wav',
        ggchime: 'RDVS_Chime.m4a'
    },
    ivsr: {
        ringback: 'Override_Term.wav',
        ggchime: 'RDVS_Chime.m4a'
    },
    rdvs: {
        ringback: 'Ringback.wav',
        ggchime: 'GGChime.mp3'
    }
};

// Function to detect current UI context
export function getCurrentUIContext(): string {
    if (typeof window === 'undefined') return 'vscs'; // Default for SSR
    
    // First, try to detect from URL path
    const path = window.location.pathname;
    if (path.includes('/vscs')) return 'vscs';
    if (path.includes('/etvs')) return 'etvs';
    if (path.includes('/stvs')) return 'stvs';
    if (path.includes('/ivsr')) return 'ivsr';
    if (path.includes('/rdvs')) return 'rdvs';
    
    // If no URL-based detection, try to get from position data in store
    try {
        // Access the Zustand store to get selected position data
        const state = (window as any).__ZUSTAND_STORE_STATE__ || useCoreStore.getState();
        if (state?.selectedPositions?.length > 0) {
            const position = state.selectedPositions[0];
            // Check if position has a UI field (from JSON)
            if (position.ui) {
                return position.ui.toLowerCase();
            }
            // Check if position has panelType (from database)
            if (position.panelType) {
                return position.panelType.toLowerCase();
            }
        }
    } catch (err) {
        // Ignore errors accessing store
        console.debug('Could not access position data for UI context:', err);
    }
    
    // Default to VSCS if no specific UI detected
    return 'vscs';
}

// Function to create or get audio element for specific UI
export function getAudioElement(audioType: 'ringback' | 'ggchime'): HTMLAudioElement | null {
    if (typeof document === 'undefined') return null;
    
    const uiContext = getCurrentUIContext();
    const config = audioConfigs[uiContext];
    
    // Fallback to VSCS config if current UI config not found
    const defaultConfig = audioConfigs.vscs || { ringback: 'Ringback.wav', ggchime: 'GGChime.mp3' };
    let audioSrc = config ? config[audioType] : defaultConfig[audioType];
    
    // For IVSR chime, use the selected chime from the store
    if (uiContext === 'ivsr' && audioType === 'ggchime') {
        // Access the store to get selectedChime
        const selectedChime = useCoreStore.getState().selectedChime || 1;
        const paddedNum = selectedChime.toString().padStart(2, '0');
        audioSrc = `/ivsr/IVSRChime-${paddedNum}.wav`;
    }
    
    // Create unique ID for this UI context and audio type
    const audioId = `${uiContext}_${audioType}`;
    
    // Check if element already exists
    let audioElement = document.getElementById(audioId) as HTMLAudioElement | null;
    
    if (!audioElement) {
        // Create new audio element
        audioElement = document.createElement('audio');
        audioElement.id = audioId;
        audioElement.src = audioSrc;
        audioElement.preload = 'auto';
        document.body.appendChild(audioElement);
    } else {
        // Update src in case chime selection changed
        if (audioElement.src !== audioSrc && !audioElement.src.endsWith(audioSrc)) {
            audioElement.src = audioSrc;
        }
    }
    
    return audioElement;
}

// Guard DOM access for Next.js SSR safety - these will be dynamically updated
let ringback_audio: HTMLAudioElement | null = null;
let ggchime_audio: HTMLAudioElement | null = null;

// Initialize audio elements when document is available
if (typeof document !== 'undefined') {
    ringback_audio = getAudioElement('ringback');
    ggchime_audio = getAudioElement('ggchime');
}

// Function to refresh audio elements when UI context changes
export function refreshAudioElements() {
    if (typeof document !== 'undefined') {
        ringback_audio = getAudioElement('ringback');
        ggchime_audio = getAudioElement('ggchime');
    }
}

// Function to set UI context based on position selection (for position-based UI switching)
export function setUIContextFromPosition(position: any) {
    // This will trigger refreshAudioElements to use the correct audio files
    // when position data indicates a specific UI type
    let detectedUI = 'vscs'; // default
    
    if (position?.ui) {
        detectedUI = position.ui.toLowerCase();
    } else if (position?.panelType) {
        detectedUI = position.panelType.toLowerCase();
    }
    
    // Refresh audio elements with new context
    refreshAudioElements();
    
    return detectedUI;
}

export function stopAudio() {
    try {
        // Get current audio elements in case UI context changed
        const currentRingback = getAudioElement('ringback');
        const currentGgchime = getAudioElement('ggchime');
        
        currentRingback?.pause?.();
        currentGgchime?.pause?.();
        
        // Also stop the cached references
        ringback_audio?.pause?.();
        ggchime_audio?.pause?.();
    } catch {
        // ignore
    }
}

const debounce = <T extends (...args: any[]) => void>(callback: T, wait: number) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
        if (typeof window === 'undefined') {
            // SSR: execute immediately without debouncing
            callback(...args);
            return;
        }
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            callback(...args);
        }, wait);
    };
}

export function chime(audio: HTMLAudioElement | null | undefined) {
    try {
        if (!audio) return;
        if ((audio as any).paused) {
            audio.currentTime = 0;
            // play() may be blocked by user gesture policy; ignore errors
            audio.play().catch(() => {});
        }
    } catch {
        // ignore
    }
}

export const useCoreStore = create<CoreState>((set: any, get: any) => {
    let socket: WebSocket | null;
    const ds: CoreState = {
        connected: false,
        afv_version: '',
        cid: 0,
        ptt: false,
        callsign: '',
        positionData: { childFacilities: [], id: '', name: '', positions: [] },
        selectedPositions: [],
        currentUI: 'vscs', // Default to VSCS
        currentConfig: null,

    ag_status: [],
    gg_status: [],
    vscs_status: [],
    overrideStatus: [], // Track OV_ calls
    isBeingOverridden: false, // Track if position is being overridden
    overrideCallStatus: 'off', // Track override call status for OVR lamp animation
    sendMessageNow: () => {},
    // VSCS-specific props (default implementations)
    activeLandlines: [],
    incomingLandlines: [],
    outgoingLandlines: [],
    heldLandlines: [],
    buttonPress: () => {},
    holdBtn: () => {
        // Hold all active G/G calls
        const { gg_status, sendMessageNow } = get();
        const activeCalls = (gg_status || []).filter((call: any) =>
            call && (call.status === 'ok' || call.status === 'active')
        );

        console.log('[holdBtn] Holding', activeCalls.length, 'active calls');

        activeCalls.forEach((call: any) => {
            const fullCall = call.call;
            // Strip variable-length prefixes: gg_05_, OV_, SO_, etc.
            const call_id = fullCall?.replace(/^(?:gg_\d+_|OV_|SO_)/, '') || '';

            if (call_id && sendMessageNow) {
                console.log('[holdBtn] Holding call:', call_id);
                sendMessageNow({ type: 'hold', cmd1: call_id, dbl1: 0 });
            }
        });
    },
    releaseBtn: () => {
        // Release all active G/G calls
        const { gg_status, sendMessageNow } = get();
        const activeCalls = (gg_status || []).filter((call: any) =>
            call && (call.status === 'ok' || call.status === 'active')
        );

        console.log('[releaseBtn] Releasing', activeCalls.length, 'active calls');

        activeCalls.forEach((call: any) => {
            const fullCall = call.call;
            // Strip variable-length prefixes: gg_05_, OV_, SO_, etc.
            const call_id = fullCall?.replace(/^(?:gg_\d+_|OV_|SO_)/, '') || '';

            if (call_id && sendMessageNow) {
                // Look up the original line type from call_table to use matching dbl1 value
                const lineInfo = call_table[call_id];
                const lineType = lineInfo ? lineInfo[1] : 2; // Default to 2 if not found
                
                // SO_ lines always use dbl1: 1, others use their original line type
                const isShoutOverride = fullCall?.startsWith('SO_');
                const dbl1 = isShoutOverride ? 1 : lineType;
                
                console.log('[releaseBtn] Stopping call:', call_id, 'lineType:', lineType, 'dbl1:', dbl1);
                sendMessageNow({ type: 'stop', cmd1: call_id, dbl1: dbl1 });
            }
        });
    },
    toggleGg: () => {},
    toggleOver: () => {},
    ggLoud: false,
    overrideLoud: false,
    settingsEdit: () => {},
    volume: { volume: 50, setVolume: () => {} },
    playError: () => {},
    metadata: { position: '', sector: '', facilityId: '' },
    
    // Dial call state defaults
    activeDialLine: null,
    dialCallStatus: 'idle' as const,

    // IA DISPLAY area state
    iaDisplayBuffer: '',
    callerIdBuffer: '',
    setIaDisplayBuffer: (buffer: string) => set({ iaDisplayBuffer: buffer }),
    setCallerIdBuffer: (buffer: string) => set({ callerIdBuffer: buffer }),
    appendToIaDisplay: (digit: string) => {
        const current = get().iaDisplayBuffer;
        set({ iaDisplayBuffer: current + digit });
    },
    clearIaDisplay: () => set({ iaDisplayBuffer: '' }),
    backspaceIaDisplay: () => {
        const current = get().iaDisplayBuffer;
        set({ iaDisplayBuffer: current.slice(0, -1) });
    },

    // G/G Chime selection (1-13)
    selectedChime: 1,
    setSelectedChime: (chime: number) => set({ selectedChime: Math.max(1, Math.min(13, chime)) }),
    cycleChime: () => {
        const current = get().selectedChime;
        const next = current >= 13 ? 1 : current + 1;
        set({ selectedChime: next });
    },

    // Brightness controls
    brightness: 100,
    setBrightness: (brightness: number) => set({ brightness: Math.max(20, Math.min(100, brightness)) }),
    adjustBrightness: (delta: number) => {
        const current = get().brightness;
        set({ brightness: Math.max(20, Math.min(100, current + delta)) });
    },
    
        setConnected: (status: boolean) => {
            set({
                connected: status
            })
        },
        setPositionData: (data: any) => {
            set({
                positionData: data
            })
        },
        updateSelectedPositions: (poss: Position[]) => {
            set({
                selectedPositions: poss,
            })
            // Set UI context based on first selected position for audio system
            if (poss && poss.length > 0) {
                const detectedUI = setUIContextFromPosition(poss[0]);
                set({
                    currentUI: detectedUI
                });
                // Set currentConfig to null (no config on Position)
                set({ currentConfig: null });
            }
            resetWindow();
        },
        setCallsign: (call_sign: string, cid: number) => {
            set({
                callsign: call_sign,
                cid
            })
            resetWindow();
        },
        setCurrentUI: (ui: string) => {
            set({
                currentUI: ui
            })
        },
        setCurrentConfig: (config: any) => {
            set({ currentConfig: config });
        },
        setActiveDialLine: (dialLine: { trunkName: string; lineType: number } | null) => {
            set({ activeDialLine: dialLine, dialCallStatus: dialLine ? 'idle' : 'idle' });
        },
        sendDialCall: (trunkName: string, dialCode: string) => {
            const { positionData, selectedPositions } = get();
            
            // Get the current position's callsign to find the dialCodeTable
            const currentCallsign = selectedPositions?.[0]?.cs;
            if (!currentCallsign) {
                console.error('[dial_call] No current position selected');
                set({ dialCallStatus: 'error' });
                return;
            }
            
            // Find the dialCodeTable for this position
            const dialCodeTable = findDialCodeTable(positionData, currentCallsign);
            if (!dialCodeTable) {
                console.error('[dial_call] No dialCodeTable found for position:', currentCallsign);
                set({ dialCallStatus: 'error' });
                return;
            }
            
            // Resolve the dial code to a target callsign
            const target = resolveDialCode(dialCodeTable, trunkName, dialCode);
            if (!target) {
                console.error('[dial_call] Could not resolve dial code:', { trunkName, dialCode });
                set({ dialCallStatus: 'error' });
                return;
            }
            
            console.log('[dial_call] Resolved:', { trunkName, dialCode, target });
            
            // Set status to dialing, then ringback
            set({ dialCallStatus: 'dialing' });
            
            // Send the call command - use type 'call' with the resolved target
            // dbl1 = 1 for ring-type call (plays chime at destination)
            sendMessageNow({ 
                type: 'call', 
                cmd1: target,           // The resolved target callsign
                dbl1: 1                 // Call type 1 = ring call
            });
            
            // Set to ringback after a short delay (simulating call routing)
            setTimeout(() => {
                const currentStatus = get().dialCallStatus;
                if (currentStatus === 'dialing') {
                    set({ dialCallStatus: 'ringback' });
                }
            }, 200);
        }
    }

    function addCall(callType: number, cmd1: string) {
        // || document.getElementById('messageInput').value
        sendMessageNow({ type: 'add', cmd1: cmd1, dbl1: callType })
    }
    function addIaCall(callType: number, cmd1: string) {
        // || document.getElementById('messageInput').value
        sendMessageNow({ type: 'add_ia', cmd1: cmd1, dbl1: callType })
    }
    function sendMessageNow(message: any) {
        // Intercept test bench calls (call/stop messages for active test bench lineIds)
        if (message && (message.type === 'call' || message.type === 'stop' || message.type === 'hold')) {
            const tbHandler = typeof window !== 'undefined' ? (window as any).__TB_HANDLER__ : null;
            if (tbHandler?.isTestBenchCall(message.cmd1)) {
                tbHandler.handleMessage(message);
                return;
            }
        }
        if (message && socket?.readyState === WebSocket.OPEN) {
            if (typeof message === "object") {
                socket.send(JSON.stringify(message));
            } else {
                socket.send(message);
            }
        } else {
            // alert('Connection is not open or message is empty');
        }
    }
    ds.sendMessageNow = sendMessageNow;

    function resetWindow() {
        sendMessageNow({ type: 'del', cmd1: '', dbl1: 0 })
        const { callsign = '', cid = 0 } = get();
        if (!callsign) {
            return;
        }
        // Collect all lines from selected positions, preserving order
        // Track placeholder indices for empty [] entries
        const orderedLines: any[] = [];
        const placeholderPositions: number[] = [];
        const seenIds = new Set<string>();
        const { selectedPositions: selected_positions } = get();
        let positionIndex = 0;
        
        // First pass: collect lines in order from position config
        Object.values(selected_positions || {}).map((pos: any) => {
            pos.lines?.map((line: any[]) => {
                // Check if this is an empty placeholder []
                if (!line || line.length === 0) {
                    placeholderPositions.push(positionIndex);
                    positionIndex++;
                    return;
                }
                
                const lineId = String(line[0]);
                const lineType = line[1];
                // For shout lines (type 2), allow duplicates from multiple positions
                // For other types, only add if not seen before
                if (lineType === 2 || !seenIds.has(lineId)) {
                    orderedLines.push({ line, originalIndex: positionIndex });
                    positionIndex++;
                    if (lineType !== 2) {
                        seenIds.add(lineId);
                    }
                }
            })
        })
        
        // Deduplicate while preserving order (keep first occurrence)
        const dedup_ordered: any[] = [];
        const dedup_ids = new Set<string>();
        for (const item of orderedLines) {
            const lineId = String(item.line[0]);
            if (!dedup_ids.has(lineId)) {
                dedup_ordered.push(item);
                dedup_ids.add(lineId);
            }
        }
        
        call_table = {
            "891": ["TEST", 2],
        }
        // Reset and populate line_order for sorting gg_status later
        line_order = {};
        placeholder_indices = placeholderPositions;
        
        for (const item of dedup_ordered) {
            const line = item.line;
            call_table[line[0]] = [line[2], line[1]]
            line_order[String(line[0])] = item.originalIndex;
            addCall(line[1], '' + line[0])
        }
        // TEST line comes after all configured lines
        line_order["891"] = positionIndex++;
        addCall(2, '891')
        cid && addIaCall(1, '' + cid)
        setTimeout(() => {
            sendMessageNow({ type: 'sync' })
        }, 4000)
    }
    setInterval(() => {
        if (!socket) {
            connect()
        }
    }, 1000)

    const debounce_set = debounce(set, 50)
    function connect() {
        const wsUrl = 'ws://localhost:9002';
        try {
            socket = new WebSocket(wsUrl);
        } catch (err) {
            console.error('WebSocket connection threw an exception:', err, 'URL:', wsUrl);
            socket = null;
            return;
        }
        socket.onopen = () => {
            ds.setConnected(true)
            // Request sync immediately to get call_sign/cid for auto-detection
            console.log('[WebSocket] Connected, sending sync request');
            sendMessageNow({ type: 'sync' })
        };
        socket.onerror = (error) => {
            console.error('WebSocket error:', error, 'URL:', wsUrl);
            socket = null
        };

        socket.onclose = () => {
            ds.setConnected(false)
            socket = null
        };

    let ringback_interval: any = null;
        socket.onmessage = (event) => {
            // Log all incoming WebSocket messages for debugging
            console.log('[WebSocket RAW]', event.data);
            
            if (event.data === 'PttOpen') {
                set({ ptt: true })
                return
            } else if (event.data === 'PttClosed') {
                set({ ptt: false })
                return
            } else {
                // document.getElementById('chatLog').innerHTML += `<div>${event.data}</div>`;
            }
            try {
                const data = JSON.parse(event.data)
                // Log parsed JSON messages with type info
                console.log('[WebSocket MSG]', data.type, data);
                if (data.type === 'message') {
                    // document.getElementById('chatLog').innerHTML += `<div>${data.cmd1}</div>`;
                } else if (data.type === 'version') {
                    set({ afv_version: data.cmd1 })
                } else if (data.type === 'call') {
                    if (data.cmd1 === 'connected') {
            try { getAudioElement('ringback')?.pause?.(); } catch {}
            clearInterval(ringback_interval)
                    } else if (data.cmd1 === 'terminated') {
            try { getAudioElement('ringback')?.pause?.(); } catch {}
            clearInterval(ringback_interval)
                    }
                    // document.getElementById('callStatus').innerText = data.cmd1
                } else if (data.type === 'channel_status') {
                    const cns = data.data as any[];
                    const new_ag: any[] = []
                    const new_gg: any[] = []
                    const new_vscs: any[] = []
                    const new_override: any[] = [] // Track OV_ prefixed calls
            cns.map((k: any) => {
                        if (k.call === 'A/G') {
                            new_ag.push({ ...k })
                        } else if (k.call?.startsWith('VSCS_')) {
                            // Handle VSCS buttons - similar to G/G processing
                            const vscs_call_id = k.call?.substring(5);
                            k.call_name = call_table[vscs_call_id]?.[0] || vscs_call_id
                            k.lineType = call_table[vscs_call_id]?.[1] ?? 2; // Default to type 2 (regular)
                            new_vscs.push({ ...k })
                        } else if (k.call?.startsWith('OV_')) {
                            // Handle incoming override calls - OV_ prefix indicates this position is being overridden
                            console.log('[WebSocket] Override call detected:', k);
                            const call_id = k.call?.substring(3);
                            k.call_name = call_table[call_id]?.[0] || call_id
                            k.lineType = call_table[call_id]?.[1] ?? 0; // Override defaults to type 0
                            new_override.push({ ...k })
                            // Also add to G/G list for button display
                            new_gg.push({ ...k })
                        } else {
                            const call_id = k.call?.substring(3);
                            k.call_name = call_table[call_id]?.[0]
                            k.lineType = call_table[call_id]?.[1] ?? 2; // Default to type 2 (regular)
                            new_gg.push({ ...k })
                            if (k.call?.startsWith('SO_')) {

                            } else {
                                if (k.status === 'chime') {
                                    chime(getAudioElement('ggchime'));
                                    // For dial lines (type 3), show caller ID from who's calling us
                                    if (k.lineType === 3 && k.otherPosition) {
                                        set({ callerIdBuffer: k.otherPosition });
                                    }
                                } else if (k.status == 'ringing') {
                                    chime(getAudioElement('ringback'))
                                } else {
                                    stopAudio();
                                    // Clear caller ID when call ends or connects
                                    if (k.lineType === 3) {
                                        set({ callerIdBuffer: '' });
                                    }
                                }
                            }
                        }
                    })
                    
                    // Check if there's an active or held override (OV_ call)
                    const hasActiveOverride = new_override.some((ov: any) =>
                        ov.status === 'ok' || ov.status === 'active' || ov.status === 'hold'
                    );
                    const overrideCallStatus = new_override.length > 0 ? new_override[0].status : 'off';

                    debounce_set({
                        ag_status: new_ag,
                        gg_status: new_gg,
                        vscs_status: new_vscs,
                        overrideStatus: new_override,
                        isBeingOverridden: hasActiveOverride,
                        overrideCallStatus,
                    })
                } else if (data.type === 'call_sign') {
            console.log('[WebSocket] Received call_sign:', data.cmd1, 'CID:', data.dbl1);
            ds.setCallsign(data.cmd1, data.dbl1)
                } else if (data.type === 'call_begin' || data.type === 'call_end') {
                    const { ag_status } = get()
                    const call = data.data?.[0]
                    if (call) {
            const new_ag = ag_status.map((ag: any) => {
                            if (call.freq === ag.freq) {
                                return {
                                    ...ag,
                                    talking: data.type === 'call_begin'
                                }
                            }
                            return ag
                        })
                        set({
                            ag_status: new_ag
                        })
                    }

                } else if (data.type === 'dial_call_status') {
                    // Handle dial call status updates from backend
                    const status = data.cmd1 as 'dialing' | 'ringback' | 'connected' | 'busy' | 'error' | 'idle';
                    console.log('[dial_call] Status update:', status);
                    set({ dialCallStatus: status });
                    
                    // Handle audio cues based on dial call status
                    if (status === 'ringback') {
                        chime(getAudioElement('ringback'));
                    } else if (status === 'connected' || status === 'idle') {
                        stopAudio();
                        // Clear the active dial line when connected or idle
                        if (status === 'connected') {
                            set({ activeDialLine: null });
                        }
                    } else if (status === 'busy' || status === 'error') {
                        stopAudio();
                        // Play error tone if available
                    }
                }
                return
            }
            catch (ex) {
                console.log(ex)
            }
        };
    }
    return ds
})