// components/Keypad.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import SquareButton from "../base_button/SquareButton";
import { useCoreStore } from "~/model";
import { landlineStore } from '~/lib/landline/store';
import '../vatlines/styles.css';

interface KeypadProps {
  dialLineInfo?: { trunkName: string; lineType: number } | null;
  onClose?: () => void;
}

// DTMF Tone Generator using Web Audio API
const DTMF_FREQUENCIES: { [key: string]: [number, number] } = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
};

let audioContext: AudioContext | null = null;

function playDTMFTone(key: string, duration: number = 400) {
  const frequencies = DTMF_FREQUENCIES[key];
  if (!frequencies) return;

  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  const [lowFreq, highFreq] = frequencies;
  const now = audioContext.currentTime;
  const dur = duration / 1000;
  const rampOff = 0.03; // 30ms ramp-off at the end
  const endTime = now + dur;

  const osc1 = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  osc1.type = 'sine';
  osc2.type = 'sine';
  osc1.frequency.value = lowFreq;
  osc2.frequency.value = highFreq;

  gainNode.gain.setValueAtTime(0.15, now);
  gainNode.gain.setValueAtTime(0.15, endTime - rampOff);
  gainNode.gain.exponentialRampToValueAtTime(0.001, endTime);

  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(audioContext.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(endTime);
  osc2.stop(endTime);
}

const Keypad: React.FC<KeypadProps> = ({ dialLineInfo, onClose }) => {
  const [displayMessage, setDisplayMessage] = useState("READY");
  const [callState, setCallState] = useState<'ready' | 'dialing' | 'ringback' | 'active' | 'error'>('ready');
  const ringbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const dialToneStartedRef = useRef(false);
  const dialBufferRef = useRef(''); // ref-based buffer to avoid stale closure issues
  
  // Store access
  const sendDialCall = useCoreStore((s: any) => s.sendDialCall);
  const dialCallStatus = useCoreStore((s: any) => s.dialCallStatus);
  const iaDisplayBuffer = useCoreStore((s: any) => s.iaDisplayBuffer);
  const appendToIaDisplay = useCoreStore((s: any) => s.appendToIaDisplay);
  const clearIaDisplay = useCoreStore((s: any) => s.clearIaDisplay);
  const resetDialCallStatus = useCoreStore((s: any) => s.resetDialCallStatus);
  const activeDialLine = useCoreStore((s: any) => s.activeDialLine);
  const hasBeenActiveRef = useRef(false);
  
  // Play dial tone when keypad opens for a dial line
  useEffect(() => {
    if (dialLineInfo) {
      landlineStore.startDialTone();
      dialToneStartedRef.current = true;
    }
    return () => {
      landlineStore.stopDialTone();
    };
  }, [dialLineInfo]);
  
  // Clear the IA display when keypad opens
  useEffect(() => {
    dialBufferRef.current = '';
    resetDialCallStatus();
    clearIaDisplay();
    setDisplayMessage("READY");
    setCallState('ready');
    
    // Cleanup ringback on unmount
    return () => {
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current = null;
      }
    };
  }, [clearIaDisplay, resetDialCallStatus]);
  
  // Watch activeDialLine — if cancelled from outside (REL button), close the keypad
  useEffect(() => {
    if (activeDialLine !== null) {
      hasBeenActiveRef.current = true;
    } else if (hasBeenActiveRef.current) {
      landlineStore.stopDialTone();
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current = null;
      }
      if (onClose) onClose();
    }
  }, [activeDialLine, onClose]);

  // Watch dial call status from store
  useEffect(() => {
    if (dialCallStatus === 'ringback') {
      setDisplayMessage("RINGING...");
      setCallState('ringback');
      // Play ringback tone (loops until call connects or fails)
      if (!ringbackAudioRef.current) {
        ringbackAudioRef.current = new Audio('/Ringback.wav');
        ringbackAudioRef.current.loop = true;
        ringbackAudioRef.current.play().catch(err => console.log('Could not play ringback:', err));
      }
    } else if (dialCallStatus === 'connected') {
      setDisplayMessage("CONNECTED");
      setCallState('active');
      // Stop ringback
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current = null;
      }
      // Auto-close after connection
      setTimeout(() => {
        clearIaDisplay();
        if (onClose) onClose();
      }, 1000);
    } else if (dialCallStatus === 'busy') {
      setDisplayMessage("BUSY");
      setCallState('error');
      // Stop ringback
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current = null;
      }
    } else if (dialCallStatus === 'error') {
      setDisplayMessage("INVALID CODE");
      setCallState('error');
      // Stop ringback
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.pause();
        ringbackAudioRef.current = null;
      }
    }
  }, [dialCallStatus, clearIaDisplay, onClose]);
  
  // Initiate the dial call with current buffer
  const initiateCall = useCallback((dialCode: string) => {
    if (!dialLineInfo?.trunkName) {
      console.error('[Keypad] No trunk name specified');
      setDisplayMessage("NO TRUNK");
      setCallState('error');
      return;
    }
    
    console.log(`[Keypad] Dialing ${dialCode} on trunk ${dialLineInfo.trunkName}`);
    setDisplayMessage(`DIALING ${dialCode}...`);
    setCallState('dialing');
    
    // Use the store's sendDialCall which resolves the dial code
    sendDialCall(dialLineInfo.trunkName, dialCode);
  }, [dialLineInfo, sendDialCall]);

  const handleDigitPress = (digit: string) => {
    if (callState !== 'ready' && callState !== 'dialing') return;
    
    // Stop dial tone on first digit
    if (dialToneStartedRef.current) {
      landlineStore.stopDialTone();
      dialToneStartedRef.current = false;
    }
    
    // Play DTMF tone
    playDTMFTone(digit);
    
    // Append to store (which updates IA DISPLAY)
    appendToIaDisplay(digit);
    
    // Use ref-based buffer to avoid stale closure — iaDisplayBuffer from the
    // Zustand subscription may not have updated yet if digits are pressed quickly.
    dialBufferRef.current = dialBufferRef.current + digit;
    const newBuffer = dialBufferRef.current;
    setCallState('dialing');
    
    // Auto-dial after 2 digits (dial codes are 2 digits)
    if (newBuffer.length >= 2) {
      setTimeout(() => initiateCall(newBuffer), 200);
    }
  };

  // Handle G/G page button click - these would switch between G/G line pages
  const handleGGPageClick = (page: number) => {
    console.log(`[Keypad] G/G page ${page} clicked`);
    // TODO: Implement G/G page switching if needed
  };

  return (
    <div className="flex flex-col p-2" style={{ marginTop: '8px' }}>
      {/* Status display — text lives inside the blue bar */}
      <div
        className="flex items-center justify-center mb-2"
        style={{
          width: '100%',
          height: '34px',
          backgroundColor: '#003399',
        }}
      >
        <span
          style={{
            color: '#CCCC00',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            fontSize: '18px',
            letterSpacing: '2px',
          }}
        >
          {callState === 'ready' || callState === 'dialing'
            ? iaDisplayBuffer || ''
            : displayMessage}
        </span>
      </div>

      {/* Keypad grid - 4 rows of 3 columns */}
      <div className="grid grid-cols-3 gap-1" style={{ width: '100%' }}>
        <SquareButton topLine="" bottomLine="1" onClick={() => handleDigitPress("1")} controlledIndicator={false} />
        <SquareButton topLine="ABC" bottomLine="2" onClick={() => handleDigitPress("2")} controlledIndicator={false} />
        <SquareButton topLine="DEF" bottomLine="3" onClick={() => handleDigitPress("3")} controlledIndicator={false} />
        <SquareButton topLine="GHI" bottomLine="4" onClick={() => handleDigitPress("4")} controlledIndicator={false} />
        <SquareButton topLine="JKL" bottomLine="5" onClick={() => handleDigitPress("5")} controlledIndicator={false} />
        <SquareButton topLine="MNO" bottomLine="6" onClick={() => handleDigitPress("6")} controlledIndicator={false} />
        <SquareButton topLine="PRS" bottomLine="7" onClick={() => handleDigitPress("7")} controlledIndicator={false} />
        <SquareButton topLine="TUV" bottomLine="8" onClick={() => handleDigitPress("8")} controlledIndicator={false} />
        <SquareButton topLine="WXY" bottomLine="9" onClick={() => handleDigitPress("9")} controlledIndicator={false} />
        <SquareButton topLine="" bottomLine="*" onClick={() => handleDigitPress("*")} controlledIndicator={false} />
        <SquareButton topLine="OPER" bottomLine="0" onClick={() => handleDigitPress("0")} controlledIndicator={false} />
        <SquareButton topLine="" bottomLine="#" onClick={() => handleDigitPress("#")} controlledIndicator={false} />
      </div>
    </div>
  );
};

export default Keypad;
