import { useCoreStore, chime as chimeAudio, stopAudio as stopMainAudio, getAudioElement } from '../model';
import { useTestBenchStore, generateTestCallId } from './TestBenchStore';
import type { TestCall } from './TestBenchStore';

// Module-level maps for audio elements and timers (kept out of Zustand for serialization safety)
const audioElements = new Map<string, HTMLAudioElement>();
const autoAdvanceTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Returns the real call prefix based on line type
function getCallPrefix(lineType: number): string {
    switch (lineType) {
        case 0: return 'OV_';   // Override
        case 1: return 'gg_05_'; // Ring
        case 2: return 'SO_';   // Shout
        default: return 'gg_05_';
    }
}

// Build the full prefixed call ID as the real system would
function buildCallId(lineType: number, lineId: string): string {
    return getCallPrefix(lineType) + lineId;
}

// Guard flag to prevent re-injection loops
let reinjecting = false;

// Inject current test calls into the main store's gg_status
function injectTestCalls(): void {
    reinjecting = true;

    const testCalls = useTestBenchStore.getState().activeTestCalls;
    const coreState = useCoreStore.getState();
    const currentGG = coreState.gg_status || [];

    // Build set of active test call IDs for filtering
    const testCallIds = new Set(
        testCalls
            .filter(tc => tc.status !== 'terminated' && tc.status !== 'idle')
            .map(tc => buildCallId(tc.lineType, tc.lineId))
    );

    // Remove any existing entries that match our test call IDs
    const cleanedGG = currentGG.filter((g: any) => !testCallIds.has(g.call));

    // Build synthetic entries for active test calls
    const syntheticEntries = testCalls
        .filter(tc => tc.status !== 'terminated' && tc.status !== 'idle')
        .map(tc => ({
            call: buildCallId(tc.lineType, tc.lineId),
            call_name: tc.label,
            status: tc.status,
        }));

    const mergedGG = [...cleanedGG, ...syntheticEntries];

    // Also handle override status tracking
    const overrideEntries = syntheticEntries.filter(e => e.call.startsWith('OV_'));
    const currentOverrides = (coreState.overrideStatus || []).filter(
        (ov: any) => !testCallIds.has(ov.call)
    );
    const mergedOverrides = [...currentOverrides, ...overrideEntries];
    const hasActiveOverride = mergedOverrides.some(
        (ov: any) => ov.status === 'ok' || ov.status === 'active' || ov.status === 'hold'
    );
    const overrideCallStatus = mergedOverrides.length > 0 ? mergedOverrides[0].status : 'off';

    useCoreStore.setState({
        gg_status: mergedGG,
        overrideStatus: mergedOverrides,
        isBeingOverridden: hasActiveOverride,
        overrideCallStatus,
    });

    // Reset flag on next microtask to allow future injections
    Promise.resolve().then(() => { reinjecting = false; });
}

// Play test audio on a connected call
function playTestAudio(callId: string): void {
    // Stop any existing audio for this call first
    stopTestAudio(callId);

    const audio = new Audio('/testbench/Test_Audio.mp3');
    audio.loop = true;
    audio.play().catch(() => {});
    audioElements.set(callId, audio);
}

// Play override termination tone on an override call
function playOverrideAudio(callId: string): void {
    stopTestAudio(callId);

    const audio = new Audio('/rdvs/Override_Term.wav');
    audio.loop = false;
    audio.play().catch(() => {});
    audioElements.set(callId, audio);
}

// Stop test audio for a call
function stopTestAudio(callId: string): void {
    const audio = audioElements.get(callId);
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audioElements.delete(callId);
    }
}

// Clean up timer for a call
function clearAutoAdvanceTimer(callId: string): void {
    const timer = autoAdvanceTimers.get(callId);
    if (timer) {
        clearTimeout(timer);
        autoAdvanceTimers.delete(callId);
    }
}

// Handle audio cues when a test call status changes
function handleTestCallAudio(callId: string, newStatus: string, lineType?: number): void {
    if (newStatus === 'chime') {
        chimeAudio(getAudioElement('ggchime'));
    } else if (newStatus === 'ringing') {
        chimeAudio(getAudioElement('ringback'));
    } else if (newStatus === 'ok' || newStatus === 'active') {
        stopMainAudio();
        // Override calls (lineType 0) play Override_Term.wav instead of test audio
        if (lineType === 0) {
            playOverrideAudio(callId);
        } else {
            playTestAudio(callId);
        }
    } else if (newStatus === 'hold') {
        // On hold: stop test audio but don't stop system audio
        stopTestAudio(callId);
    } else {
        stopMainAudio();
        stopTestAudio(callId);
    }
}

