import { create } from 'zustand';

export interface TestCall {
    id: string;
    lineId: string;
    lineType: number; // 0=Override, 1=Ring, 2=Shout
    label: string;
    status: 'idle' | 'chime' | 'ringing' | 'ok' | 'active' | 'hold' | 'busy' | 'terminated';
    direction: 'incoming' | 'outgoing';
    startedAt: number;
}

interface TestBenchState {
    isOpen: boolean;
    activeTestCalls: TestCall[];

    togglePanel: () => void;
    setOpen: (open: boolean) => void;
    addTestCall: (call: TestCall) => void;
    updateTestCall: (id: string, updates: Partial<TestCall>) => void;
    removeTestCall: (id: string) => void;
    clearAllTestCalls: () => void;
    getActiveLineIds: () => Set<string>;
}

let callCounter = 0;
export function generateTestCallId(): string {
    return `tb_${Date.now()}_${++callCounter}`;
}

export const useTestBenchStore = create<TestBenchState>((set, get) => ({
    isOpen: false,
    activeTestCalls: [],

    togglePanel: () => set(s => ({ isOpen: !s.isOpen })),
    setOpen: (open: boolean) => set({ isOpen: open }),

    addTestCall: (call: TestCall) => set(s => ({
        activeTestCalls: [...s.activeTestCalls, call]
    })),

    updateTestCall: (id: string, updates: Partial<TestCall>) => set(s => ({
        activeTestCalls: s.activeTestCalls.map(c =>
            c.id === id ? { ...c, ...updates } : c
        )
    })),

    removeTestCall: (id: string) => set(s => ({
        activeTestCalls: s.activeTestCalls.filter(c => c.id !== id)
    })),

    clearAllTestCalls: () => set({ activeTestCalls: [] }),

    getActiveLineIds: () => {
        const calls = get().activeTestCalls;
        return new Set(calls.filter(c => c.status !== 'terminated').map(c => c.lineId));
    },
}));
