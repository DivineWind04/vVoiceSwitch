// components/Keypad.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import SquareButton from "../base_button/SquareButton";
import { useCoreStore } from "~/model";
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
  const [displayMessage, setDisplayMessage] = useState("READY");
  const [callState, setCallState] = useState<'ready' | 'dialing' | 'ringback' | 'active' | 'error'>('ready');
  const ringbackAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Store access
  const sendDialCall = useCoreStore((s: any) => s.sendDialCall);
  const dialCallStatus = useCoreStore((s: any) => s.dialCallStatus);
  const iaDisplayBuffer = useCoreStore((s: any) => s.iaDisplayBuffer);
  const appendToIaDisplay = useCoreStore((s: any) => s.appendToIaDisplay);
  const clearIaDisplay = useCoreStore((s: any) => s.clearIaDisplay);
  
  // Clear the IA display when keypad opens
  useEffect(() => {
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
  }, [clearIaDisplay]);
  
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
    
    // Play DTMF tone
    playDTMFTone(digit);
    
    // Append to store (which updates IA DISPLAY)
    appendToIaDisplay(digit);
    
    const newBuffer = iaDisplayBuffer + digit;
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
    <div className="flex flex-col items-center p-2" style={{ marginTop: '8px' }}>
      {/* Top indicator bar */}
      <div 
        className="flex items-center mb-1"
        style={{ 
          width: '100%',
          height: '14px',
        }}
      >
        <div 

        />
        <div 
          style={{ 
            flex: 1, 
            height: '44px', 
            backgroundColor: '#003399',
          }}
        />
      </div>

      {/* Status display showing dialed digits or status */}
      <div 
        className="w-full text-center mb-2"
        style={{
          color: '#CCCC00',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          fontSize: '14px',
          letterSpacing: '1px',
          minHeight: '18px'
        }}
      >
        {iaDisplayBuffer || (displayMessage !== 'READY' ? displayMessage : '')}
      </div>

      {/* Keypad grid - 4 rows of 3 columns */}
      <div className="grid grid-cols-3 gap-1">
        <SquareButton topLine="" bottomLine="1" onClick={() => handleDigitPress("1")} />
        <SquareButton topLine="ABC" bottomLine="2" onClick={() => handleDigitPress("2")} />
        <SquareButton topLine="DEF" bottomLine="3" onClick={() => handleDigitPress("3")} />
        <SquareButton topLine="GHI" bottomLine="4" onClick={() => handleDigitPress("4")} />
        <SquareButton topLine="JKL" bottomLine="5" onClick={() => handleDigitPress("5")} />
        <SquareButton topLine="MNO" bottomLine="6" onClick={() => handleDigitPress("6")} />
        <SquareButton topLine="PRS" bottomLine="7" onClick={() => handleDigitPress("7")} />
        <SquareButton topLine="TUV" bottomLine="8" onClick={() => handleDigitPress("8")} />
        <SquareButton topLine="WXY" bottomLine="9" onClick={() => handleDigitPress("9")} />
        <SquareButton topLine="" bottomLine="*" onClick={() => handleDigitPress("*")} />
        <SquareButton topLine="OPER" bottomLine="0" onClick={() => handleDigitPress("0")} />
        <SquareButton topLine="" bottomLine="#" onClick={() => handleDigitPress("#")} />
      </div>
    </div>
  );
};

export default Keypad;
