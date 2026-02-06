// components/Keypad.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import KeypadButton from "../ground_ground/KeypadButton";
import { useCoreStore, findDialCodeTable, resolveDialCode } from "~/model";

interface KeypadProps {
  dialLineInfo?: { trunkName: string; lineType: number } | null;
  onClose?: () => void;
}

// DTMF Tone Generator
const DTMF_FREQUENCIES: { [key: string]: [number, number] } = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
};

let audioContext: AudioContext | null = null;

function playDTMFTone(key: string, duration: number = 100) {
  const frequencies = DTMF_FREQUENCIES[key];
  if (!frequencies) return;
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  const [lowFreq, highFreq] = frequencies;
  const now = audioContext.currentTime;
  const endTime = now + duration / 1000;
  const osc1 = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  osc1.type = 'sine';
  osc2.type = 'sine';
  osc1.frequency.value = lowFreq;
  osc2.frequency.value = highFreq;
  gainNode.gain.setValueAtTime(0.15, now);
  gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);
  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(audioContext.destination);
  osc1.start(now);
  osc2.start(now);
  osc1.stop(endTime);
  osc2.stop(endTime);
}

const Keypad: React.FC<KeypadProps> = ({ dialLineInfo, onClose }) => {
  const [dialBuffer, setDialBuffer] = useState('');
  const [callState, setCallState] = useState<'ready' | 'dialing' | 'ringback' | 'connected' | 'error'>('ready');
  const ringbackAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Store access
  const sendDialCall = useCoreStore((s: any) => s.sendDialCall);
  const dialCallStatus = useCoreStore((s: any) => s.dialCallStatus);
  const positionData = useCoreStore((s: any) => s.positionData);
  const selectedPositions = useCoreStore((s: any) => s.selectedPositions);
  
  // Get dial code table
  const currentCallsign = selectedPositions?.[0]?.cs;
  const dialCodeTable = currentCallsign ? findDialCodeTable(positionData, currentCallsign) : null;
  
  // Clear buffer on mount
  useEffect(() => {
    setDialBuffer('');
    setCallState('ready');
    return () => {
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current = null;
      }
    };
  }, []);
  
  // Watch dial call status
  useEffect(() => {
    if (dialCallStatus === 'ringback') {
      setCallState('ringback');
      if (!ringbackAudioRef.current) {
        ringbackAudioRef.current = new Audio('/Ringback.wav');
        ringbackAudioRef.current.loop = true;
        ringbackAudioRef.current.play().catch(() => {});
      }
    } else if (dialCallStatus === 'connected') {
      setCallState('connected');
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current = null;
      }
      setTimeout(() => {
        setDialBuffer('');
        if (onClose) onClose();
      }, 1000);
    } else if (dialCallStatus === 'error' || dialCallStatus === 'busy') {
      setCallState('error');
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current = null;
      }
    }
  }, [dialCallStatus, onClose]);
  
  const initiateCall = useCallback((dialCode: string) => {
    if (!dialLineInfo?.trunkName) {
      console.error('[ETVS Keypad] No trunk name');
      setCallState('error');
      return;
    }
    console.log(`[ETVS Keypad] Dialing ${dialCode} on trunk ${dialLineInfo.trunkName}`);
    setCallState('dialing');
    sendDialCall(dialLineInfo.trunkName, dialCode);
  }, [dialLineInfo, sendDialCall]);
  
  const handleDigitPress = useCallback((digit: string) => {
    if (callState !== 'ready' && callState !== 'dialing') return;
    playDTMFTone(digit);
    const newBuffer = dialBuffer + digit;
    setDialBuffer(newBuffer);
    setCallState('dialing');
    // Auto-dial after 2 digits
    if (newBuffer.length >= 2) {
      setTimeout(() => initiateCall(newBuffer), 200);
    }
  }, [dialBuffer, callState, initiateCall]);

  return (
    <div className="items-center space-x-2">
      <div className="grid grid-cols-3 gap-[4px]">
        <KeypadButton topLine="" bottomLine="1" onClick={() => handleDigitPress('1')} />
        <KeypadButton topLine="ABC" bottomLine="2" onClick={() => handleDigitPress('2')} />
        <KeypadButton topLine="DEF" bottomLine="3" onClick={() => handleDigitPress('3')} />
        <KeypadButton topLine="GHI" bottomLine="4" onClick={() => handleDigitPress('4')} />
        <KeypadButton topLine="JKL" bottomLine="5" onClick={() => handleDigitPress('5')} />
        <KeypadButton topLine="MNO" bottomLine="6" onClick={() => handleDigitPress('6')} />
        <KeypadButton topLine="PRS" bottomLine="7" onClick={() => handleDigitPress('7')} />
        <KeypadButton topLine="TUV" bottomLine="8" onClick={() => handleDigitPress('8')} />
        <KeypadButton topLine="WXY" bottomLine="9" onClick={() => handleDigitPress('9')} />
        <KeypadButton topLine="*" bottomLine="" onClick={() => handleDigitPress('*')} />
        <KeypadButton topLine="" bottomLine="0" onClick={() => handleDigitPress('0')} />
        <KeypadButton topLine="#" bottomLine="" onClick={() => handleDigitPress('#')} />
      </div>
    </div>
  );
};

export default Keypad;