// Helper to update a call's status, handle audio, and re-inject
function transitionCall(callId: string, newStatus: TestCall['status']): void {
    const call = useTestBenchStore.getState().activeTestCalls.find(c => c.id === callId);
    if (!call) return;

    useTestBenchStore.getState().updateTestCall(callId, { status: newStatus });
    handleTestCallAudio(callId, newStatus, call.lineType);
    injectTestCalls();
}

// --- Public API: Call initiation ---

// Start an incoming test call
export function startIncomingCall(lineId: string, lineType: number, label: string): void {
    const id = generateTestCallId();

    // Override calls connect immediately (status 'ok')
    // Ring/Shout calls start with 'chime' and wait for user to answer
    const initialStatus = lineType === 0 ? 'ok' : 'chime';

    const testCall: TestCall = {
        id,
        lineId,
        lineType,
        label,
        status: initialStatus as TestCall['status'],
        direction: 'incoming',
        startedAt: Date.now(),
    };

    useTestBenchStore.getState().addTestCall(testCall);
    handleTestCallAudio(id, initialStatus, lineType);
    injectTestCalls();
}

// Start an outgoing test call (simulates the user dialing out)
export function startOutgoingCall(lineId: string, lineType: number, label: string): void {
    const id = generateTestCallId();

    const testCall: TestCall = {
        id,
        lineId,
        lineType,
        label,
        status: 'ringing',
        direction: 'outgoing',
        startedAt: Date.now(),
    };

    useTestBenchStore.getState().addTestCall(testCall);
    handleTestCallAudio(id, 'ringing', lineType);
    injectTestCalls();
}

// --- Public API: Call lifecycle transitions (controlled from test bench panel) ---

// Remote answers an outgoing call (ringing -> ok)
export function answerCall(callId: string): void {
    clearAutoAdvanceTimer(callId);
    transitionCall(callId, 'ok');
}

// Remote is busy (ringing -> busy)
export function setBusy(callId: string): void {
    clearAutoAdvanceTimer(callId);
    transitionCall(callId, 'busy');
}

// No answer / ring timeout (ringing or chime -> terminated, then remove)
export function noAnswer(callId: string): void {
    clearAutoAdvanceTimer(callId);
    stopTestAudio(callId);
    stopMainAudio();
    useTestBenchStore.getState().removeTestCall(callId);
    injectTestCalls();
}

// Put a connected call on hold (ok/active -> hold)
export function holdCall(callId: string): void {
    transitionCall(callId, 'hold');
}

// Resume a held call (hold -> ok)
export function resumeCall(callId: string): void {
    transitionCall(callId, 'ok');
}

// End a specific test call (any state -> removed)
export function endTestCall(callId: string): void {
    // Look up the call's prefixed ID before removing, so we can clean it from gg_status
    const call = useTestBenchStore.getState().activeTestCalls.find(c => c.id === callId);
    const prefixedId = call ? buildCallId(call.lineType, call.lineId) : null;

    stopTestAudio(callId);
    stopMainAudio();
    clearAutoAdvanceTimer(callId);
    useTestBenchStore.getState().removeTestCall(callId);

    // Explicitly remove the stale entry from gg_status before re-injecting
    if (prefixedId) {
        const coreState = useCoreStore.getState();
        const cleanedGG = (coreState.gg_status || []).filter((g: any) => g.call !== prefixedId);
        const cleanedOverrides = (coreState.overrideStatus || []).filter((ov: any) => ov.call !== prefixedId);
        const hasActiveOverride = cleanedOverrides.some(
            (ov: any) => ov.status === 'ok' || ov.status === 'active' || ov.status === 'hold'
        );
        const overrideCallStatus = cleanedOverrides.length > 0 ? cleanedOverrides[0].status : 'off';
        useCoreStore.setState({
            gg_status: cleanedGG,
            overrideStatus: cleanedOverrides,
            isBeingOverridden: hasActiveOverride,
            overrideCallStatus,
        });
    }

    injectTestCalls();
}

