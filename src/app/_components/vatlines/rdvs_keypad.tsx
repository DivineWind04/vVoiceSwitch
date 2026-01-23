"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCoreStore, findDialCodeTable, resolveDialCode } from '~/model';

type KeypadMode = 'ia' | 'dialline';

interface RdvsKeypadProps {
  /** Mode: 'ia' for IA indirect access, 'dialline' for type 3 dial lines */
  mode: KeypadMode;
  /** For dialline mode: the trunk name from the type 3 line label */
  trunkName?: string;
  /** Callback when keypad is closed */
  onClose: () => void;
  /** Optional: Callback when a call is successfully initiated */
  onCallInitiated?: (target: string) => void;
  /** Whether IA mode is active (for IA mode - affects dial tone behavior) */
  iaActive?: boolean;
  /** When true, dialpad renders for embedding in Q1 */
  embedded?: boolean;
}

// DTMF frequency pairs for each key (per IA Keypad Characteristics Table 3-4)
// Low frequencies: 697, 770, 852, 941 Hz
// High frequencies: 1209, 1336, 1447 Hz
const DTMF_FREQUENCIES: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1447],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1447],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1447],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1447],
};

// IA Function Codes from manual section 2.4.7.4
const IA_FUNCTION_CODES: Record<string, { description: string; totalDigits: number }> = {
  '0': { description: 'Intercom Call', totalDigits: 4 },
  '1': { description: 'Override Intercom', totalDigits: 4 },
  '2': { description: 'Trunk Call', totalDigits: 4 },
  '3': { description: 'Call Forward', totalDigits: 4 },
  '4': { description: 'Supervisory Monitor', totalDigits: 4 },
  '9': { description: 'Supervisor Reconfig', totalDigits: 4 },
  '60': { description: 'Position Self-Test', totalDigits: 2 },
  '70': { description: 'Maintenance Functions', totalDigits: 2 },
  '7000': { description: 'Clear All Calls', totalDigits: 4 },
  '7001': { description: 'Clear Inbound Fwd', totalDigits: 4 },
  '7002': { description: 'Position Recon', totalDigits: 4 },
  '7003': { description: 'IA LCD Test', totalDigits: 4 },
  '7004': { description: 'Notch Filter Disc', totalDigits: 4 },
};

/**
 * Unified RDVS Keypad Component
 * 
 * Supports both IA (Indirect Access) dialing and dial line (type 3) dialing.
 * Uses Keypad.png with invisible touch buttons and DTMF tones.
 */
