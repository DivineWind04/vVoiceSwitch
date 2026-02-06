// components/StvsKeypad.tsx
"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import StvsKeypadButton from "./StvsKeypadButton";
import { useCoreStore, findDialCodeTable, resolveDialCode } from "~/model";

// DTMF frequency pairs for each key
const DTMF_FREQUENCIES: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1447],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1447],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1447],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1447],
};

interface StvsKeypadProps {
  brightness?: number; // Brightness from ILLUM knob
  trunkName?: string; // For dial line mode
  onCallInitiated?: (target: string) => void;
}

const StvsKeypad: React.FC<StvsKeypadProps> = ({ brightness = 1.0, trunkName, onCallInitiated }) => {
  const [dialBuffer, setDialBuffer] = useState<string>('');
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'ringback' | 'connected' | 'error'>('idle');
  
  // Store access
  const sendDialCall = useCoreStore((s: any) => s.sendDialCall);
  const positionData = useCoreStore((s: any) => s.positionData);
  const selectedPositions = useCoreStore((s: any) => s.selectedPositions);
  const dialCallStatus = useCoreStore((s: any) => s.dialCallStatus);
  const activeDialLine = useCoreStore((s: any) => s.activeDialLine);
  
  // Get current trunk name from active dial line if not provided as prop
  const currentTrunkName = trunkName || activeDialLine?.trunkName;
  
  // Get dial code table for current position
  const currentCallsign = selectedPositions?.[0]?.cs;
  const dialCodeTable = currentCallsign ? findDialCodeTable(positionData, currentCallsign) : null;
  
  // Audio context for DTMF tones
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Ringback audio ref
  const ringbackAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Initialize audio context
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);
  
  // Play DTMF tone
  const playDTMF = useCallback((key: string, duration: number = 150) => {
    const frequencies = DTMF_FREQUENCIES[key];
    if (!frequencies) return;
    
    const ctx = initAudioContext();
    if (!ctx) return;
    
    const [lowFreq, highFreq] = frequencies;
    const now = ctx.currentTime;
    const endTime = now + duration / 1000;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.value = lowFreq;
    osc2.frequency.value = highFreq;
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    gainNode.gain.setValueAtTime(0.15, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, endTime);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(endTime);
    osc2.stop(endTime);
  }, [initAudioContext]);
  
  // Execute dial call
  const executeDialCall = useCallback((dialCode: string) => {
    if (!currentTrunkName || !dialCodeTable) {
      console.log('[STVS Keypad] No trunk name or dial code table');
      setCallStatus('error');
      return;
    }
    
    const target = resolveDialCode(dialCodeTable, currentTrunkName, dialCode);
    if (target) {
      console.log('[STVS Keypad] Initiating dial call:', { trunkName: currentTrunkName, dialCode, target });
      setCallStatus('dialing');
      sendDialCall(currentTrunkName, dialCode);
      onCallInitiated?.(target);
    } else {
      console.log('[STVS Keypad] Invalid dial code:', dialCode);
      setCallStatus('error');
    }
  }, [currentTrunkName, dialCodeTable, sendDialCall, onCallInitiated]);
  
  // Watch dial call status from store
  useEffect(() => {
    if (dialCallStatus === 'ringback') {
      setCallStatus('ringback');
      // Play ringback audio
      if (!ringbackAudioRef.current) {
        ringbackAudioRef.current = new Audio('/Ringback.wav');
        ringbackAudioRef.current.loop = true;
      }
      ringbackAudioRef.current.play().catch(() => {});
    } else if (dialCallStatus === 'connected') {
      setCallStatus('connected');
      // Stop ringback
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current = null;
      }
      // Reset after connection
      setTimeout(() => {
        setDialBuffer('');
        setCallStatus('idle');
      }, 1000);
    } else if (dialCallStatus === 'error' || dialCallStatus === 'busy') {
      setCallStatus('error');
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current = null;
      }
    }
  }, [dialCallStatus]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current = null;
      }
    };
  }, []);
  
  const handleKeypadClick = useCallback((key: string) => {
    // Play DTMF tone
    playDTMF(key);
    
    if (key === '*') {
      // Clear buffer
      setDialBuffer('');
      setCallStatus('idle');
      console.log('[STVS Keypad] Buffer cleared');
      return;
    }
    
    if (key === '#') {
      // Execute call with current buffer (if 2 digits)
      if (dialBuffer.length === 2) {
        executeDialCall(dialBuffer);
      }
      return;
    }
    
    // Digit pressed - append to buffer
    if (dialBuffer.length < 2) {
      const newBuffer = dialBuffer + key;
      setDialBuffer(newBuffer);
      console.log(`[STVS Keypad] Buffer: ${newBuffer}`);
      
      // Auto-dial after 2 digits
      if (newBuffer.length === 2) {
        setTimeout(() => executeDialCall(newBuffer), 200);
      }
    }
  }, [dialBuffer, playDTMF, executeDialCall]);

  // Keypad layout: 3 columns x 4 rows
  // These positions are percent-based, matching the SVG/viewBox logic in StvsBase
  // Adjust left/top/width/height as needed for visual alignment
  const buttonPositions = [
    // Row 1
    { left: '32%', top: '3%', label: '1', topLine: '', bottomLine: '1' },
    { left: '44%', top: '3%', label: '2', topLine: 'ABC', bottomLine: '2' },
    { left: '55%', top: '3%', label: '3', topLine: 'DEF', bottomLine: '3' },
    // Row 2
    { left: '32%', top: '18%', label: '4', topLine: 'GHI', bottomLine: '4' },
    { left: '44%', top: '18%', label: '5', topLine: 'JKL', bottomLine: '5' },
    { left: '55%', top: '18%', label: '6', topLine: 'MNO', bottomLine: '6' },
    // Row 3
    { left: '32%', top: '33%', label: '7', topLine: 'PQRS', bottomLine: '7' },
    { left: '44%', top: '33%', label: '8', topLine: 'TUV', bottomLine: '8' },
    { left: '55%', top: '33%', label: '9', topLine: 'WXY', bottomLine: '9' },
    // Row 4
    { left: '32%', top: '48%', label: '*', topLine: '', bottomLine: '*' },
    { left: '44%', top: '48%', label: '0', topLine: 'OPER', bottomLine: '0' },
    { left: '55%', top: '48%', label: '#', topLine: '', bottomLine: '#' },
  ];

  // Keypad container: position absolute, scale/size set by parent (StvsBase)
  return (
    <div style={{ position: 'absolute', width: '103%', height: '103%' }}>
      {buttonPositions.map((pos, idx) => (
        <StvsKeypadButton
          key={idx}
          topLine={pos.topLine}
          bottomLine={pos.bottomLine}
          brightness={brightness}
          onClick={() => handleKeypadClick(pos.label)}
          style={{
            position: 'absolute',
            left: pos.left,
            top: pos.top,
            width: '10%',
            height: '13%',
            minWidth: 0,
            minHeight: 0,
          }}
        />
      ))}
    </div>
  );
};

export default StvsKeypad;