// End all test calls
export function endAllTestCalls(): void {
    const calls = useTestBenchStore.getState().activeTestCalls;
    calls.forEach(call => {
        stopTestAudio(call.id);
        clearAutoAdvanceTimer(call.id);
    });
    stopMainAudio();
    useTestBenchStore.getState().clearAllTestCalls();
    injectTestCalls();
}

// --- Message interception (handles UI button clicks on test bench calls) ---

function handleInterceptedMessage(message: any): void {
    const lineId = message.cmd1;
    const calls = useTestBenchStore.getState().activeTestCalls;
    const call = calls.find(c => c.lineId === lineId && c.status !== 'terminated');

    if (!call) {
        // No active call — if this is a 'call' message, it's an outgoing call initiation
        if (message.type === 'call') {
            // Look up line info from the configured position
            const selectedPositions = useCoreStore.getState().selectedPositions;
            const lines: [string, number, string][] = selectedPositions?.[0]?.lines || [];
            const lineInfo = lines.find(([id]) => id === lineId);
            if (lineInfo) {
                const [, lineType, label] = lineInfo;
                // Override lines connect immediately (same as incoming overrides)
                if (lineType === 0) {
                    startIncomingCall(lineId, lineType, label);
                } else {
                    startOutgoingCall(lineId, lineType, label);
                }
            }
        }
        return;
    }

    if (message.type === 'call') {
        // User is answering/activating a call via the UI button
        if (call.status === 'chime' || call.status === 'ringing') {
            // Answer the call
            clearAutoAdvanceTimer(call.id);
            transitionCall(call.id, 'ok');
        } else if (call.status === 'hold') {
            // Resume a held call (RECON or DA button press)
            transitionCall(call.id, 'ok');
        }
    } else if (message.type === 'hold') {
        // User pressed HOLD via the UI
        if (call.status === 'ok' || call.status === 'active') {
            transitionCall(call.id, 'hold');
        }
    } else if (message.type === 'stop') {
        // User is hanging up via the UI button
        endTestCall(call.id);
    }
}

// Check if a lineId belongs to an active test bench call or a configured test bench line
function isTestBenchCall(lineId: string): boolean {
    // First check active calls
    const activeLineIds = useTestBenchStore.getState().getActiveLineIds();
    if (activeLineIds.has(lineId)) return true;

    // Also check if the test bench panel is open and this line is configured on the position
    // This allows intercepting outgoing calls initiated by DA button clicks
    const isOpen = useTestBenchStore.getState().isOpen;
    if (isOpen) {
        const selectedPositions = useCoreStore.getState().selectedPositions;
        const lines: [string, number, string][] = selectedPositions?.[0]?.lines || [];
        return lines.some(([id]) => id === lineId);
    }

    return false;
}

// Register the test bench handler on window for sendMessageNow interception
export function registerHandler(): void {
    if (typeof window !== 'undefined') {
        (window as any).__TB_HANDLER__ = {
            isTestBenchCall,
            handleMessage: handleInterceptedMessage,
        };
    }
}

// Unregister the handler
export function unregisterHandler(): void {
    if (typeof window !== 'undefined') {
        delete (window as any).__TB_HANDLER__;
    }
}

// Subscribe to store changes and re-inject if test calls get wiped by channel_status
let unsubscribe: (() => void) | null = null;

export function startReinjectionWatcher(): void {
    if (unsubscribe) return;

    unsubscribe = useCoreStore.subscribe((state, prevState) => {
        // Skip if we're already in the middle of an injection (prevents loop)
        if (reinjecting) return;

        // Only re-inject if gg_status changed and we have active test calls
        if (state.gg_status === prevState.gg_status) return;

        const testCalls = useTestBenchStore.getState().activeTestCalls;
        const activeTestCalls = testCalls.filter(tc => tc.status !== 'terminated' && tc.status !== 'idle');
        if (activeTestCalls.length === 0) return;

        // Check if any of our test call entries are missing
        const currentCallIds = new Set((state.gg_status || []).map((g: any) => g.call));
        const missingTest = activeTestCalls.some(tc => {
            const expectedCallId = buildCallId(tc.lineType, tc.lineId);
            return !currentCallIds.has(expectedCallId);
        });

        if (missingTest) {
            // Re-inject - a real channel_status wiped our entries
            injectTestCalls();
        }
    });
}

export function stopReinjectionWatcher(): void {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
}
