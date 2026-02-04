import { create } from 'zustand';
import type { Facility, Position } from '../src/types/vatlines_types';

interface CoreState {
    connected: boolean;
    afv_version: string;
    ptt: boolean;
    cid: number;
    positionData: Facility;
    callsign: string;
    selectedPositions: Position[];

    ag_status: any[];
    gg_status: any[];
    vscs_status: any[];

    setPositionData: (data: Facility) => void;
    setConnected: (status: boolean) => void;
    updateSelectedPositions: (poss: Position[]) => void;
    setCallsign: (call_sign: string, cid: number) => void;
    sendMessageNow: (data: any) => void;
}

let call_table: Record<string, [string, number]> = {}
let line_order: Record<string, number> = {} // Track original line order for sorting
let placeholder_indices: number[] = [] // Track indices where empty placeholder buttons should appear

// Guard DOM access for Next.js SSR safety
const ringback_audio: HTMLAudioElement | null =
    typeof document !== 'undefined' ? (document.getElementById('ringback') as HTMLAudioElement | null) : null;
const ggchime_audio: HTMLAudioElement | null =
    typeof document !== 'undefined' ? (document.getElementById('ggchime') as HTMLAudioElement | null) : null;

function stopAudio() {
    try {
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
    positionData: { childFacilities: [], facilityId: '', positions: [], editors: [], createdAt: new Date(), updatedAt: new Date(), deletedAt: new Date(), parentFacility: null },
        selectedPositions: [],

        ag_status: [],
    gg_status: [],
    vscs_status: [],
    sendMessageNow: () => {},
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
            resetWindow();
        },
    setCallsign: (call_sign: string, cid: number) => {
            set({
                callsign: call_sign,
                cid
            })
            resetWindow();
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
            try { ringback_audio?.pause?.(); } catch {}
            clearInterval(ringback_interval)
                    } else if (data.cmd1 === 'terminated') {
            try { ringback_audio?.pause?.(); } catch {}
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
                            const vscs_call_id = k.call?.substring(5);
                            k.call_name = call_table[vscs_call_id]?.[0] || vscs_call_id
                            k.lineType = call_table[vscs_call_id]?.[1] ?? 2; // Default to type 2 (regular)
                            new_vscs.push({ ...k })
                        } else {
                            const call_id = k.call?.substring(3);
                            k.call_name = call_table[call_id]?.[0]
                            k.lineType = call_table[call_id]?.[1] ?? 2; // Default to type 2 (regular)
                            new_gg.push({ ...k })
                            if (k.call?.startsWith('SO_')) {

                            } else {
                                if (k.status === 'chime') {
                                    chime(ggchime_audio);
                                } else if (k.status == 'ringing') {
                                    chime(ringback_audio)
                                } else {
                                    stopAudio();
                                }
                            }
                        }
                    })
                    
                    // Sort gg_status based on original line order from config
                    new_gg.sort((a: any, b: any) => {
                        const aId = a.call?.substring(3) || '';
                        const bId = b.call?.substring(3) || '';
                        const aOrder = line_order[aId] ?? 9999;
                        const bOrder = line_order[bId] ?? 9999;
                        return aOrder - bOrder;
                    });
                    
                    // Insert placeholder objects at the correct indices for empty [] entries
                    for (const placeholderIdx of placeholder_indices) {
                        new_gg.splice(placeholderIdx, 0, { isPlaceholder: true });
                    }
                    
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
                            else if (data.type === 'facility') {
                                ds.setPositionData(data.data);
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