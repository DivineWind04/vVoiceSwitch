"use client";

import { useState } from 'react';
import { useCoreStore } from '../model';
import { useTestBenchStore } from './TestBenchStore';
import type { TestCall } from './TestBenchStore';
import {
    startIncomingCall,
    answerCall,
    setBusy,
    noAnswer,
    holdCall,
    resumeCall,
    endTestCall,
    endAllTestCalls,
} from './testBenchInjector';

const LINE_TYPE_LABELS: Record<number, string> = {
    0: 'OVR',
    1: 'RING',
    2: 'SHOUT',
};

const LINE_TYPE_COLORS: Record<number, string> = {
    0: '#ef4444', // red
    1: '#3b82f6', // blue
    2: '#22c55e', // green
};

const STATUS_LABELS: Record<string, string> = {
    idle: 'Idle',
    chime: 'Ringing In',
    ringing: 'Ringing Out',
    ok: 'Connected',
    active: 'Active',
    hold: 'On Hold',
    busy: 'Busy',
    terminated: 'Ended',
};

const STATUS_COLORS: Record<string, string> = {
    chime: '#ca8a04',
    ringing: '#ca8a04',
    ok: '#16a34a',
    active: '#16a34a',
    hold: '#d97706',
    busy: '#dc2626',
    terminated: '#52525b',
};

// Small reusable button
function ActionBtn({ label, color, onClick, small }: {
    label: string; color: string; onClick: () => void; small?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: small ? '2px 6px' : '3px 10px',
                background: color,
                border: 'none',
                borderRadius: 3,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 10,
                fontFamily: 'Consolas, monospace',
                fontWeight: 600,
                whiteSpace: 'nowrap',
            }}
        >
            {label}
        </button>
    );
}

// Renders the context-appropriate action buttons for a call
function CallActions({ call }: { call: TestCall }) {
    const s = call.status;

    // Incoming call ringing (chime) - test bench can simulate: no answer / busy
    // The user answers/rejects via the actual UI button (intercepted)
    if (s === 'chime') {
        return (
            <div style={{ display: 'flex', gap: 4 }}>
                <ActionBtn label="No Answer" color="#71717a" onClick={() => noAnswer(call.id)} />
                <ActionBtn label="End" color="#dc2626" onClick={() => endTestCall(call.id)} />
            </div>
        );
    }

    // Outgoing call ringing - test bench simulates remote side behavior
    if (s === 'ringing') {
        return (
            <div style={{ display: 'flex', gap: 4 }}>
                <ActionBtn label="Answer" color="#16a34a" onClick={() => answerCall(call.id)} />
                <ActionBtn label="Busy" color="#ca8a04" onClick={() => setBusy(call.id)} />
                <ActionBtn label="No Answer" color="#71717a" onClick={() => noAnswer(call.id)} />
            </div>
        );
    }

    // Connected call - can hold or end
    if (s === 'ok' || s === 'active') {
        return (
            <div style={{ display: 'flex', gap: 4 }}>
                {call.lineType !== 0 && (
                    <ActionBtn label="Hold" color="#d97706" onClick={() => holdCall(call.id)} />
                )}
                <ActionBtn label="End" color="#dc2626" onClick={() => endTestCall(call.id)} />
            </div>
        );
    }

    // On hold - can resume or end
    if (s === 'hold') {
        return (
            <div style={{ display: 'flex', gap: 4 }}>
                <ActionBtn label="Resume" color="#16a34a" onClick={() => resumeCall(call.id)} />
                <ActionBtn label="End" color="#dc2626" onClick={() => endTestCall(call.id)} />
            </div>
        );
    }

    // Busy - can only end (clear)
    if (s === 'busy') {
        return (
            <div style={{ display: 'flex', gap: 4 }}>
                <ActionBtn label="Clear" color="#71717a" onClick={() => endTestCall(call.id)} />
            </div>
        );
    }

    return <ActionBtn label="End" color="#dc2626" onClick={() => endTestCall(call.id)} />;
}