export default function RdvsKeypad({ 
  mode, 
  trunkName, 
  onClose, 
  onCallInitiated, 
  iaActive = false, 
  embedded = false 
}: RdvsKeypadProps) {
  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  const sendDialCall = useCoreStore((s: any) => s.sendDialCall);
  const positionData = useCoreStore((s: any) => s.positionData);
  const selectedPositions = useCoreStore((s: any) => s.selectedPositions);
  const dialCallStatus = useCoreStore((s: any) => s.dialCallStatus);
  
  const [dialedCode, setDialedCode] = useState<string>('');
  const [statusLine, setStatusLine] = useState<string>('');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'ringback' | 'connected' | 'error'>('idle');
  
  // Audio context for DTMF tones
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // For dial line mode: get dial code table
  const currentCallsign = selectedPositions?.[0]?.cs;
  const dialCodeTable = currentCallsign ? findDialCodeTable(positionData, currentCallsign) : null;
  
  // Max digits based on mode
  const maxDigits = mode === 'ia' ? 4 : 2;
  
  // Initialize audio context on first interaction
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);
  
  // Play DTMF tone for a key
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
  
  // Update status line based on mode and dialed code
  useEffect(() => {
    if (mode === 'ia') {
      // IA mode: show function info
      if (!dialedCode) {
        setStatusLine(iaActive ? 'DIAL IA CODE' : '');
        return;
      }
      
      // Check for exact match
      const exactMatch = IA_FUNCTION_CODES[dialedCode];
      if (exactMatch && dialedCode.length === exactMatch.totalDigits) {
        setStatusLine(exactMatch.description);
        return;
      }
      
      // Check if typing a known code
      for (const [prefix, info] of Object.entries(IA_FUNCTION_CODES)) {
        if (dialedCode.startsWith(prefix) || prefix.startsWith(dialedCode)) {
          if (dialedCode.length < info.totalDigits) {
            setStatusLine(`${info.description}...`);
            return;
          } else if (dialedCode.length === info.totalDigits) {
            setStatusLine(info.description);
            return;
          }
        }
      }
      
      // Single digit prefix check
      const firstDigit = dialedCode[0];
      const singleDigitFunc = IA_FUNCTION_CODES[firstDigit!];
      if (singleDigitFunc && dialedCode.length <= singleDigitFunc.totalDigits) {
        setStatusLine(`${singleDigitFunc.description}...`);
      } else {
        setStatusLine('');
      }
    } else {
      // Dial line mode: show resolved target
      if (dialedCode.length === 2 && dialCodeTable && trunkName) {
        const target = resolveDialCode(dialCodeTable, trunkName, dialedCode);
        if (target) {
          setStatusLine(target);
        } else {
          setStatusLine(`Code ${dialedCode} not found`);
        }
      } else if (dialCallStatus !== 'idle') {
        setStatusLine(dialCallStatus.toUpperCase());
      } else {
        setStatusLine(trunkName || '');
      }
    }
  }, [dialedCode, mode, iaActive, dialCodeTable, trunkName, dialCallStatus]);
  
  // Execute IA code
  const executeIACode = useCallback((code: string) => {
    console.log('[RdvsKeypad] Executing IA code:', code);
    
    const firstDigit = code[0];
    const remaining = code.slice(1);
    
    switch (firstDigit) {
      case '0':
        if (code.length === 4) {
          sendMsg({ type: 'ia_call', cmd1: remaining, dbl1: 0 });
          setCallStatus('dialing');
        }
        break;
      case '1':
        if (code.length === 4) {
          sendMsg({ type: 'ia_call', cmd1: remaining, dbl1: 1 });
          setCallStatus('dialing');
        }
        break;
      case '2':
        if (code.length === 4) {
          sendMsg({ type: 'ia_call', cmd1: remaining, dbl1: 2 });
          setCallStatus('dialing');
        }
        break;
      case '3':
        if (code.length === 4) {
          sendMsg({ type: 'ia_forward', cmd1: remaining });
        }
        break;
      case '4':
        if (code.length === 4) {
          sendMsg({ type: 'ia_monitor', cmd1: remaining });
        }
        break;
      case '6':
        if (code === '60') {
          sendMsg({ type: 'ia_selftest' });
        }
        break;
      case '7':
        if (code === '70') sendMsg({ type: 'ia_maintenance' });
        else if (code === '7000') sendMsg({ type: 'ia_clear_all' });
        else if (code === '7001') sendMsg({ type: 'ia_clear_forward' });
        else if (code === '7002') sendMsg({ type: 'ia_recon' });
        else if (code === '7003') sendMsg({ type: 'ia_lcd_test' });
        else if (code === '7004') sendMsg({ type: 'ia_notch_filter' });
        break;
      case '9':
        if (code.length === 4) {
          sendMsg({ type: 'ia_reconfig', cmd1: remaining });
        }
        break;
    }
  }, [sendMsg]);
  
  // Execute dial line call
  const executeDialLineCall = useCallback(() => {
    if (dialedCode.length === 2 && trunkName && dialCodeTable) {
      const target = resolveDialCode(dialCodeTable, trunkName, dialedCode);
      if (target) {
        console.log('[RdvsKeypad] Initiating dial call:', { trunkName, dialedCode, target });
        sendDialCall(trunkName, dialedCode);
        onCallInitiated?.(target);
      }
    }
  }, [dialedCode, trunkName, dialCodeTable, sendDialCall, onCallInitiated]);
  
  // Handle digit press
  const handleDigitPress = useCallback((digit: string) => {
    if (dialedCode.length >= maxDigits) return;
    
    playDTMF(digit);
    setActiveKey(digit);
    setTimeout(() => setActiveKey(null), 100);
    
    const newCode = dialedCode + digit;
    setDialedCode(newCode);
    
    if (mode === 'ia') {
      // Auto-execute IA codes
      const firstDigit = newCode[0];
      if (newCode.length === 2 && (newCode === '60' || newCode === '70')) {
        executeIACode(newCode);
      } else if (newCode.length === 4) {
        if (['0', '1', '2', '3', '4', '9'].includes(firstDigit!)) {
          executeIACode(newCode);
        } else if (newCode.startsWith('700')) {
          executeIACode(newCode);
        }
      }
    }
    // For dial line mode, user must press # or Enter to execute
  }, [dialedCode, maxDigits, playDTMF, mode, executeIACode]);
  
  // Handle clear (star key)
  const handleClear = useCallback(() => {
    playDTMF('*');
    setDialedCode('');
    setCallStatus('idle');
    if (mode === 'ia') {
      setStatusLine(iaActive ? 'DIAL IA CODE' : '');
    } else {
      setStatusLine(trunkName || '');
    }
  }, [playDTMF, mode, iaActive, trunkName]);
  
  // Handle pound key (execute for dial line mode)
  const handlePound = useCallback(() => {
    playDTMF('#');
    if (mode === 'dialline') {
      executeDialLineCall();
    }
  }, [playDTMF, mode, executeDialLineCall]);
  
  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigitPress(e.key);
      } else if (e.key === '*') {
        handleClear();
      } else if (e.key === '#' || e.key === 'Enter') {
        handlePound();
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Backspace') {
        setDialedCode(prev => prev.slice(0, -1));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigitPress, handleClear, handlePound, onClose]);
  
  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  // Keypad button positions
  const keypadButtons = [
    { key: '1', top: 24, left: 21, width: 18, height: 19 },
    { key: '2', top: 24, left: 41, width: 18, height: 19 },
    { key: '3', top: 24, left: 61, width: 18, height: 19 },
    { key: '4', top: 45, left: 21, width: 18, height: 19 },
    { key: '5', top: 45, left: 41, width: 18, height: 19 },
    { key: '6', top: 45, left: 61, width: 18, height: 19 },
    { key: '7', top: 68, left: 21, width: 18, height: 19 },
    { key: '8', top: 68, left: 41, width: 18, height: 19 },
    { key: '9', top: 68, left: 61, width: 18, height: 19 },
    { key: '*', top: 89, left: 21, width: 18, height: 19 },
    { key: '0', top: 89, left: 41, width: 18, height: 19 },
    { key: '#', top: 89, left: 61, width: 18, height: 19 },
  ];
  
  return (
    <div 
      className="rdvs-keypad"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        fontFamily: 'EDSTv302, monospace',
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Keypad background image */}
        <img 
          src="/rdvs/SVG/Keypad.png" 
          alt="Keypad"
          style={{
            width: '110%',
            height: '110%',
            objectFit: 'contain',
            userSelect: 'none',
            pointerEvents: 'none'
          }}
          draggable={false}
        />
        
        {/* IA Display - two-line 16-character-per-line display */}
        <div 
          style={{
            position: 'absolute',
            top: '3%',
            left: '8%',
            width: '84%',
            height: '18%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none'
          }}
        >
          {/* Top line: dialed code */}
          <div 
            className="rdvs-label"
            style={{
              color: '#FFFFFF',
              fontSize: '30px',
              fontFamily: 'EDSTv302, monospace',
              letterSpacing: '4px',
              minHeight: '32px',
              textAlign: 'center'
            }}
          >
            {dialedCode || ''}
          </div>
          
          {/* Bottom line: status / function info / target */}
          <div 
            className="rdvs-label"
            style={{
              color: '#FFFFFF',
              fontSize: '30px',
              fontFamily: 'EDSTv302, monospace',
              letterSpacing: '1px',
              marginTop: '2px',
              textAlign: 'center'
            }}
          >
            {statusLine}
          </div>
        </div>
        
        {/* Invisible touch buttons */}
        {keypadButtons.map(({ key, top, left, width, height }) => (
          <button
            key={key}
            onClick={() => {
              if (key === '*') handleClear();
              else if (key === '#') handlePound();
              else handleDigitPress(key);
            }}
            style={{
              position: 'absolute',
              top: `${top}%`,
              left: `${left}%`,
              width: `${width}%`,
              height: `${height}%`,
              border: 'none',
              cursor: 'pointer',
              outline: 'none',
              borderRadius: '4px',
              transition: 'background 0.1s'
            }}
            onMouseDown={() => setActiveKey(key)}
            onMouseUp={() => setActiveKey(null)}
            onMouseLeave={() => setActiveKey(null)}
          />
        ))}
      </div>
    </div>
  );
}
