import { create } from 'zustand'
interface Position {
    cs: string;
    pos: string;
    freq: number;
    rn: string;
    lines: any[];
}

export interface Facility {
    childFacilities: Facility[];
    id: string;
    name: string;
    positions: Position[];
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
}

let call_table: Record<string, [string, number]> = {}

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
function getAudioElement(audioType: 'ringback' | 'ggchime'): HTMLAudioElement | null {
    if (typeof document === 'undefined') return null;
    
    const uiContext = getCurrentUIContext();
    const config = audioConfigs[uiContext];
    
    // Fallback to VSCS config if current UI config not found
    const defaultConfig = audioConfigs.vscs || { ringback: 'Ringback.wav', ggchime: 'GGChime.mp3' };
    const audioSrc = config ? config[audioType] : defaultConfig[audioType];
    
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
    
    console.log('Setting UI context from position:', detectedUI, position);
    
    // Refresh audio elements with new context
    refreshAudioElements();
    
    return detectedUI;
}

function stopAudio() {
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
    let timeoutId: number | null = null;
    return (...args: Parameters<T>) => {
        if (timeoutId) window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
            callback(...args);
        }, wait);
    };
}

function chime(audio: HTMLAudioElement | null | undefined) {
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
    sendMessageNow: () => {},
    // VSCS-specific props (default implementations)
    activeLandlines: [],
    incomingLandlines: [],
    outgoingLandlines: [],
    heldLandlines: [],
    buttonPress: () => {},
    holdBtn: () => {},
    releaseBtn: () => {},
    toggleGg: () => {},
    toggleOver: () => {},
    ggLoud: false,
    overrideLoud: false,
    settingsEdit: () => {},
    volume: { volume: 50, setVolume: () => {} },
    playError: () => {},
    metadata: { position: '', sector: '', facilityId: '' },
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
            console.log('[model] updateSelectedPositions called with:', poss);
            set({
                selectedPositions: poss,
            })
            // Set UI context based on first selected position for audio system
            if (poss && poss.length > 0) {
                const detectedUI = setUIContextFromPosition(poss[0]);
                console.log('[model] set currentUI from position:', detectedUI);
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
            console.log('[model] setCurrentUI called with:', ui);
            set({
                currentUI: ui
            })
        },
        setCurrentConfig: (config: any) => {
            set({ currentConfig: config });
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
    const lines: Record<string, any[]> = {}
        const { selectedPositions: selected_positions } = get();
        Object.values(selected_positions || {}).map((pos: any) => {
            pos.lines?.map((line: any[]) => {
        (lines[line[0]] ||= []).push(line)
            })
        })
        const dedup_dest: Record<string, any> = {}
        const available_lines = Object.values(lines || {}).filter((k: any[]) => {
            return k.length == 1 || k[0][1] == 2
        }).map((k: any[]) => {
            const v = k[0]
            dedup_dest[v[2]] = v
        })
        call_table = {
            "891": ["TEST", 2],
        }
        for (const line of Object.values(dedup_dest) as any[]) {
            call_table[line[0]] = [line[2], line[1]]
            addCall(line[1], '' + line[0])
        }
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
            cns.map((k: any) => {
                        if (k.call === 'A/G') {
                            new_ag.push({ ...k })
                        } else if (k.call?.startsWith('VSCS_')) {
                            // Handle VSCS buttons - similar to G/G processing
                            k.call_name = call_table[k.call?.substring(5)]?.[0] || k.call?.substring(5)
                            new_vscs.push({ ...k })
                        } else {
                k.call_name = call_table[k.call?.substring(3)]?.[0]
                            new_gg.push({ ...k })
                            if (k.call?.startsWith('SO_')) {

                            } else {
                                if (k.status === 'chime') {
                                    chime(getAudioElement('ggchime'));
                                } else if (k.status == 'ringing') {
                                    chime(getAudioElement('ringback'))
                                } else {
                                    stopAudio();
                                }
                            }
                        }
                    })
                    debounce_set({
                        ag_status: new_ag,
                        gg_status: new_gg,
                        vscs_status: new_vscs,
                    })
                } else if (data.type === 'call_sign') {
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