export default function TestBenchPanel() {
    const [selectedLineIdx, setSelectedLineIdx] = useState<number>(0);
    const selectedPositions = useCoreStore(s => s.selectedPositions);
    const activeTestCalls = useTestBenchStore(s => s.activeTestCalls);

    // Get lines from the first selected position
    const lines: [string, number, string][] = selectedPositions?.[0]?.lines || [];
    const activeCalls = activeTestCalls.filter(c => c.status !== 'terminated');

    const handleStartCall = () => {
        if (lines.length === 0) return;
        const [lineId, lineType, label] = lines[selectedLineIdx] || lines[0];

        // Check if there's already an active test call on this line
        const existing = activeTestCalls.find(c => c.lineId === lineId && c.status !== 'terminated');
        if (existing) return;

        startIncomingCall(lineId, lineType, label);
    };

    const hasPosition = selectedPositions && selectedPositions.length > 0;

    return (
        <div style={{
            width: 340,
            maxHeight: '70vh',
            overflow: 'auto',
            background: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: 8,
            color: '#e4e4e7',
            fontFamily: 'Consolas, monospace',
            fontSize: 13,
        }}>
            {/* Header */}
            <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid #3f3f46',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Call Test Bench</span>
                <button
                    onClick={() => useTestBenchStore.getState().setOpen(false)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#a1a1aa',
                        cursor: 'pointer',
                        fontSize: 16,
                        padding: '0 4px',
                    }}
                >
                    ✕
                </button>
            </div>

            {/* No position selected */}
            {!hasPosition && (
                <div style={{ padding: '20px 14px', textAlign: 'center', color: '#71717a' }}>
                    Select a position first to use the test bench.
                </div>
            )}

            {hasPosition && (
                <>
                    {/* === CALL STATUS SECTION === */}
                    {activeCalls.length > 0 && (
                        <div style={{
                            padding: '8px 14px',
                            borderBottom: '1px solid #27272a',
                        }}>
                            <div style={{
                                fontSize: 11,
                                color: '#71717a',
                                marginBottom: 6,
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                            }}>
                                Active Calls
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {activeCalls.map(call => (
                                    <div
                                        key={call.id}
                                        style={{
                                            background: '#27272a',
                                            borderRadius: 4,
                                            borderLeft: `3px solid ${LINE_TYPE_COLORS[call.lineType] || '#52525b'}`,
                                            padding: '6px 8px',
                                        }}
                                    >
                                        {/* Top row: direction, label, type, status */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            marginBottom: 4,
                                        }}>
                                            <span style={{ fontSize: 11, color: '#a1a1aa' }}>
                                                {call.direction === 'incoming' ? 'IN' : 'OUT'}
                                            </span>
                                            <span style={{
                                                fontSize: 9,
                                                fontWeight: 700,
                                                padding: '0px 4px',
                                                borderRadius: 2,
                                                background: LINE_TYPE_COLORS[call.lineType] || '#52525b',
                                                color: '#fff',
                                            }}>
                                                {LINE_TYPE_LABELS[call.lineType] || `T${call.lineType}`}
                                            </span>
                                            <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>
                                                {call.label}
                                            </span>
                                            <span style={{
                                                fontSize: 10,
                                                padding: '1px 6px',
                                                borderRadius: 3,
                                                background: STATUS_COLORS[call.status] || '#52525b',
                                                color: '#fff',
                                            }}>
                                                {STATUS_LABELS[call.status] || call.status}
                                            </span>
                                        </div>
                                        {/* Bottom row: action buttons */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <CallActions call={call} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* End All button */}
                            {activeCalls.length > 1 && (
                                <button
                                    onClick={endAllTestCalls}
                                    style={{
                                        width: '100%',
                                        marginTop: 6,
                                        padding: '5px 0',
                                        background: '#7f1d1d',
                                        border: '1px solid #991b1b',
                                        borderRadius: 4,
                                        color: '#fca5a5',
                                        cursor: 'pointer',
                                        fontSize: 11,
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    End All Calls
                                </button>
                            )}
                        </div>
                    )}

                    {/* === INITIATE INCOMING CALL === */}
                    <div style={{ padding: '8px 14px' }}>
                        <div style={{
                            fontSize: 11,
                            color: '#71717a',
                            marginBottom: 6,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                        }}>
                            Simulate Incoming Call
                        </div>

                        {/* Line dropdown + call button */}
                        <div style={{ display: 'flex', gap: 6 }}>
                            <select
                                value={selectedLineIdx}
                                onChange={e => setSelectedLineIdx(Number(e.target.value))}
                                style={{
                                    flex: 1,
                                    padding: '5px 8px',
                                    background: '#27272a',
                                    border: '1px solid #52525b',
                                    borderRadius: 4,
                                    color: '#e4e4e7',
                                    fontSize: 12,
                                    fontFamily: 'Consolas, monospace',
                                    cursor: 'pointer',
                                    appearance: 'auto',
                                }}
                                disabled={lines.length === 0}
                            >
                                {lines.length === 0 && (
                                    <option value={0}>No lines configured</option>
                                )}
                                {lines.map(([lineId, lineType, label], idx) => (
                                    <option key={lineId} value={idx}>
                                        {LINE_TYPE_LABELS[lineType] || `T${lineType}`} - {label} ({lineId})
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={handleStartCall}
                                disabled={lines.length === 0 || (
                                    lines[selectedLineIdx] &&
                                    activeTestCalls.some(c =>
                                        c.lineId === lines[selectedLineIdx][0] && c.status !== 'terminated'
                                    )
                                )}
                                style={{
                                    padding: '5px 14px',
                                    background: lines.length === 0 ? '#3f3f46' : '#16a34a',
                                    border: 'none',
                                    borderRadius: 4,
                                    color: lines.length === 0 ? '#71717a' : '#fff',
                                    cursor: lines.length === 0 ? 'default' : 'pointer',
                                    fontSize: 12,
                                    fontFamily: 'inherit',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                Call
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
