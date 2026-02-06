"use client";

import { useState, useEffect } from 'react';
import { useTestBenchStore } from './TestBenchStore';
import { registerHandler, unregisterHandler, startReinjectionWatcher, stopReinjectionWatcher } from './testBenchInjector';
import TestBenchPanel from './TestBenchPanel';

export default function TestBenchIcon() {
    const [isAvailable, setIsAvailable] = useState(false);
    const isOpen = useTestBenchStore(s => s.isOpen);
    const togglePanel = useTestBenchStore(s => s.togglePanel);

    useEffect(() => {
        // Only show on localhost
        const hostname = window.location.hostname;
        setIsAvailable(
            hostname === 'localhost' || hostname === '127.0.0.1' ||
            hostname === '[::1]' || hostname === '0.0.0.0'
        );
    }, []);

    // Register/unregister the test bench handler for sendMessageNow interception
    useEffect(() => {
        if (!isAvailable) return;
        registerHandler();
        startReinjectionWatcher();
        return () => {
            unregisterHandler();
            stopReinjectionWatcher();
        };
    }, [isAvailable]);

    if (!isAvailable) return null;

    return (
        <>
            {/* Toggle icon - fixed bottom-right */}
            <div
                onClick={togglePanel}
                title="Call Test Bench"
                style={{
                    position: 'fixed',
                    bottom: 16,
                    right: 16,
                    zIndex: 9999,
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: isOpen ? '#3f3f46' : '#27272a',
                    border: '1px solid #52525b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#3f3f46'; }}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = '#27272a'; }}
            >
                {/* Phone icon (SVG) */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
            </div>

            {/* Panel - positioned above the icon */}
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    bottom: 64,
                    right: 16,
                    zIndex: 9998,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                    borderRadius: 8,
                }}>
                    <TestBenchPanel />
                </div>
            )}
        </>
    );
}
