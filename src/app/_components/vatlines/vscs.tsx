import { useEffect, useMemo, useState } from 'react';
import { ButtonType, CALL_TYPE, Configuration, ActiveLandline, IncomingLandline, Button } from './types';
import HeadphoneSvgComponent from './headphone_svg';
import SpeakerSvgComponent from './speaker_svg';
import VscsButtonComponent from './vscs_button';
import VscsStaticButton from './vscs_static_button';
import VscsAG from './vscs_ag';
import VscsUtil from './vscs_util';
import { useCoreStore } from '~/model';
import './styles.css';

// Utility function to get line type from position configuration data
const getLineTypeFromConfig = (description: string, positionData: any): number | null => {
  if (!positionData || !description) {
    console.log('Debug - getLineTypeFromConfig early return:', { description, positionData: !!positionData });
    return null;
  }
  
  console.log('Debug - Searching for description:', description);
  
  // Check if this is the zoa_position.json format with root "positions" array
  if (positionData.positions && Array.isArray(positionData.positions)) {
    console.log('Debug - Searching in positions array, total positions:', positionData.positions.length);
    for (const position of positionData.positions) {
      if (position.lines && Array.isArray(position.lines)) {
        console.log(`Debug - Checking position ${position.pos}, lines count:`, position.lines.length);
        for (const line of position.lines) {
          if (Array.isArray(line) && line.length >= 3) {
            if (line[2] === description) { // Match on description (third element)
              console.log('Debug - FOUND MATCH! Line:', { description, lineType: line[1], fullLine: line, position: position.pos });
              return line[1]; // Return line type (0, 1, or 2)
            }
          }
        }
      }
    }
    console.log('Debug - No match found for description:', description);
  }
  
  console.log('Debug - Fallback: returning null for description:', description);
  return null;
};// Map numeric line types to ButtonType enum
const mapLineTypeToButtonType = (lineType: number | null): ButtonType => {
  switch (lineType) {
    case 0: return ButtonType.OVERRIDE; // Override line (shows OVR)
    case 1: return ButtonType.RING;     // Normal/Ring line  
    case 2: return ButtonType.SHOUT;    // Shout line (Direct Access with speaker)
    default: return ButtonType.RING;    // Default to normal if unknown
  }
};

interface VscsProps {
  activeLandlines: ActiveLandline[];
  incomingLandlines: IncomingLandline[];
  outgoingLandlines: ActiveLandline[];
  heldLandlines: string[];
  config: Configuration;
  buttonPress: (id: string, type: CALL_TYPE) => void;
  holdBtn: () => void;
  releaseBtn: () => void;
  toggleGg: () => void;
  toggleOver: () => void;
  ggLoud: boolean;
  overrideLoud: boolean;
  settingsEdit: (val: boolean) => void;
  volume: {
    volume: number;
    setVolume: (val: number) => void;
  };
  playError: () => void;
  metadata: {
    position: string;
    sector: string;
    facilityId: string;
  };
}

// Dot Matrix Character Map (5x7 grid for each character)
const DOT_MATRIX_CHARS: { [key: string]: number[][] } = {
  '0': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,1,1],[1,0,1,0,1],[1,1,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  '1': [[0,0,1,0,0],[0,1,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,1,1,1,0]],
  '2': [[0,1,1,1,0],[1,0,0,0,1],[0,0,0,0,1],[0,0,1,1,0],[0,1,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  '3': [[0,1,1,1,0],[1,0,0,0,1],[0,0,0,0,1],[0,0,1,1,0],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  '4': [[0,0,0,1,0],[0,0,1,1,0],[0,1,0,1,0],[1,0,0,1,0],[1,1,1,1,1],[0,0,0,1,0],[0,0,0,1,0]],
  '5': [[1,1,1,1,1],[1,0,0,0,0],[1,1,1,1,0],[0,0,0,0,1],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  '6': [[0,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  '7': [[1,1,1,1,1],[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[0,1,0,0,0],[0,1,0,0,0]],
  '8': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  '9': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,1],[0,0,0,0,1],[0,0,0,0,1],[0,1,1,1,0]],
  'A': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  'B': [[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0]],
  'C': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,1],[0,1,1,1,0]],
  'D': [[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0]],
  'E': [[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  'F': [[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0]],
  'G': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,0],[1,0,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  'H': [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  'I': [[0,1,1,1,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,1,1,1,0]],
  'J': [[0,0,1,1,1],[0,0,0,1,0],[0,0,0,1,0],[0,0,0,1,0],[0,0,0,1,0],[1,0,0,1,0],[0,1,1,0,0]],
  'K': [[1,0,0,0,1],[1,0,0,1,0],[1,0,1,0,0],[1,1,0,0,0],[1,0,1,0,0],[1,0,0,1,0],[1,0,0,0,1]],
  'L': [[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  'M': [[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  'N': [[1,0,0,0,1],[1,1,0,0,1],[1,0,1,0,1],[1,0,0,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  'O': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  'P': [[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0]],
  'Q': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,1,0,1],[1,0,0,1,0],[0,1,1,0,1]],
  'R': [[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0],[1,0,1,0,0],[1,0,0,1,0],[1,0,0,0,1]],
  'S': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,0],[0,1,1,1,0],[0,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  'T': [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
  'U': [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  'V': [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,1,0,1,0],[0,0,1,0,0]],
  'W': [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,1,0,1],[1,0,1,0,1],[1,1,0,1,1],[1,0,0,0,1]],
  'X': [[1,0,0,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1],[1,0,0,0,1]],
  'Y': [[1,0,0,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
  'Z': [[1,1,1,1,1],[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  '-': [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[1,1,1,1,1],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]],
  ' ': [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]],
  '.': [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,1,1,0,0],[0,1,1,0,0]],
  ':': [[0,0,0,0,0],[0,1,1,0,0],[0,1,1,0,0],[0,0,0,0,0],[0,1,1,0,0],[0,1,1,0,0],[0,0,0,0,0]],
  '*': [[0,0,0,0,0],[0,0,1,0,0],[1,0,1,0,1],[0,1,1,1,0],[1,0,1,0,1],[0,0,1,0,0],[0,0,0,0,0]],
  '#': [[0,1,0,1,0],[0,1,0,1,0],[1,1,1,1,1],[0,1,0,1,0],[1,1,1,1,1],[0,1,0,1,0],[0,1,0,1,0]],
};

// Dot Matrix Character Component
function DotMatrixChar({ char, color = '#FFD700', brightness = 100 }: { char: string; color?: string; brightness?: number }) {
  const matrix = DOT_MATRIX_CHARS[char.toUpperCase()] ?? DOT_MATRIX_CHARS[' '] ?? [];
  const dotSize = 3;
  const gap = 1;
  
  if (!matrix || matrix.length === 0) {
    return <div style={{ width: '19px', height: '31px' }} />;
  }
  
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateRows: `repeat(7, ${dotSize}px)`,
      gridTemplateColumns: `repeat(5, ${dotSize}px)`,
      gap: `${gap}px`,
      padding: '1px',
    }}>
      {matrix.map((row, rowIdx) => 
        row.map((dot, colIdx) => (
          <div
            key={`${rowIdx}-${colIdx}`}
            style={{
              width: `${dotSize}px`,
              height: `${dotSize}px`,
              borderRadius: '50%',
              backgroundColor: dot ? color : 'transparent',
              opacity: dot ? brightness / 100 : 0,
              boxShadow: dot && brightness > 50 ? `0 0 ${dotSize}px ${color}` : 'none',
            }}
          />
        ))
      )}
    </div>
  );
}

// Translucent button with underglow effect
function GlowButton({ 
  onClick, 
  children, 
  glowColor, 
  width = '45px', 
  height = '45px',
  brightness = 100,
  textColor = '#000',
  fontSize = '18px',
}: { 
  onClick: () => void; 
  children?: React.ReactNode; 
  glowColor: string;
  width?: string;
  height?: string;
  brightness?: number;
  textColor?: string;
  fontSize?: string;
}) {
  const [isPressed, setIsPressed] = useState(false);
  const glowIntensity = brightness / 100;
  
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      style={{
        width,
        height,
        position: 'relative',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        overflow: 'hidden',
        // Translucent plastic layer
        background: `linear-gradient(
          180deg, 
          rgba(255,255,255,${0.15 * glowIntensity}) 0%, 
          rgba(255,255,255,${0.05 * glowIntensity}) 50%,
          rgba(0,0,0,0.1) 100%
        )`,
        // Glow effect underneath
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,${0.3 * glowIntensity}),
          inset 0 -1px 0 rgba(0,0,0,0.2),
          0 0 ${isPressed ? 15 : 10}px ${isPressed ? 8 : 5}px ${glowColor}${Math.round(glowIntensity * (isPressed ? 200 : 150)).toString(16).padStart(2, '0')},
          0 ${isPressed ? 2 : 4}px ${isPressed ? 8 : 12}px ${glowColor}${Math.round(glowIntensity * 100).toString(16).padStart(2, '0')}
        `,
        transform: isPressed ? 'translateY(1px)' : 'none',
        transition: 'all 0.1s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: textColor,
        fontSize,
        fontWeight: 'bold',
        textShadow: glowIntensity > 0.5 ? `0 0 4px ${glowColor}` : 'none',
      }}
    >
      {/* Inner glow layer */}
      <div style={{
        position: 'absolute',
        inset: '2px',
        borderRadius: '3px',
        background: `radial-gradient(ellipse at center bottom, ${glowColor}${Math.round(glowIntensity * 60).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      {/* Content */}
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
    </button>
  );
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

  // Create or reuse AudioContext
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  const [lowFreq, highFreq] = frequencies;
  const now = audioContext.currentTime;
  const endTime = now + duration / 1000;

  // Create oscillators for the two frequencies
  const osc1 = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  osc1.type = 'sine';
  osc2.type = 'sine';
  osc1.frequency.value = lowFreq;
  osc2.frequency.value = highFreq;

  // Set volume (DTMF is typically mixed at equal levels)
  gainNode.gain.setValueAtTime(0.15, now);
  gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

  // Connect the oscillators through the gain node to output
  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Start and stop the tones
  osc1.start(now);
  osc2.start(now);
  osc1.stop(endTime);
  osc2.stop(endTime);
}

// VIK Call States
type VikCallState = 'idle' | 'ready' | 'dialing' | 'ringing' | 'active' | 'busy' | 'released' | 'timeout' | 'denied' | 'held';

// VIK Messages
const VIK_MESSAGES = {
  // Status messages
  READY: 'READY',
  CALL_ACTIVE: 'CALL ACTIVE',
  CALL_RINGING: 'CALL RINGING',
  CALL_RELEASED: 'CALL RELEASED',
  DIALING_COMPLETE: 'DIALING COMPLETE',
  
  // Call type prompts
  IC_CALL: 'IC CALL #',
  IP_CALL: 'IP CALL #',
  OVR_CALL: 'OVR CALL #',
  MEET_ME_CALL: 'MEET-ME CALL #',
  DIAL_CODE: 'DIAL CODE #',
  SPEED_DIAL: 'SPEED DIAL #',
  
  // Conference messages
  MEET_ME_CONF: 'MEET-ME CONF',
  PROG_CONF_MEM: 'PROG CONF MEM#',
  MEMBER_ADDED: 'MEMBER ADDED',
  CONF_LIMIT: 'CONF LIMIT',
  CONF_ON_HOLD: 'CONF ON HOLD',
  CONF_MEM_RLSD: 'CONF MEM RLSD',
  RLS_CONF_MEM: 'RLS CONF MEM#',
  
  // Error/Warning messages
  INVALID_CODE: 'INVALID CODE',
  INVALID_NUMBER: 'INVALID NUMBER',
  INVALID_INDEX: 'INVALID INDEX #',
  BUSY: 'BUSY',
  RING_TIME_OUT: 'RING TIME OUT',
  CALL_DENIED: 'CALL DENIED',
  NOT_ALLOWED: 'NOT ALLOWED',
  NOT_CLASSMARKED: 'NOT CLASSMARKED',
  FUNCTION_DENIED: 'FUNCTION DENIED',
  OUT_OF_SERVICE: 'OUT OF SERVICE',
  KEY_UNDEFINED: 'KEY UNDEFINED',
  LOOP_CLOSURE: 'LOOP CLOSURE',
  RELEASE_DENIED: 'RELEASE DENIED',
  
  // Already status messages
  ALREADY_ACTIVE: 'ALREADY ACTIVE',
  ALREADY_DSBLD: 'ALREADY DSBLD',
  ALREADY_ENABLED: 'ALREADY ENABLED',
  
  // Override messages
  OVR_LIMIT: 'OVR LIMIT',
  
  // Call Forward messages
  CALL_FWD_PSN: 'CALL FWD PSN #',
  CALL_FWD_DENIED: 'CALL FWD DENIED',
  CALL_FWD_DSBLD: 'CALL FWD DSBLD',
  CALLS_FWD_TO: 'CALLS FWD TO',
  PSN_CFWD_DSBLD: 'PSN CFWD DSBLD',
  DISABLE_PSN: 'DISABLE PSN #',
  DISABLE_DENIED: 'DISABLE DENIED',
  
  // Call movement messages
  CALL_MOVD_TO_CA: 'CALL MOVD TO CA',
  CALL_MOVED_GG1: 'CALL MOVED GG1',
  CALL_MOVED_GG2: 'CALL MOVED GG2',
  
  // Voice Monitor messages
  VOICE_MON_PSN: 'VOICE MON PSN #',
  VOICE_MON_INDX: 'VOICE MON INDX #',
  VOICE_MON_LIMIT: 'VOICE MON LIMIT',
  VMON_MEM_RLSD: 'VMON MEM RLSD',
  MOVED_TO_INDEX: 'MOVED TO INDEX',
  
  // Observation messages
  OBSERVE_PSN: 'OBSERVE PSN #',
  OBSERVING_PSN: 'OBSERVING PSN #',
  OBS_SUSPENDED: 'OBS SUSPENDED',
  OBS_TERMINATED: 'OBS TERMINATED',
  
  // Key click messages
  KEY_CLICK_ON: 'KEY CLICK ON',
  KEY_CLICK_OFF: 'KEY CLICK OFF',
  
  // Display messages
  DISPLAY_EXCHNG: 'DISPLAY EXCHNG',
  
  // Split mode
  SPLIT_DENIED: 'SPLIT DENIED',
  
  // Pending/Processing
  PENDING_SWITCH: 'PENDING SWITCH',
  RLS_IS_PENDING: 'RLS IS PENDING',
  
  // Test messages
  PRESS_A_KEY: 'PRESS A KEY',
} as const;

// Line type constants matching position.json format
const LINE_TYPE_OVERRIDE = 0;
const LINE_TYPE_RING = 1;

// VDM Message Types
type VdmMessageType = 'error' | 'status' | 'warning';

interface VdmMessage {
  type: VdmMessageType;
  text: string;
  line2?: string; // Optional second line
}

// VDM Messages
const VDM_MESSAGES = {
  // A/G Communication messages
  AG_COMM_LOST: { type: 'status' as VdmMessageType, text: 'A/G Communications Lost.' },
  AG_MON_DESEL_DENIED: { type: 'error' as VdmMessageType, text: 'A/G MON Deselection Denied:', line2: 'AG MON cannot be Deselected from a Suspended State.' },
  AG_PSN_REL_TERMINATED: { type: 'error' as VdmMessageType, text: 'A/G PSN REL Terminated:', line2: 'Two headsets are not present.' },
  
  // BUEC messages
  BUEC_FREQ_NOT_CLASSMARKED: { type: 'error' as VdmMessageType, text: 'BUEC Denied: Freq. not classmarked.' },
  BUEC_FREQ_NOT_SELECTED: { type: 'error' as VdmMessageType, text: 'BUEC Denied: Freq. not selected.' },
  BUEC_UNAVAILABLE: { type: 'status' as VdmMessageType, text: 'BUEC is Unavailable for Requested Frequency.' },
  
  // Call Denied messages
  CALL_DENIED_FWD_UNASSIGNED: { type: 'error' as VdmMessageType, text: 'Call Denied: Call FWD to Unassigned Destination.' },
  CALL_DENIED_TERMINATES_HERE: { type: 'error' as VdmMessageType, text: 'Call Denied: Call terminates at this position.' },
  CALL_DENIED_DEST_OTS: { type: 'status' as VdmMessageType, text: 'Call Denied: Destination OTS.' },
  CALL_DENIED_SWITCH_OTS: { type: 'status' as VdmMessageType, text: 'Call Denied: G/G switch node OTS.' },
  CALL_DENIED_INVALID_DEST: { type: 'error' as VdmMessageType, text: 'Call Denied: Invalid Destination.' },
  CALL_DENIED_INVALID_NUMBER: { type: 'error' as VdmMessageType, text: 'Call Denied: Invalid Number.' },
  CALL_DENIED_NO_RESPONSE: { type: 'error' as VdmMessageType, text: 'Call Denied: No response to call action.' },
  CALL_DENIED_ALREADY_ACTIVE: { type: 'error' as VdmMessageType, text: 'Call Denied: Position Already Active in Call.' },
  CALL_DENIED_ALREADY_IN_CONF: { type: 'error' as VdmMessageType, text: 'Call Denied: Position Already Active in Conference.' },
  
  // Call Forward messages
  CALL_FWD_DENIED_GG_IN_PROGRESS: { type: 'error' as VdmMessageType, text: 'Call FWD Denied: G/G call in progress.' },
  CALL_FWD_DENIED_INVALID_DEST: { type: 'error' as VdmMessageType, text: 'Call FWD Denied: Invalid destination.' },
  CALL_FWD_DENIED_LOOP: { type: 'error' as VdmMessageType, text: 'Call FWD Denied: Loop closure.' },
  CALL_FWD_DENIED_NO_RESPONSE: { type: 'error' as VdmMessageType, text: 'Call FWD denied: No response to CALL FWD attempt.' },
  CALL_FWD_DISABLED_LOOP: { type: 'error' as VdmMessageType, text: 'Call FWD Disabled: Possible Loop Closure.' },
  CALL_FWD_DISABLE_DENIED_GG: { type: 'error' as VdmMessageType, text: 'Call FWD disable denied: G/G call in progress.' },
  CALL_FWD_DISABLED_SUPER: { type: 'status' as VdmMessageType, text: 'Call FWD disabled by Supervisor/Maintainer.' },
  CALL_FWD_DISABLE_DENIED_NOT_ACTIVE: { type: 'error' as VdmMessageType, text: 'Call FWD disable denied: Call FWD is not active at selected position.' },
  CALL_FWD_DISABLE_DENIED_INVALID: { type: 'error' as VdmMessageType, text: 'Call FWD Disable Request Denied: Position number is not valid.' },
  CALL_RELEASED_NO_RESPONSE: { type: 'error' as VdmMessageType, text: 'Call Released: No response to call action.' },
  
  // Conference messages
  CONF_LIMIT_REACHED: { type: 'error' as VdmMessageType, text: 'CONF member limit reached.' },
  ALL_PRESET_CONF_BUSY: { type: 'status' as VdmMessageType, text: 'All Preset Conference members are busy, OTS, or timed out.' },
  FACILITY_CONF_LIMIT: { type: 'error' as VdmMessageType, text: 'Facility Conference Resource Limit Reached.' },
  
  // Frequency messages
  FREQ_NOT_CLASSMARKED_BOTH: { type: 'error' as VdmMessageType, text: 'Freq. not classmarked for both XMTR and RCVR Main/Stby change.' },
  DISABLE_LAST_EMERG_PROHIBITED: { type: 'error' as VdmMessageType, text: 'Disabling the last transmitter of the last enabled UHF or VHF emergency frequency is prohibited.' },
  DIVERSITY_DENIED_NOT_SELECTED: { type: 'error' as VdmMessageType, text: 'Diversity Denied: Freq not selected.' },
  
  // Function Denied messages
  FUNC_DENIED_AG_STATUS: { type: 'error' as VdmMessageType, text: 'Function Denied: Cannot complete this function on A/G Status Screen.' },
  FUNC_DENIED_INVALID_DEST: { type: 'error' as VdmMessageType, text: 'Function Denied: Invalid Destination.' },
  
  // G/G messages
  GG_CALLS_RELEASED_VIK: { type: 'error' as VdmMessageType, text: 'G/G Calls are Released with VIK Connect/Disconnect' },
  GG_PSN_REL_TERMINATED: { type: 'error' as VdmMessageType, text: 'G/G PSN REL Terminated:', line2: 'Two headsets are not present.' },
  
  // Hold Denied messages
  HOLD_DENIED_CA_FULL: { type: 'error' as VdmMessageType, text: 'Hold Denied: CA queue full.' },
  HOLD_DENIED_NOT_ACTIVE: { type: 'error' as VdmMessageType, text: 'Hold Denied: Call not active.' },
  HOLD_DENIED_NO_MEMBERS: { type: 'error' as VdmMessageType, text: 'Hold Denied: No members active.' },
  HOLD_DENIED_OVR: { type: 'error' as VdmMessageType, text: 'Hold Denied: OVR cannot be placed on hold.' },
  HOLD_DENIED_PROG_CONF: { type: 'error' as VdmMessageType, text: 'HOLD Denied: Prog Conf and/or G/G Classmark Removed Via Reconfig. Can Continue in CONF or Release.' },
  HOLD_DENIED_VOICE_CALLS: { type: 'error' as VdmMessageType, text: 'Hold Denied: Voice Calls cannot be placed on hold.' },
  
  // Holler messages
  HOLLER_DENIED_INVALID_DA: { type: 'warning' as VdmMessageType, text: 'Holler On/Off Denied: Invalid DA' },
  
  // Inconsistent Maps
  INCONSISTENT_MAPS: { type: 'error' as VdmMessageType, text: 'Inconsistent Maps: Notify Supervisor of G/G Call Received on Unassigned DA' },
  
  // Main/Stby messages
  MAIN_STBY_DENIED_NOT_CLASSMARKED: { type: 'error' as VdmMessageType, text: 'Main/Stby Denied: Freq. not classmarked.' },
  MAIN_STBY_DENIED_NOT_SELECTED: { type: 'error' as VdmMessageType, text: 'Main/Stby Denied: Freq. not selected.' },
  MAIN_STBY_DENIED_ON_BUEC: { type: 'error' as VdmMessageType, text: 'Main/Stby Denied: Freq. on BUEC.' },
  
  // Member messages
  MEMBER_PROG_CONF_ON_HOLD: { type: 'error' as VdmMessageType, text: 'Member active in a Prog Conf on Hold. Touch PROG CONF button to resume.' },
  
  // No response messages
  NO_RESPONSE_PROG_CONF: { type: 'error' as VdmMessageType, text: 'No response to PROG CONF action. PROG CONF originator released.' },
  NO_RESPONSE_VOICE_MON: { type: 'error' as VdmMessageType, text: 'No response to VOICE MON action. All voice monitors release.' },
  
  // Override messages
  OVR_DENIED_LIMIT: { type: 'error' as VdmMessageType, text: 'OVR Denied: Limit to Selected Console Reached.' },
  OVR_DENIED_LOOP: { type: 'error' as VdmMessageType, text: 'OVR Denied: Possible loop closure.' },
  
  // PROG CONF messages
  PROG_CONF_ADD_DENIED_TYPE: { type: 'error' as VdmMessageType, text: 'PROG CONF Add Denied: Call type invalid.' },
  PROG_CONF_ADD_DENIED_ACTIVE: { type: 'error' as VdmMessageType, text: 'PROG CONF Add Denied: Member already active.' },
  PROG_CONF_ADD_DENIED_LIMIT: { type: 'error' as VdmMessageType, text: 'PROG CONF Add Denied: Member limit reached.' },
  PROG_CONF_ADD_DENIED_RECONFIG: { type: 'error' as VdmMessageType, text: 'PROG CONF Add Denied: Prog Conf and/or G/G Classmark Removed via Reconfig.' },
  PROG_CONF_ADD_DENIED_VIK_ACTIVE: { type: 'error' as VdmMessageType, text: 'PROG CONF Add Denied: VIK currently active.' },
  PROG_CONF_DESELECT_DENIED: { type: 'error' as VdmMessageType, text: 'PROG CONF deselect denied: Invalid index number.' },
  
  // PSN REL messages
  PSN_REL_SPLIT_ENABLED: { type: 'warning' as VdmMessageType, text: 'PSN REL Terminated: Position enabled Split Mode.' },
  PSN_REL_SPLIT_DISABLED: { type: 'warning' as VdmMessageType, text: 'PSN REL Terminated: Position disabled Split Mode.' },
  
  // PTT messages
  PTT_CONF_LOST: { type: 'error' as VdmMessageType, text: 'PTT Confirmation Lost on Enabled XMTR.' },
  PTT_TIMEOUT: { type: 'error' as VdmMessageType, text: 'PTT Timeout on an Enabled XMTR.' },
  
  // Reconfiguration messages
  RECONFIG_CANCEL_COMPLETE: { type: 'error' as VdmMessageType, text: 'Reconfiguration Cancel Complete' },
  RECONFIG_CANCEL_ERRORS: { type: 'error' as VdmMessageType, text: 'Reconfiguration Cancel Complete With Errors.' },
  RECONFIG_CANCEL_IN_PROGRESS: { type: 'error' as VdmMessageType, text: 'Reconfiguration Cancel in Progress.' },
  RECONFIG_CANCELLED: { type: 'status' as VdmMessageType, text: 'Reconfiguration Cancelled.' },
  RECONFIG_COMPLETED: { type: 'status' as VdmMessageType, text: 'Reconfiguration Completed.' },
  RECONFIG_COMPLETED_ERRORS: { type: 'error' as VdmMessageType, text: 'Reconfiguration Completed with Errors.' },
  RECONFIG_IN_PROGRESS: { type: 'status' as VdmMessageType, text: 'Reconfiguration in Progress.' },
  
  // REM Mute messages
  REM_MUTE_DENIED_NOT_CLASSMARKED: { type: 'error' as VdmMessageType, text: 'REM Mute Denied: Freq. not classmarked.' },
  REM_MUTE_DENIED_NOT_SELECTED: { type: 'error' as VdmMessageType, text: 'REM Mute Denied: Freq. not selected.' },
  REM_MUTE_DENIED_ON_BUEC: { type: 'error' as VdmMessageType, text: 'REM Mute Denied: Freq. on BUEC.' },
  REM_MUTE_DENIED_RCVR: { type: 'error' as VdmMessageType, text: 'REM Mute Denied: RCVR not selected.' },
  REM_MUTE_XCPL_WARNING: { type: 'warning' as VdmMessageType, text: "REM Muting a XCPL'd freq. negates the XCPL." },
  
  // Simultaneous touches
  SIMULTANEOUS_TOUCHES: { type: 'error' as VdmMessageType, text: 'Simultaneous touches to a display are prohibited.' },
  
  // Site Selection
  SITE_SELECTION_DENIED: { type: 'error' as VdmMessageType, text: 'Site Selection Denied: Position not classmarked for Site Selection.' },
  
  // Split Denied messages
  SPLIT_DENIED_NOT_CLASSMARKED: { type: 'error' as VdmMessageType, text: 'Split Denied: Position not A/G and G/G classmarked.' },
  SPLIT_DENIED_NO_HEADSETS: { type: 'error' as VdmMessageType, text: 'Split Denied: Two headsets are not present.' },
  SPLIT_DENIED_NO_SPEAKERS: { type: 'error' as VdmMessageType, text: 'Split Denied: Two loudspeakers are not present.' },
  
  // TEST messages
  TEST_DENIED_NOT_CLASSMARKED: { type: 'error' as VdmMessageType, text: 'TEST Denied: Freq not Classmarked.' },
  TEST_DENIED_NOT_SELECTED: { type: 'error' as VdmMessageType, text: 'TEST Denied: Freq not selected.' },
  TEST_DISABLED_XCPL: { type: 'error' as VdmMessageType, text: 'TEST disabled XCPL.' },
  
  // Trunk Access
  TRUNK_ACCESS_DENIED: { type: 'error' as VdmMessageType, text: 'Trunk Access Denied: Trunk in-use but not answered.' },
  
  // UTIL test messages
  UTIL_TEST_DENIED_GG: { type: 'error' as VdmMessageType, text: 'UTIL test denied: G/G call in progress.' },
  UTIL_TEST_TERMINATED: { type: 'error' as VdmMessageType, text: 'UTIL test terminated: Position initiated G/G call.' },
  
  // Voice Mon messages
  VOICE_MON_DENIED_LOOP: { type: 'error' as VdmMessageType, text: 'Voice Mon Denied: Possible loop closure.' },
  VOICE_MON_DENIED_ALREADY_ACTIVE: { type: 'error' as VdmMessageType, text: 'Voice Mon Denied: Member Already Active.' },
  VOICE_MON_DENIED_LIMIT: { type: 'error' as VdmMessageType, text: 'Voice Mon Denied: Simultaneous Voice Mon limit reached.' },
  VOICE_MON_DESEL_DENIED_INDEX: { type: 'error' as VdmMessageType, text: 'Voice Mon Deselection Denied: Invalid index number.' },
  VOICE_MON_DESEL_DENIED_SUSPENDED: { type: 'error' as VdmMessageType, text: 'Voice Mon Deselection Denied: Voice Mon cannot be deselected from a suspended state.' },
  VOICE_MON_DISABLED_UNASSIGNED: { type: 'error' as VdmMessageType, text: 'Voice Mon Disabled: Position Unassigned.' },
  
  // XCPL messages
  XCPL_REM_MUTE_WARNING: { type: 'warning' as VdmMessageType, text: 'XCPL a Freq. with a REM Muted RCVR negates the XCPL.' },
  XCPL_DENIED_TEST: { type: 'error' as VdmMessageType, text: 'XCPL Denied: Freq has TEST assigned.' },
  XCPL_DENIED_NOT_CLASSMARKED: { type: 'error' as VdmMessageType, text: 'XCPL Denied: Freq. not classmarked.' },
  XCPL_DENIED_NOT_SELECTED: { type: 'error' as VdmMessageType, text: 'XCPL Denied: Freq. not selected.' },
  XCPL_DENIED_PAIRED: { type: 'error' as VdmMessageType, text: 'XCPL Denied: Freq. paired.' },
} as const;

// R/T Auxiliary Message Area Types
interface CallForwardInfo {
  type: 'DA' | 'IA'; // DA = Direct Access initiated, IA = Interphone Access initiated
  positionLetter?: string; // e.g., "A27"
  sectorNumber?: string; // e.g., "SHIN"
  dialCode?: string; // e.g., "627"
}

interface OverridingPosition {
  position: string; // e.g., "R32", "R44", "SUP1"
  dialCode: string; // e.g., "832", "844", "213"
}

// R/T Auxiliary Message Area Component
// Shows call forwarding info or overriding positions based on R/T state
function RtAuxiliaryMessageArea({ 
  rtEnabled, 
  callForwardInfo, 
  overridingPositions 
}: { 
  rtEnabled: boolean; 
  callForwardInfo: CallForwardInfo | null;
  overridingPositions: OverridingPosition[];
}) {
  // Determine background color based on state
  // R/T ON with override or no forwarding: Green (#008000)
  // R/T OFF or ON with call forwarding: Light blue/cyan (#87CEEB - matching doc images)
  const hasOverride = overridingPositions.length > 0;
  const bgColor = rtEnabled && !callForwardInfo ? '#008000' : '#87CEEB'; // Green when R/T ON without forwarding, light blue otherwise
  const textColor = rtEnabled && !callForwardInfo ? 'white' : 'black';
  
  return (
    <div 
      className="w-full h-full flex flex-col justify-start items-start p-2"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {/* Call Forwarding Display (when active) */}
      {callForwardInfo && (
        <div className="text-sm">
          {callForwardInfo.type === 'DA' ? (
            <>
              <div>CALLS FWD TO:</div>
              <div>{callForwardInfo.positionLetter} {callForwardInfo.sectorNumber}</div>
            </>
          ) : (
            <>
              <div>CALLS FWD TO:</div>
              <div>{callForwardInfo.dialCode}</div>
            </>
          )}
        </div>
      )}
      
      {/* Overriding Positions Display (when R/T ON and being overridden) */}
      {rtEnabled && hasOverride && (
        <div className="text-sm w-full">
          {overridingPositions.map((pos, idx) => (
            <div key={idx} className="flex justify-between w-full">
              <span>{pos.position}</span>
              <span>{pos.dialCode}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// VDM Message Display Component - shows messages in pink area, grey when no message
function VdmMessageDisplay({ message }: { message: VdmMessage | null }) {
  // Pink/salmon background color for messages, grey when no message
  const bgColor = message ? '#FFB6C1' : '#78716c'; // Pink when message, stone-500 grey when none
  
  // Render error icon (triangle with !)
  const ErrorIcon = () => (
    <svg width="40" height="40" viewBox="0 0 40 40" style={{ marginRight: '8px' }}>
      <polygon points="20,5 38,35 2,35" fill="none" stroke="black" strokeWidth="2" />
      <text x="20" y="30" textAnchor="middle" fontSize="20" fontWeight="bold">!</text>
    </svg>
  );
  
  // Render warning icon (rectangle with lines)
  const WarningIcon = () => (
    <svg width="40" height="40" viewBox="0 0 40 40" style={{ marginRight: '8px' }}>
      <rect x="5" y="8" width="30" height="24" fill="none" stroke="black" strokeWidth="2" />
      <line x1="10" y1="15" x2="30" y2="15" stroke="black" strokeWidth="2" />
      <line x1="10" y1="20" x2="30" y2="20" stroke="black" strokeWidth="2" />
      <line x1="10" y1="25" x2="25" y2="25" stroke="black" strokeWidth="2" />
    </svg>
  );
  
  // If no message, show empty grey area
  if (!message) {
    return (
      <div 
        className="col-start-1 col-end-5 w-[335px] h-[80px] mt-2 vscs-empty"
        style={{ backgroundColor: bgColor }}
      />
    );
  }
  
  return (
    <div 
      className="col-start-1 col-end-5 w-[335px] h-[80px] mt-2 flex items-center px-3"
      style={{ backgroundColor: bgColor }}
    >
      {/* Icon based on message type */}
      {message.type === 'error' && <ErrorIcon />}
      {message.type === 'warning' && <WarningIcon />}
      {message.type === 'status' && (
        <span style={{ marginRight: '8px', fontSize: '16px', fontWeight: 'light' }}>***<br/>***</span>
      )}
      
      {/* Message text */}
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ fontSize: '14px', fontWeight: 'light', color: 'black' }}>
          {message.text}
        </div>
        {message.line2 && (
          <div style={{ fontSize: '13px', color: 'black' }}>
            {message.line2}
          </div>
        )}
      </div>
      
      {/* Right side asterisks for status messages */}
      {message.type === 'status' && (
        <span style={{ marginLeft: '8px', fontSize: '16px', fontWeight: 'light' }}>***<br/>***</span>
      )}
    </div>
  );
}
const LINE_TYPE_SHOUT = 2;

// Helper function to find a line ID from position data by dial code
// For override calls: dialCode like "14" matches description "D-14" with lineType 0
// Returns the line ID (first element of the line array) or null if not found
function findLineIdByDialCode(
  positionData: any,
  selectedPosition: any,
  dialCode: string,
  lineType: number
): string | null {
  if (!positionData || !selectedPosition) {
    console.log('VIK: No position data available');
    return null;
  }
  
  // Get the current position's callsign to find its lines
  const posCallsign = selectedPosition.cs;
  
  // Search through all positions in the facility to find the matching one
  const searchPositions = (positions: any[]): any => {
    for (const pos of positions) {
      if (pos.cs === posCallsign) {
        return pos;
      }
    }
    return null;
  };
  
  // Search in root positions array
  let currentPos = null;
  if (positionData.positions && Array.isArray(positionData.positions)) {
    currentPos = searchPositions(positionData.positions);
  }
  
  // If not found in root, search in child facilities
  if (!currentPos && positionData.childFacilities) {
    for (const child of positionData.childFacilities) {
      if (child.positions && Array.isArray(child.positions)) {
        currentPos = searchPositions(child.positions);
        if (currentPos) break;
      }
    }
  }
  
  if (!currentPos || !currentPos.lines) {
    console.log('VIK: Position not found or has no lines:', posCallsign);
    return null;
  }
  
  // Debug: Log all lines being searched
  console.log('VIK: Searching lines for dialCode:', dialCode, 'lineType:', lineType);
  console.log('VIK: Available lines:', currentPos.lines.map((l: any) => `[${l[0]}, type:${l[1]}, desc:${l[2]}]`).join(', '));
  
  // Search for matching line by type and dial code
  // Line format: [id, lineType, description]
  // For override, description is like "D-14", "D-16", "R-10", etc.
  for (const line of currentPos.lines) {
    if (!Array.isArray(line) || line.length < 3) continue;
    
    const [lineId, type, description] = line;
    
    // Check if line type matches
    if (type !== lineType) continue;
    
    // Extract the sector number from description
    // Handle formats like "D-14", "R-10", "D-62", or just numbers
    const descStr = String(description);
    
    // Try to extract just the number from descriptions like "D-14", "R-10", etc.
    // Match pattern: optional prefix (letters/symbols), optional separator (dash/space), then digits
    const match = descStr.match(/^[A-Za-z]*[-\s]?(\d+)$/);
    if (match && match[1] === dialCode) {
      console.log(`VIK: Found line match - ID: ${lineId}, Desc: ${description}, dialCode: ${dialCode}`);
      return String(lineId);
    }
    
    // Also check if description directly matches the dial code
    if (descStr === dialCode) {
      console.log(`VIK: Found direct match - ID: ${lineId}, Desc: ${description}`);
      return String(lineId);
    }
    
    // Also try extracting any number from the description for more flexibility
    const numMatch = descStr.match(/(\d+)/);
    if (numMatch && numMatch[1] === dialCode) {
      console.log(`VIK: Found number match - ID: ${lineId}, Desc: ${description}, dialCode: ${dialCode}`);
      return String(lineId);
    }
  }
  
  console.log(`VIK: No matching line found for dialCode: ${dialCode}, lineType: ${lineType}`);
  return null;
}

// Helper to get available override positions for the current position
function getAvailableOverridePositions(positionData: any, selectedPosition: any): Array<{ id: string; description: string; sectorNum: string }> {
  const overrides: Array<{ id: string; description: string; sectorNum: string }> = [];
  
  if (!positionData || !selectedPosition) return overrides;
  
  const posCallsign = selectedPosition.cs;
  
  // Find current position
  const searchPositions = (positions: any[]): any => {
    for (const pos of positions) {
      if (pos.cs === posCallsign) return pos;
    }
    return null;
  };
  
  let currentPos = null;
  if (positionData.positions && Array.isArray(positionData.positions)) {
    currentPos = searchPositions(positionData.positions);
  }
  
  if (!currentPos && positionData.childFacilities) {
    for (const child of positionData.childFacilities) {
      if (child.positions && Array.isArray(child.positions)) {
        currentPos = searchPositions(child.positions);
        if (currentPos) break;
      }
    }
  }
  
  if (!currentPos || !currentPos.lines) return overrides;
  
  // Extract all override lines (lineType 0)
  for (const line of currentPos.lines) {
    if (!Array.isArray(line) || line.length < 3) continue;
    
    const [lineId, type, description] = line;
    if (type !== LINE_TYPE_OVERRIDE) continue;
    
    const descStr = String(description);
    const match = descStr.match(/^[A-Z]?-?(\d+)$/i);
    const sectorNum = match?.[1] ?? descStr;
    
    overrides.push({
      id: String(lineId),
      description: descStr,
      sectorNum
    });
  }
  
  return overrides;
}

// VIK Keypad Component - overlays on VIK.svg
function VikKeypad() {
  const [displayLine1, setDisplayLine1] = useState('');
  const [displayLine2, setDisplayLine2] = useState('');
  const [dialBuffer, setDialBuffer] = useState('');
  const [callState, setCallState] = useState<VikCallState>('idle');
  const [dispBrightness, setDispBrightness] = useState(100);
  const [keyBrightness, setKeyBrightness] = useState(100);
  const [keysIlluminated, setKeysIlluminated] = useState(false);
  const [activeLineId, setActiveLineId] = useState<string | null>(null); // Track the active line ID for release
  const [showBrightnessScale, setShowBrightnessScale] = useState<'disp' | 'key' | null>(null); // Show brightness scale in display
  
  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  const positionData = useCoreStore((s: any) => s.positionData);
  const selectedPositions = useCoreStore((s: any) => s.selectedPositions);
  const gg_status = useCoreStore((s: any) => s.gg_status);
  
  // Get current selected position
  const currentPosition = selectedPositions && selectedPositions.length > 0 ? selectedPositions[0] : null;

  // Determine call type prompt based on first digit
  const getCallTypePrompt = (firstDigit: string): string => {
    switch (firstDigit) {
      case '0': return VIK_MESSAGES.IC_CALL;       // Intercom call within facility
      case '1': return VIK_MESSAGES.DIAL_CODE;    // PABX - external phone network
      case '3': return VIK_MESSAGES.MEET_ME_CALL; // Meet-Me conference
      case '4': return VIK_MESSAGES.IP_CALL;      // Interphone call to other facility
      case '5': return VIK_MESSAGES.OVR_CALL;     // Override - Tracker position
      case '6': return VIK_MESSAGES.OVR_CALL;     // Override - Assistant position
      case '7': return VIK_MESSAGES.OVR_CALL;     // Override - Data position
      case '8': return VIK_MESSAGES.OVR_CALL;     // Override - Radar position
      case '9': return VIK_MESSAGES.OVR_CALL;     // Override - Coordinator position
      case '2': return VIK_MESSAGES.OVR_CALL;     // Override - Non-ATC position
      case '*': return VIK_MESSAGES.SPEED_DIAL;   // Speed dial function
      default: return VIK_MESSAGES.DIAL_CODE;
    }
  };

  // Check if the dial buffer is complete and should auto-initiate the call
  // Returns true if call should be auto-initiated based on dial code format (Table 6-2)
  const shouldAutoInitiate = (buffer: string): boolean => {
    if (buffer.length < 2) return false;
    
    const firstDigit = buffer[0];
    const targetCode = buffer.substring(1);
    
    // Override calls (5,6,7,8,9,2): ss(s) format - 2-3 digits for sector
    // Auto-initiate when we have a valid line match
    if (['5', '6', '7', '8', '9', '2'].includes(firstDigit || '')) {
      // Try to find matching line - if found, auto-initiate
      const lineId = findLineIdByDialCode(positionData, currentPosition, targetCode, LINE_TYPE_OVERRIDE);
      if (lineId) return true;
      // If 3 digits entered and no match, also trigger (will show INVALID CODE)
      if (targetCode.length >= 3) return true;
    }
    
    // IC calls (0): Check for line match
    if (firstDigit === '0' && targetCode.length >= 2) {
      const lineId = findLineIdByDialCode(positionData, currentPosition, targetCode, LINE_TYPE_RING);
      if (lineId) return true;
      if (targetCode.length >= 3) return true;
    }
    
    // IP calls (4): ddd format - 3 digits
    if (firstDigit === '4' && targetCode.length >= 3) {
      return true;
    }
    
    // Meet-Me (3): ddd format - 3 digits
    if (firstDigit === '3' && targetCode.length >= 3) {
      return true;
    }
    
    // PABX (1): Variable length - need # to confirm, don't auto-initiate
    
    return false;
  };

  // Initiate call with current dial buffer (extracted for reuse)
  const initiateCall = () => {
    if (dialBuffer.length < 2) return;
    
    console.log('VIK: Initiating call to:', dialBuffer);
    
    const firstDigit = dialBuffer[0] || '';
    const targetCode = dialBuffer.substring(1);
    
    // Ring timeout timer ID for cleanup
    let ringTimeoutId: ReturnType<typeof setTimeout> | null = null;
    
    // Helper to set up call with ring timeout handling
    const initiateCallWithTimeout = (lineId: string, displayText: string, dbl1: number) => {
      setDisplayLine1(VIK_MESSAGES.CALL_RINGING);
      setDisplayLine2(displayText);
      setActiveLineId(lineId);
      sendMsg({ type: 'call', cmd1: lineId, dbl1 });
      setCallState('ringing');
      setKeysIlluminated(false); // Keys no longer illuminated during call
      
      // Set up ring timeout (30 seconds per typical VSCS behavior)
      ringTimeoutId = setTimeout(() => {
        setCallState(currentState => {
          if (currentState === 'ringing') {
            setDisplayLine1(VIK_MESSAGES.RING_TIME_OUT);
            setDisplayLine2('');
            setTimeout(() => {
              setDisplayLine1('');
              setDisplayLine2('');
              setDialBuffer('');
              setActiveLineId(null);
              setCallState('idle');
            }, 3000);
            return 'timeout';
          }
          return currentState;
        });
      }, 30000);
      
      // Simulate call connecting (2 seconds for demo)
      setTimeout(() => {
        setCallState(currentState => {
          if (currentState === 'ringing') {
            if (ringTimeoutId) clearTimeout(ringTimeoutId);
            setDisplayLine1(VIK_MESSAGES.CALL_ACTIVE);
            return 'active';
          }
          return currentState;
        });
      }, 2000);
    };
    
    if (['5', '6', '7', '8', '9', '2'].includes(firstDigit)) {
      // Override call
      const lineId = findLineIdByDialCode(positionData, currentPosition, targetCode, LINE_TYPE_OVERRIDE);
      
      if (lineId) {
        initiateCallWithTimeout(lineId, `D-${targetCode}`, 0);
      } else {
        console.log('VIK: Override line not found for code:', targetCode);
        setDisplayLine1(VIK_MESSAGES.INVALID_CODE);
        setDisplayLine2(dialBuffer);
        setTimeout(() => {
          setDisplayLine1('');
          setDisplayLine2('');
          setDialBuffer('');
          setCallState('idle');
          setKeysIlluminated(false);
        }, 2000);
      }
    } else if (firstDigit === '0') {
      // IC call
      const lineId = findLineIdByDialCode(positionData, currentPosition, targetCode, LINE_TYPE_RING);
      
      if (lineId) {
        initiateCallWithTimeout(lineId, dialBuffer, 1);
      } else {
        setDisplayLine1(VIK_MESSAGES.INVALID_CODE);
        setDisplayLine2(dialBuffer);
        setTimeout(() => {
          setDisplayLine1('');
          setDisplayLine2('');
          setDialBuffer('');
          setCallState('idle');
          setKeysIlluminated(false);
        }, 2000);
      }
    } else if (firstDigit === '4') {
      // IP call
      const lineId = findLineIdByDialCode(positionData, currentPosition, targetCode, LINE_TYPE_RING);
      
      if (lineId) {
        initiateCallWithTimeout(lineId, dialBuffer, 1);
      } else {
        setDisplayLine1(VIK_MESSAGES.INVALID_CODE);
        setDisplayLine2(dialBuffer);
        setTimeout(() => {
          setDisplayLine1('');
          setDisplayLine2('');
          setDialBuffer('');
          setCallState('idle');
          setKeysIlluminated(false);
        }, 2000);
      }
    } else if (firstDigit === '1') {
      // PABX call
      setDisplayLine1(VIK_MESSAGES.DIALING_COMPLETE);
      setDisplayLine2(dialBuffer);
      setActiveLineId(targetCode);
      sendMsg({ type: 'call', cmd1: targetCode, dbl1: 2 });
      setCallState('ringing');
      setKeysIlluminated(false);
      
      setTimeout(() => {
        setCallState(currentState => {
          if (currentState === 'ringing') {
            setDisplayLine1(VIK_MESSAGES.CALL_ACTIVE);
            return 'active';
          }
          return currentState;
        });
      }, 2000);
    } else if (firstDigit === '3') {
      // Meet-Me conference
      setDisplayLine1(VIK_MESSAGES.CALL_RINGING);
      setDisplayLine2(dialBuffer);
      setActiveLineId(targetCode);
      sendMsg({ type: 'call', cmd1: targetCode, dbl1: 3 });
      setCallState('ringing');
      setKeysIlluminated(false);
      
      setTimeout(() => {
        setCallState(currentState => {
          if (currentState === 'ringing') {
            setDisplayLine1(VIK_MESSAGES.MEET_ME_CONF);
            return 'active';
          }
          return currentState;
        });
      }, 2000);
    } else {
      // Generic call fallback
      setDisplayLine1(VIK_MESSAGES.CALL_RINGING);
      setDisplayLine2(dialBuffer);
      setActiveLineId(dialBuffer);
      sendMsg({ type: 'call', cmd1: dialBuffer, dbl1: 2 });
      setCallState('ringing');
      setKeysIlluminated(false);
      
      setTimeout(() => {
        setCallState(currentState => {
          if (currentState === 'ringing') {
            setDisplayLine1(VIK_MESSAGES.CALL_ACTIVE);
            return 'active';
          }
          return currentState;
        });
      }, 2000);
    }
  };

  const handleNumberPress = (num: string) => {
    if (callState === 'idle') {
      // Must press INIT first
      return;
    }
    
    if (callState === 'ready' || callState === 'dialing') {
      // Play DTMF tone for the pressed key
      playDTMFTone(num);
      
      const newBuffer = dialBuffer + num;
      setDialBuffer(newBuffer);
      
      if (dialBuffer.length === 0) {
        // First digit entered - show call type prompt
        const prompt = getCallTypePrompt(num);
        setDisplayLine1(prompt);
        setDisplayLine2(num);
        setCallState('dialing');
      } else {
        // Subsequent digits
        setDisplayLine2(newBuffer);
      }
      
      // Check if we should auto-initiate the call
      // Use setTimeout to allow state to update first
      setTimeout(() => {
        if (shouldAutoInitiate(newBuffer)) {
          initiateCall();
        }
      }, 100);
    }
  };

  const handleBackspace = () => {
    if (!keysIlluminated) return;
    
    if (dialBuffer.length > 0) {
      const newBuffer = dialBuffer.slice(0, -1);
      setDialBuffer(newBuffer);
      
      if (newBuffer.length === 0) {
        setDisplayLine1(VIK_MESSAGES.READY);
        setDisplayLine2('');
        setCallState('ready');
      } else if (newBuffer.length === 1 && newBuffer[0]) {
        const prompt = getCallTypePrompt(newBuffer[0]);
        setDisplayLine1(prompt);
        setDisplayLine2(newBuffer);
      } else {
        setDisplayLine2(newBuffer);
      }
    }
  };

  const handleInit = () => {
    console.log('VIK handleInit called - callState:', callState, 'dialBuffer:', dialBuffer);
    
    if (callState === 'idle') {
      // Enter ready state - READY is displayed, numeric matrix and backspace key illuminate
      setDisplayLine1(VIK_MESSAGES.READY);
      setDisplayLine2('');
      setDialBuffer('');
      setCallState('ready');
      setKeysIlluminated(true);
    } else if (callState === 'active') {
      // Per Table 3-4: "If call active, displays READY but does not release call."
      setDisplayLine1(VIK_MESSAGES.READY);
      // Keep the call active, don't release
    } else if (callState === 'dialing' && dialBuffer.length >= 2) {
      // Manual initiation for PABX calls that need # or explicit INIT
      // Most calls auto-initiate, but PABX (1xxx) requires explicit confirmation
      const firstDigit = dialBuffer[0] || '';
      if (firstDigit === '1') {
        // PABX call - initiate on INIT press
        initiateCall();
      }
      // Other call types auto-initiate when digits complete, INIT does nothing extra
    } else if (callState === 'ready') {
      // Already in ready state, INIT does nothing
    }
  };

  const handleRelease = () => {
    if (callState === 'active' || callState === 'ringing') {
      // Release active call using the stored line ID
      console.log('VIK: Releasing call, lineId:', activeLineId);
      
      if (activeLineId) {
        // Determine the correct dbl1 based on the call type (first digit of dialBuffer)
        const firstDigit = dialBuffer[0] || '';
        let dbl1 = 2; // Default
        let isShoutOverride = false;
        if (['5', '6', '7', '8', '9', '2'].includes(firstDigit)) {
          dbl1 = 1; // Override (SO lines use dbl1: 1)
          isShoutOverride = true;
        } else if (firstDigit === '0' || firstDigit === '4') {
          dbl1 = 2; // IC/IP ring
        }
        
        // Search gg_status to find the actual call_id to use for release
        // The VIK stores the line ID (e.g., "1010007") but we need to find 
        // the corresponding call_id format that WebSocket expects
        let call_id = activeLineId;
        
        // Find active call in gg_status that matches our line ID
        const activeCall = (gg_status || []).find((call: any) => {
          if (!call || !call.call) return false;
          const fullCall = call.call;
          // Check if this call's ID matches our activeLineId
          // SO_ format: "SO_1010007" -> "1010007"
          // gg_ format: "gg_05_1010007" -> "1010007"
          if (fullCall.startsWith('SO_')) {
            return fullCall.substring(3) === activeLineId;
          } else if (fullCall.startsWith('gg_')) {
            return fullCall.substring(6) === activeLineId;
          }
          // Also check direct substring match
          return fullCall.includes(activeLineId);
        });
        
        if (activeCall) {
          const fullCall = activeCall.call;
          // Extract call_id the same way testFunc does
          if (fullCall?.startsWith('SO_')) {
            call_id = fullCall.substring(3);
            isShoutOverride = true;
          } else if (fullCall?.startsWith('gg_')) {
            call_id = fullCall.substring(6);
          } else {
            call_id = fullCall?.substring(5) || activeLineId;
          }
          console.log('VIK: Found active call in gg_status:', fullCall, '-> call_id:', call_id);
        } else {
          console.log('VIK: No matching call found in gg_status, using activeLineId:', activeLineId);
        }
        
        console.log('VIK: Sending stop command, call_id:', call_id, 'dbl1:', isShoutOverride ? 1 : dbl1);
        sendMsg({ type: 'stop', cmd1: call_id, dbl1: isShoutOverride ? 1 : dbl1 });
      }
      
      setDisplayLine1(VIK_MESSAGES.CALL_RELEASED);
      setDisplayLine2('');
      setCallState('released');
      
      // Clear after 3 seconds
      setTimeout(() => {
        setDisplayLine1('');
        setDisplayLine2('');
        setDialBuffer('');
        setActiveLineId(null);
        setCallState('idle');
        setKeysIlluminated(false);
      }, 3000);
    } else if (callState === 'ready' || callState === 'dialing') {
      // Cancel dial mode
      setDisplayLine1('');
      setDisplayLine2('');
      setDialBuffer('');
      setActiveLineId(null);
      setCallState('idle');
      setKeysIlluminated(false);
    } else if (callState === 'timeout' || callState === 'busy' || callState === 'denied') {
      // Clear error states
      setDisplayLine1('');
      setDisplayLine2('');
      setDialBuffer('');
      setActiveLineId(null);
      setCallState('idle');
      setKeysIlluminated(false);
    }
  };

  // Handle BUSY response from WebSocket (can be called externally when position is busy)
  const handleBusy = () => {
    if (callState === 'ringing') {
      setDisplayLine1(VIK_MESSAGES.BUSY);
      setDisplayLine2('');
      setCallState('busy');
      
      // Return to ready after 3 seconds
      setTimeout(() => {
        setDisplayLine1(VIK_MESSAGES.READY);
        setDisplayLine2('');
        setActiveLineId(null);
        setCallState('ready');
      }, 3000);
    }
  };

  // Handle ALREADY ACTIVE error
  const handleAlreadyActive = () => {
    setDisplayLine1(VIK_MESSAGES.ALREADY_ACTIVE);
    setDisplayLine2('');
    
    setTimeout(() => {
      setDisplayLine1(VIK_MESSAGES.READY);
      setDisplayLine2('');
      setCallState('ready');
    }, 2000);
  };

  const handleStarUp = () => {
    // *↑ typically used for volume or special functions
    if (keysIlluminated) {
      handleNumberPress('*');
    }
  };

  const handleHashDown = () => {
    // #↓ often used to confirm/send dial string (like PABX calls)
    if (keysIlluminated && callState === 'dialing' && dialBuffer.length >= 2) {
      // For PABX calls, # confirms the number
      if (dialBuffer[0] === '1') {
        handleInit(); // Same as pressing INIT to confirm
      } else {
        handleNumberPress('#');
      }
    }
  };

  // Pad display lines for rendering - show brightness scale in lower right corner when adjusting
  let line1Padded = displayLine1.padEnd(14, ' ');
  let line2Padded = displayLine2.padEnd(14, ' ');
  
  if (showBrightnessScale === 'disp') {
    // Show DISP brightness scale (01-100) in lower right corner of line 2
    const brightnessStr = String(dispBrightness).padStart(3, '0');
    line2Padded = line2Padded.slice(0, 8.7) + brightnessStr;
  } else if (showBrightnessScale === 'key') {
    // Show KEY brightness scale (01-100) in lower right corner of line 2
    const brightnessStr = String(keyBrightness).padStart(3, '0');
    line2Padded = line2Padded.slice(0, 11) + brightnessStr;
  }
  
  // Determine button brightness based on illumination state
  // Per Table 3-4: Numeric matrix illuminated from behind when VIK is active
  // Backspace illuminated when keypad is enabled for operator input
  const numpadBrightness = keysIlluminated ? keyBrightness : 20;
  const backspaceBrightness = keysIlluminated ? keyBrightness : 20;
  // INIT and RLS are continuously illuminated per Table 3-4
  const initRlsBrightness = 100;

  return (
    <div style={{ position: 'relative', width: '300px', height: '800px' }}>
      {/* VIK.svg as background */}
      <img 
        src="/VIK.svg" 
        alt="VIK" 
        style={{ 
          width: '300px', 
          height: '800px',
          position: 'absolute',
          top: 0,
          left: 0,
        }} 
      />
      
      {/* LCD Display overlay - no background, just the dot matrix characters */}
      <div style={{
        position: 'absolute',
        top: '160px',
        left: '30px',
        width: '270px',
        height: '85px',
        padding: '8px 6px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '6px',
        pointerEvents: 'none',
      }}>
        {/* Line 1 */}
        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
          {line1Padded.split('').map((char, i) => (
            <DotMatrixChar key={i} char={char} color="#FFD700" brightness={dispBrightness} />
          ))}
        </div>
        {/* Line 2 */}
        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
          {line2Padded.split('').map((char, i) => (
            <DotMatrixChar key={i} char={char} color="#FFD700" brightness={dispBrightness} />
          ))}
        </div>
      </div>

      {/* Function buttons overlay: Back, INIT, RLS */}
      <div style={{
        position: 'absolute',
        top: '255px',
        left: '17px',
        width: '259px',
        display: 'flex',
        gap: '27px',
        justifyContent: 'center',
      }}>
        <GlowButton 
          onClick={handleBackspace} 
          glowColor="#C4A000" 
          width="80px" 
          height="70px"
          brightness={backspaceBrightness}
        >
        </GlowButton>
        <GlowButton 
          onClick={handleInit} 
          glowColor="#4CAF50" 
          width="80px" 
          height="70px"
          brightness={initRlsBrightness}
        >
        </GlowButton>
        <GlowButton 
          onClick={handleRelease} 
          glowColor="#F44336" 
          width="80px" 
          height="70px"
          brightness={initRlsBrightness}
        >
        </GlowButton>
      </div>

      {/* Number pad */}
      <div style={{
        position: 'absolute',
        top: '362px',
        left: '20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 60px)',
        gridTemplateRows: 'repeat(4, 60px)',
        gap: '11px',
      }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((num, idx) => (
          <GlowButton
            key={`numpad-${idx}`}
            onClick={() => {
              if (num === '*') handleStarUp();
              else if (num === '#') handleHashDown();
              else handleNumberPress(num);
            }}
            glowColor="#888888"
            brightness={numpadBrightness}
          >
          </GlowButton>
        ))}
      </div>

      {/* DISP brightness control - spans rows 1-2 */}
      <div style={{
        position: 'absolute',
        top: '362px',
        left: '240px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0px',
      }}>
        <GlowButton
          onClick={() => {
            setDispBrightness(prev => Math.min(100, prev + 10));
            setShowBrightnessScale('disp');
            // Hide scale after 2 seconds
            setTimeout(() => setShowBrightnessScale(null), 2000);
          }}
          glowColor="#FFB300"
          width="40px"
          height="58px"
          brightness={100}
        >
        </GlowButton>
        <GlowButton
          onClick={() => {
            setDispBrightness(prev => Math.max(1, prev - 10));
            setShowBrightnessScale('disp');
            setTimeout(() => setShowBrightnessScale(null), 2000);
          }}
          glowColor="#FFB300"
          width="40px"
          height="58px"
          brightness={100}
        >
        </GlowButton>
      </div>

      {/* KEY brightness control - spans rows 3-4 */}
      <div style={{
        position: 'absolute',
        top: '505px',
        left: '240px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0px',
      }}>
        <GlowButton
          onClick={() => {
            setKeyBrightness(prev => Math.min(100, prev + 10));
            setShowBrightnessScale('key');
            setTimeout(() => setShowBrightnessScale(null), 2000);
          }}
          glowColor="#FFB300"
          width="40px"
          height="59px"
          brightness={100}
        >
        </GlowButton>
        <GlowButton
          onClick={() => {
            setKeyBrightness(prev => Math.max(1, prev - 10));
            setShowBrightnessScale('key');
            setTimeout(() => setShowBrightnessScale(null), 2000);
          }}
          glowColor="#FFB300"
          width="40px"
          height="59px"
          brightness={100}
        >
        </GlowButton>
      </div>
    </div>
  );
}

// Individual VSCS Panel Component
function VscsPanel(props: VscsProps & { panelId?: string; defaultScreenMode?: string }) {
  const [page, setPage] = useState(1);
  const [func, setFunc] = useState('PRI');
  const [screenMode, setScreenMode] = useState(props.defaultScreenMode || 'GG1'); // Use default or fallback to 'GG1'
  const [isAltScreen, setIsAltScreen] = useState(false); // Track if we're in alternate screen selection mode
  const [rtEnabled, setRtEnabled] = useState(false); // Track R/T button state (default OFF)
  const [callForwardInfo, setCallForwardInfo] = useState<CallForwardInfo | null>(null); // Track call forwarding info
  const [overridingPositions, setOverridingPositions] = useState<OverridingPosition[]>([]); // Track positions overriding this one
  const [emergencyPttPressed, setEmergencyPttPressed] = useState({
    uhf: false,
    both: false,
    vhf: false
  }); // Track emergency PTT button press states
  const [vdmMessage, setVdmMessage] = useState<VdmMessage | null>(null); // VDM message display state
  
  const gg_status = useCoreStore((s: any) => s.gg_status);
  const ag_status = useCoreStore((s: any) => s.ag_status);
  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  const positionData = useCoreStore((s: any) => s.positionData);
  const overrideStatus = useCoreStore((s: any) => s.overrideStatus); // OV_ calls from WebSocket
  const isBeingOverridden = useCoreStore((s: any) => s.isBeingOverridden); // Active override state
  const selectedPositions = useCoreStore((s: any) => s.selectedPositions);
  
  // Get the currently selected position for line type lookups
  const currentPosition = selectedPositions && selectedPositions.length > 0 ? selectedPositions[0] : null;
  
  // Update overridingPositions from WebSocket OV_ data
  useEffect(() => {
    if (overrideStatus && Array.isArray(overrideStatus)) {
      // Filter for active overrides and map to OverridingPosition format
      const activeOverrides = overrideStatus
        .filter((ov: any) => ov && (ov.status === 'ok' || ov.status === 'active'))
        .map((ov: any) => ({
          position: ov.call_name || ov.call?.substring(3) || 'Unknown',
          dialCode: ov.call?.substring(3) || ''
        }));
      
      setOverridingPositions(activeOverrides);
      
      // Log for debugging
      if (activeOverrides.length > 0) {
        console.log('[VSCS] Override positions updated:', activeOverrides);
      }
    } else {
      setOverridingPositions([]);
    }
  }, [overrideStatus]);
  
  // Helper function to show VDM message with optional auto-dismiss
  const showVdmMessage = (message: VdmMessage, autoDismissMs?: number) => {
    setVdmMessage(message);
    if (autoDismissMs) {
      setTimeout(() => setVdmMessage(null), autoDismissMs);
    }
  };
  
  // Helper to show VDM message from predefined messages
  const showVdmError = (messageKey: keyof typeof VDM_MESSAGES, autoDismissMs: number = 5000) => {
    const msg = VDM_MESSAGES[messageKey];
    showVdmMessage(msg, autoDismissMs);
  };
  
  // Check if guard frequencies (121.500, 243.000) are currently active in A/G status
  const hasGuardFrequencies = useMemo(() => {
    if (!ag_status || !Array.isArray(ag_status)) return false;
    
    // Guard frequencies in both MHz and Hz formats to handle different WebSocket data formats
    const guardFreqsMHz = [121.5, 121.500, 243.0, 243.000];
    const guardFreqsHz = [121500000, 121500000.0, 243000000, 243000000.0];
    
    // Check if any of the A/G frequencies in the WebSocket data are guard frequencies
    return ag_status.some((agData: any) => {
      if (!agData || !agData.freq) return false;
      const freq = parseFloat(agData.freq);
      // Check both MHz and Hz values
      return guardFreqsMHz.includes(freq) || guardFreqsHz.includes(freq);
    });
  }, [ag_status]);
  
  const ITEMS_PER_PAGE = 27;
  
  const currentSlice = useMemo(() => {
    // Determine which page to use based on screen mode
    let currentPage = 1;
    if (screenMode === 'GG2') {
      currentPage = 2;
    } else if (screenMode === 'GG1') {
      currentPage = 1;
    }
    
    // Implement overflow logic: if there are more G/G entries than can fit on page 1,
    // automatically overflow them to page 2
    if (currentPage === 1) {
      // Page 1: show first ITEMS_PER_PAGE items
      const slice = gg_status.slice(0, ITEMS_PER_PAGE);
      // Pad with empty slots if needed
      if (slice.length < ITEMS_PER_PAGE) {
        return [...slice, ...new Array(ITEMS_PER_PAGE - slice.length).fill(undefined)];
      }
      return slice;
    } else if (currentPage === 2) {
      // Page 2: show overflow items (items beyond ITEMS_PER_PAGE)
      const slice = gg_status.slice(ITEMS_PER_PAGE);
      // Limit to ITEMS_PER_PAGE items and pad if needed
      const limitedSlice = slice.slice(0, ITEMS_PER_PAGE);
      if (limitedSlice.length < ITEMS_PER_PAGE) {
        return [...limitedSlice, ...new Array(ITEMS_PER_PAGE - limitedSlice.length).fill(undefined)];
      }
      return limitedSlice;
    } else {
      // For other pages, return empty array padded to ITEMS_PER_PAGE
      return new Array(ITEMS_PER_PAGE).fill(undefined);
    }
    }, [gg_status, screenMode]);

  const btns: Button[] = useMemo(() => {
    // Calculate offset based on screen mode for correct JSON line type lookup
    const indexOffset = screenMode === 'GG2' ? ITEMS_PER_PAGE : 0;
    
    return currentSlice.map((data: any, index: number) => {
      if (!data) {
        // Empty/unavailable button
        return {
          shortName: '',
          longName: '',
          target: '',
          type: ButtonType.NONE,
        };
      }
      
      // Get line type from JSON based on absolute button index (with offset for page 2)
      const absoluteIndex = index + indexOffset;
      let lineType = null;
      if (currentPosition && currentPosition.lines && Array.isArray(currentPosition.lines)) {
        const line = currentPosition.lines[absoluteIndex];
        if (Array.isArray(line) && line.length >= 2) {
          lineType = line[1]; // Get line type (0, 1, or 2)
        }
      }
      
      const buttonType = mapLineTypeToButtonType(lineType);
      
      // Convert WebSocket data to Button format
      return {
        shortName: data.call_name || data.call?.substring(5) || '',
        longName: data.call_name || data.call?.substring(5) || '',
        target: data.call?.substring(5) || '',
        type: buttonType,
      };
    });
  }, [currentSlice, currentPosition, screenMode]);

  // Generate multi-line data for G/G buttons
  const generateGGMultiLineData = (data: any, buttonIndex: number) => {
    if (!data) return undefined;
    
    // Extract meaningful parts from the data
    const callId = data.call?.substring(5) || '';
    const callName = data.call_name || callId;
    
    // Parse the call_name or call to extract different components
    // Don't split on hyphens to avoid breaking "D-42" into "D" and "42"
    const parts = callName.split(/[_\s]/); // Only split on underscore and space, not hyphen
    
    // Get line type from JSON based on button index
    let lineType = null;
    console.log('Debug - Button index:', buttonIndex, 'Call name:', callName);
    
    if (currentPosition && currentPosition.lines && Array.isArray(currentPosition.lines)) {
      const line = currentPosition.lines[buttonIndex];
      if (Array.isArray(line) && line.length >= 2) {
        lineType = line[1]; // Get line type (0, 1, or 2)
        console.log('Debug - Found line type:', lineType, 'for button', buttonIndex, 'line:', line);
      }
    }
    
    console.log('Debug - Final line type for button', buttonIndex, ':', lineType);
    
    // Split callName by commas if it contains them
    const callNameParts = callName.includes(',') ? callName.split(',').map((part: string) => part.trim()) : [callName];
    
    // Determine display based on line type from JSON
    let line1Content, line2Content, line3Content, line4Content, line5Content;
    
    if (lineType === 2) {
      // Shout lines: speaker icon will be handled by the component on line1, distribute call name parts across lines 2-5
      line1Content = '';
      line2Content = callNameParts[0] || '';
      line3Content = callNameParts[1] || '';
      line4Content = callNameParts[2] || '';
      line5Content = callNameParts[3] || '';
    } else if (lineType === 1) {
      // Ring lines: empty line1, distribute call name parts across lines 2-4, RING on line5
      line1Content = '';
      line2Content = callNameParts[0] || '';
      line3Content = callNameParts[1] || '';
      line4Content = callNameParts[2] || '';
      line5Content = callNameParts[3] || 'RING';
    } else if (lineType === 0) {
      // Override lines: empty line1, distribute call name parts across lines 2-4, OVRD on line5
      line1Content = '';
      line2Content = callNameParts[0] || '';
      line3Content = callNameParts[1] || '';
      line4Content = callNameParts[2] || '';
      line5Content = callNameParts[3] || 'OVRD';
    } else {
      // Default: empty line1, distribute call name parts across lines 2-4, RING on line5
      line1Content = '';
      line2Content = callNameParts[0] || '';
      line3Content = callNameParts[1] || '';
      line4Content = callNameParts[2] || '';
      line5Content = callNameParts[3] || 'RING';
    }
    
    return {
      line1: line1Content, // Reserved for indicators (speaker icon, etc.)
      line2: line2Content, // First part of call name
      line3: line3Content, // Second part of call name (or frequency if no comma split)
      line4: line4Content, // Third part of call name (or status info if no comma split)
      line5: line5Content // Fourth part of call name or type indicator (RING, OVRD, etc.)
    };
  };
  const [buttons, setButtons] = useState(btns);
  const testFunc = (a: string, b: ButtonType) => {
    console.log('testFunc called with:', { target: a, type: b });
    
    // Don't allow clicks on buttons with no data (unavailable buttons)
    if (!a || !b || b === ButtonType.NONE) {
      console.log('Rejecting click - invalid target or type');
      return;
    }
    
    // Find the button data from gg_status
    const buttonData = currentSlice.find((data: any) => 
      data && data.call?.substring(5) === a
    );
    
    console.log('Found button data:', buttonData);
    console.log('Full call string:', buttonData?.call);
    console.log('Call prefix:', buttonData?.call?.substring(0, 2));
    console.log('Call ID:', buttonData?.call?.substring(5));
    
    // Only proceed if we have valid button data
    if (buttonData) {
      // Extract call ID properly - handle different formats
      let call_id;
      const fullCall = buttonData.call;
      
      if (fullCall?.startsWith('SO_')) {
        // Shout/Override format: "SO_891" -> "891"
        call_id = fullCall.substring(3);
      } else if (fullCall?.startsWith('gg_')) {
        // Ground-Ground format: "gg_05_123" -> "123" (skip "gg_05_")  
        call_id = fullCall.substring(6);
      } else {
        // Fallback to original logic
        call_id = fullCall?.substring(5) || '';
      }
      
      console.log('Processing call for ID:', call_id, 'Status:', buttonData.status, 'Full call:', fullCall);
      
      // Add immediate visual feedback - find the button element
      const buttonIndex = currentSlice.findIndex((data: any) => 
        data && data.call?.substring(5) === a
      );
      const buttonEl = document.querySelector(`.vscs-panel .grid .gg-button:nth-child(${buttonIndex + 1})`);
      
      // Handle different statuses based on IVSR/ETVS implementations
      // Check if this is a Shout/Override line (SO prefix)
      const isShoutOverride = buttonData.call?.startsWith('SO_');
      
      switch (buttonData.status) {
        case 'idle':
        case '':
        case 'off':
          // Add immediate "calling" visual feedback
          if (buttonEl) {
            buttonEl.classList.remove('state-active', 'state-busy', 'state-ringing', 'state-hold', 'state-unavailable');
            buttonEl.classList.add('state-ringing'); // Show amber flashing while calling
          }
          // Connect call
          console.log('Initiating call to:', call_id);
          sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 });
          break;
          
        case 'ok':
        case 'active':
          // Add immediate visual feedback for disconnecting
          if (buttonEl) {
            buttonEl.classList.remove('state-active', 'state-busy', 'state-ringing', 'state-hold', 'state-unavailable');
            // Brief flash to show action taken, will be updated by WebSocket response
          }
          // Disconnect call - use dbl1: 1 for SO lines, dbl1: 2 for others
          console.log('Disconnecting call from:', call_id, 'isShoutOverride:', isShoutOverride);
          sendMsg({ type: 'stop', cmd1: call_id, dbl1: isShoutOverride ? 1 : 2 });
          break;
          
        case 'chime':
        case 'ringing':
        case 'online':
          // Answer/Join incoming call - follow IVSR pattern exactly
          console.log('Answering incoming call from:', call_id, 'with status:', buttonData.status, 'isShoutOverride:', isShoutOverride);
          if (isShoutOverride && (buttonData.status === 'online' || buttonData.status === 'chime')) {
            // For SO lines with online/chime status, use 'call' to join
            const message = { type: 'call', cmd1: call_id, dbl1: 2 };
            console.log('Sending message for SO line:', message);
            sendMsg(message);
          } else {
            // For ALL other incoming calls (chime/ringing/online), use 'stop' with dbl1: 2 (IVSR pattern)
            const message = { type: 'stop', cmd1: call_id, dbl1: 2 };
            console.log('Sending message for regular line:', message);
            sendMsg(message);
          }
          break;
          
        case 'busy':
          // Show VDM message for busy line
          showVdmMessage({ type: 'status', text: 'Call Denied:', line2: 'Destination busy.' }, 5000);
          console.log('Line is busy:', buttonData.status);
          break;
        case 'hold':
          // Show VDM message for hold state
          showVdmError('HOLD_DENIED_NOT_ACTIVE', 5000);
          console.log('Call is on hold:', buttonData.status);
          break;
        case 'pending':
        case 'terminate':
        case 'overridden':
          // No action allowed for these states - show message
          showVdmMessage({ type: 'status', text: 'Call Denied:', line2: 'No response to call action.' }, 5000);
          console.log('No action available for status:', buttonData.status);
          break;
          
        default:
          // Default action - try to connect
          if (buttonEl) {
            buttonEl.classList.remove('state-active', 'state-busy', 'state-ringing', 'state-hold', 'state-unavailable');
            buttonEl.classList.add('state-ringing'); // Show amber flashing while calling
          }
          sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 });
          break;
      }
    }
    // If no buttonData found, do nothing (button is unavailable)
  };

  const callAnsBtn = () => {
    const toAnswer = props.incomingLandlines[0];
    if (toAnswer) {
  testFunc(toAnswer.from ?? '', toAnswer.type as CALL_TYPE & ButtonType);
    } else {
      props.playError();
    }
  };

  const swapPages = () => {
    if (screenMode === 'GG1') {
      setScreenMode('GG2');
    } else if (screenMode === 'GG2') {
      setScreenMode('GG1');
    } else if (screenMode === 'AG1') {
      setScreenMode('AG2');
    } else if (screenMode === 'AG2') {
      setScreenMode('AG1');
    }
  };

  const funcAltBtn = () => {
    if (func === 'PRI') {
      setFunc('ALT');
    } else {
      setFunc('PRI');
    }
  };

  const scrnAltBtn = () => {
    if (!isAltScreen) {
      // Enter alternate screen selection mode
      setIsAltScreen(true);
    } else {
      // Exit alternate screen selection mode, return to current screen
      setIsAltScreen(false);
    }
  };

  const selectScreen = (screen: string) => {
    setScreenMode(screen);
    setIsAltScreen(false); // Exit screen selection mode
  };

  // Clean up any lingering elements when screen mode changes
  useEffect(() => {
    // When switching to G/G screens, clean up any A/G button states that might persist
    if (screenMode.startsWith('GG')) {
      // AGGRESSIVE cleanup - remove state-unselected from ALL elements in the component
      document.querySelectorAll('.vscs-panel .state-unselected').forEach((el) => {
        el.classList.remove('state-unselected');
      });
      
      // ALSO clean up A/G specific classes that might be persisting
      document.querySelectorAll('.vscs-panel .ag-idle, .vscs-panel .ag-active, .vscs-panel .ag-busy, .vscs-panel .ag-monitoring').forEach((el) => {
        el.classList.remove('ag-idle', 'ag-active', 'ag-busy', 'ag-monitoring');
      });
      
      // Also remove from A/G specific buttons
      document.querySelectorAll('.ag-button, .vscs-button.unassigned').forEach((el) => {
        el.classList.remove('state-unselected', 'state-active', 'state-busy', 'state-ringing', 'state-unavailable');
        el.classList.remove('ag-idle', 'ag-active', 'ag-busy', 'ag-monitoring');
      });
    }
  }, [screenMode]);

  // Update buttons when btns changes
  useEffect(() => {
    setButtons(btns);
  }, [btns]);

  // Handle dynamic button states from WebSocket data - ONLY for G/G screens
  useEffect(() => {
    // IMMEDIATE cleanup for G/G screens to prevent initial flash
    if (screenMode.startsWith('GG')) {
      // First, aggressively clean any state-unselected classes
      document.querySelectorAll('.vscs-panel .state-unselected').forEach((el) => {
        el.classList.remove('state-unselected');
      });
    }
    
    // Only apply dynamic states on G/G screens
    if (!screenMode.startsWith('GG')) {
      return;
    }
    
    // Clear all dynamic states first - but only for G/G grid buttons
    buttons.forEach((btn, index) => {
      const buttonEl = document.querySelector(`.vscs-panel .grid .gg-button:nth-child(${index + 1})`);
      if (buttonEl) {
        buttonEl.classList.remove('state-unselected', 'state-active', 'state-busy', 'state-ringing', 'state-unavailable');
      }
    });

    currentSlice.forEach((data: any, index: number) => {
      const buttonEl = document.querySelector(`.vscs-panel .grid .gg-button:nth-child(${index + 1})`);
      
      if (!data) {
        // Button is unavailable - add unavailable class
        buttonEl?.classList.add('state-unavailable');
        return;
      }

      const target = data.call?.substring(5) || data.target;
      
      // Only target the specific grid button, not all buttons with the target class
      if (buttonEl) {
        // DEFENSIVE CHECK: Only proceed if this is actually a G/G button
        if (!buttonEl.classList.contains('gg-button')) {
          console.warn('Found non-GG button with GG selector:', buttonEl, 'index:', index);
          return;
        }
        
        // Remove existing state classes
        buttonEl.classList.remove('state-unselected', 'state-active', 'state-busy', 'state-ringing', 'state-unavailable');
        
        // Add state based on WebSocket data
        switch (data.status) {
          case 'idle':
          case '':
          case 'off':
            // For idle buttons with data, use default .vscs-button styling (white background, black text)
            break;
            
          case 'ok':
          case 'active':
            // Connected call - green background, black text
            buttonEl.classList.add('state-active');
            break;
            
          case 'busy':
            // Busy line - black background, green text, flashing
            buttonEl.classList.add('state-busy');
            break;
            
          case 'chime':
          case 'ringing':
          case 'online':
            // Incoming call - amber background, black text, flashing
            buttonEl.classList.add('state-ringing');
            break;
            
          case 'hold':
            // Call on hold - yellow background, black text, winking
            buttonEl.classList.add('state-hold');
            break;
            
          case 'pending':
          case 'terminate':
          case 'overridden':
            // No action states - use unavailable styling
            buttonEl.classList.add('state-unavailable');
            break;
            
          default:
            // For unknown status with data, use default .vscs-button styling
            break;
        }
      }
    });
  }, [currentSlice, gg_status, buttons, screenMode]);  useEffect(() => {
    console.log('out1', props.outgoingLandlines);
    console.log('in1', props.incomingLandlines);
    console.log('act1', props.activeLandlines);
    // Outgoing
    props.outgoingLandlines.forEach((line) => {
      document
        .querySelectorAll(`.${line.target}.${line.type}`)
        .forEach((el) => {
          el.classList.toggle('vscs-active-call', false);
          el.classList.toggle('vscs-incoming-bg', true);
        });
    });
    let outgoingSlow = setInterval(() => {
      props.outgoingLandlines.forEach((line) => {
        document
          .querySelectorAll(`.${line.target} .${line.type}`)
          .forEach((el) => {
            el.classList.toggle('vscs-active-call');
          });
      });
    }, 750);

    // Incoming
    props.incomingLandlines.forEach((line) => {
      document
        .querySelectorAll(`.${line.target}.${line.type}`)
        .forEach((el) => {
          el.classList.toggle('vscs-active-call', false);
          el.classList.toggle('vscs-incoming-bg', true);
        });
      document.querySelectorAll(`.${line.from}.${line.type}`).forEach((el) => {
        el.classList.toggle('vscs-active-call', false);
        el.classList.toggle('vscs-incoming-bg', true);
      });
    });
    let incomingSlow = setInterval(() => {
      props.incomingLandlines.forEach((line) => {
        document
          .querySelectorAll(`.${line.target}.${line.type}`)
          .forEach((el) => {
            el.classList.toggle('vscs-active-call');
          });
        document
          .querySelectorAll(`.${line.from}.${line.type}`)
          .forEach((el) => {
            el.classList.toggle('vscs-active-call');
          });
      });
    }, 750);

    // Active
    props.activeLandlines.forEach((line) => {
      if (props.heldLandlines.includes(line.id)) {
        document
          .querySelectorAll(`.${line.target}.${line.type}`)
          .forEach((el) => {
            el.classList.toggle('vscs-held', false);
          });

        document
          .querySelectorAll(`.${line.from}.${line.type}`)
          .forEach((el) => {
            el.classList.toggle('vscs-held', false);
          });
      } else {
        const from =
          line.type === CALL_TYPE.SHOUT
            ? (line.from ?? '').split('-')[0]
            : line.from;
        document
          .querySelectorAll(`.${line.target}.${line.type}`)
          .forEach((el) => {
            el.classList.toggle('vscs-active-call', false);
            el.classList.toggle('vscs-active-bg', true);
          });

        document.querySelectorAll(`.${from}.${line.type}`).forEach((el) => {
          el.classList.toggle('vscs-active-call', false);
          el.classList.toggle('vscs-active-bg', true);
        });
      }
    });

    let activeFast = setInterval(() => {
      props.activeLandlines.forEach((line) => {
        if (props.heldLandlines.includes(line.id)) {
          document
            .querySelectorAll(`.${line.target}.${line.type}`)
            .forEach((el) => {
              el.classList.toggle('vscs-held', true);
            });
          document
            .querySelectorAll(`.${line.from}.${line.type}`)
            .forEach((el) => {
              el.classList.toggle('vscs-held', true);
            });
        } else {
          const from =
            line.type === CALL_TYPE.SHOUT
              ? (line.from ?? '').split('-')[0]
              : line.from;
          document
            .querySelectorAll(`.${line.target}.${line.type}`)
            .forEach((el) => {
              el.classList.toggle('vscs-active-call');
            });
          document.querySelectorAll(`.${from}.${line.type}`).forEach((el) => {
            el.classList.toggle('vscs-active-call');
          });
        }
      });
    }, 250);

    return () => {
      console.log('unloading lines arrays');
      clearInterval(outgoingSlow);
      clearInterval(incomingSlow);
      clearInterval(activeFast);
      // Only clear states from G/G grid buttons, not static buttons or A/G buttons
      buttons.forEach((btn, index) => {
        const buttonEl = document.querySelector(`.gg-button:nth-child(${index + 1})`);
        if (buttonEl) {
          buttonEl.classList.toggle('vscs-active-call', false);
          buttonEl.classList.toggle('vscs-active-bg', false);
          buttonEl.classList.toggle('vscs-incoming-bg', false);
          buttonEl.classList.toggle('vscs-held', false);
        }
      });
    };
  }, [
    props.activeLandlines,
    props.incomingLandlines,
    props.outgoingLandlines,
    props.heldLandlines,
  ]);

  return (
    <>
      <div className="bg-zinc-800 p-0.5 vscs-panel tracking-tight leading-none select-none">
        <div className={`grid grid-cols-9 gap-y-3 mt-2 ${screenMode.startsWith('GG') ? 'mt-7' : ''}`}>
          {/* Always show the current screen content - no screen selection in main grid */}
          {screenMode === 'AG1' ? (
            // A/G 1 screen
            <VscsAG page={1} sendMsg={sendMsg} />
          ) : screenMode === 'AG2' ? (
            // A/G 2 screen  
            <VscsAG page={2} sendMsg={sendMsg} />
          ) : screenMode === 'AG_STATUS' ? (
            // A/G Status screen - placeholder for now
            Array.from({ length: 27 }, (_, i) => (
              <div key={i} className="vscs-empty h-20 bg-stone-500 flex items-center justify-center text-white">
                {i === 13 ? 'A/G STATUS' : ''}
              </div>
            ))
          ) : screenMode === 'UTIL' ? (
            // Utility screen - create a container that spans the grid for overlay buttons
            <>
              {/* UTIL content in the regular grid cell */}
              <div className="col-span-9 relative">
                <VscsUtil sendMsg={sendMsg} />
                
                {/* Overlay the UTIL function buttons on top of the content */}
                <div className="absolute flex flex-wrap gap-3 justify-start" style={{ bottom: '-100px', left: '5px', zIndex: 25 }}>
                  {screenMode === 'UTIL' ? (
                    isAltScreen ? (
                      // Screen selection mode - show SCRN ALT + magenta screen options in overlay position
                      <>
                        <VscsStaticButton 
                          onClick={() => scrnAltBtn()}
                          className={isAltScreen ? 'scrn-alt-active' : ''}
                        >
                          SCRN<br />ALT
                        </VscsStaticButton>
                        <VscsStaticButton 
                          className="screen-select"
                          onClick={() => selectScreen('AG1')}
                        >
                          A/G 1
                        </VscsStaticButton>
                        <VscsStaticButton 
                          className="screen-select"
                          onClick={() => selectScreen('AG2')}
                        >
                          A/G 2
                        </VscsStaticButton>
                        <VscsStaticButton 
                          className="screen-select"
                          onClick={() => selectScreen('AG_STATUS')}
                        >
                          A/G STATUS
                        </VscsStaticButton>
                        <VscsStaticButton 
                          className="screen-select"
                          onClick={() => selectScreen('GG1')}
                        >
                          G/G 1
                        </VscsStaticButton>
                        <VscsStaticButton 
                          className="screen-select"
                          onClick={() => selectScreen('GG2')}
                        >
                          G/G 2
                        </VscsStaticButton>
                        <VscsStaticButton 
                          className="screen-select"
                          onClick={() => selectScreen('UTIL')}
                        >
                          UTIL
                        </VscsStaticButton>
                        {/* R/T button positioned in overlay for UTIL mode - screen selection */}
                        <div className="col-span-2 relative">
                          {/* R/T Indicator positioned above the static button */}
                          <div className="absolute text-black bg-zinc-50 text-center w-[165px] h-5" style={{ bottom: '280px', left: '345px', zIndex: 25 }}>
                            <div className="text-center text-lg leading-tight">
                              {rtEnabled ? 'R/T ON' : 'R/T OFF'}
                            </div>
                          </div>
                          <div 
                            className="relative vscs-static-button w-[165px] h-20 cursor-pointer mt-2 flex flex-col justify-start items-start p-2 text-left"
                            style={{ 
                              bottom: '200px', 
                              left: '345px', 
                              zIndex: 25,
                              backgroundColor: overridingPositions.length > 0 ? '#008000' : '#87CEEB',
                              color: 'black'
                            }}
                            onClick={() => setRtEnabled(!rtEnabled)}
                          >
                            {/* Call Forwarding Display */}
                            {callForwardInfo && (
                              <div className="text-sm leading-tight">
                                {callForwardInfo.type === 'DA' ? (
                                  <>
                                    <div>CALLS FWD TO:</div>
                                    <div>{callForwardInfo.positionLetter} {callForwardInfo.sectorNumber}</div>
                                  </>
                                ) : (
                                  <>
                                    <div>CALLS FWD TO:</div>
                                    <div>{callForwardInfo.dialCode}</div>
                                  </>
                                )}
                              </div>
                            )}
                            {/* Overriding Positions Display (always shown when being overridden) */}
                            {overridingPositions.length > 0 && (
                              <div className="text-sm w-full leading-tight">
                                {overridingPositions.map((pos, idx) => (
                                  <div key={idx} className="flex justify-between w-full">
                                    <span>{pos.position}</span>
                                    <span>{pos.dialCode}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* VDM Message Display Area in UTIL mode - screen selection view */}
                        <div 
                          className="absolute -top-[105px] left-[0px] w-[335px] h-[80px] mt-2 flex items-center px-3"
                          style={{ backgroundColor: vdmMessage ? '#FFB6C1' : '#78716c' }}
                        >
                          {vdmMessage && (
                            <>
                              {vdmMessage.type === 'error' && (
                                <svg width="40" height="40" viewBox="0 0 40 40" style={{ marginRight: '8px' }}>
                                  <polygon points="20,5 38,35 2,35" fill="none" stroke="black" strokeWidth="2" />
                                  <text x="20" y="30" textAnchor="middle" fontSize="20" fontWeight="bold">!</text>
                                </svg>
                              )}
                              <div style={{ flex: 1, textAlign: 'left' }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'black' }}>{vdmMessage.text}</div>
                                {vdmMessage.line2 && <div style={{ fontSize: '13px', color: 'black' }}>{vdmMessage.line2}</div>}
                              </div>
                            </>
                          )}
                        </div>
                              </>
                    ) : (
                      // Normal UTIL function buttons
                      <>
                        <VscsStaticButton 
                          onClick={() => scrnAltBtn()}
                          className={isAltScreen ? 'scrn-alt-active' : ''}
                        >
                          SCRN<br />ALT
                        </VscsStaticButton>
                        <VscsStaticButton onClick={() => funcAltBtn()}>
                          FUNC<br />ALT
                        </VscsStaticButton>
                        <VscsStaticButton onClick={() => {/* TODO: Implement SCRN RTRN */}}>
                          &lt;SCRN&gt;<br />RTRN
                        </VscsStaticButton>
                        <VscsStaticButton onClick={() => {/* TODO: Implement SPLIT MODE */}}>
                          SPLIT<br />MODE
                        </VscsStaticButton>
                        <VscsStaticButton onClick={() => {/* TODO: Implement KEY CLICK */}}>
                          KEY<br />CLICK
                        </VscsStaticButton>
                        <VscsStaticButton onClick={() => {/* TODO: Implement DE-GAUSS */}}>
                          DE-<br />GAUSS
                        </VscsStaticButton>
                        <VscsStaticButton onClick={() => {/* TODO: Implement S/W MAINT */}}>
                          S/W<br />MAINT
                        </VscsStaticButton>
                        {/* R/T button positioned in overlay for UTIL mode - normal */}
                        <div className="col-span-2 relative">
                          {/* R/T Indicator positioned above the static button */}
                          <div className="absolute text-black bg-zinc-50 text-center w-[165px] h-5" style={{ bottom: '280px', left: '345px', zIndex: 25 }}>
                            <div className="text-center text-lg leading-tight">
                              {rtEnabled ? 'R/T ON' : 'R/T OFF'}
                            </div>
                          </div>
                          <div 
                            className="relative vscs-static-button w-[165px] h-20 cursor-pointer mt-2 flex flex-col justify-start items-start p-2 text-left"
                            style={{ 
                              bottom: '200px', 
                              left: '345px', 
                              zIndex: 25,
                              backgroundColor: overridingPositions.length > 0 ? '#008000' : '#87CEEB',
                              color: 'black'
                            }}
                            onClick={() => setRtEnabled(!rtEnabled)}
                          >
                            {/* Call Forwarding Display */}
                            {callForwardInfo && (
                              <div className="text-sm leading-tight">
                                {callForwardInfo.type === 'DA' ? (
                                  <>
                                    <div>CALLS FWD TO:</div>
                                    <div>{callForwardInfo.positionLetter} {callForwardInfo.sectorNumber}</div>
                                  </>
                                ) : (
                                  <>
                                    <div>CALLS FWD TO:</div>
                                    <div>{callForwardInfo.dialCode}</div>
                                  </>
                                )}
                              </div>
                            )}
                            {/* Overriding Positions Display (always shown when being overridden) */}
                            {overridingPositions.length > 0 && (
                              <div className="text-sm w-full leading-tight">
                                {overridingPositions.map((pos, idx) => (
                                  <div key={idx} className="flex justify-between w-full">
                                    <span>{pos.position}</span>
                                    <span>{pos.dialCode}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* VDM Message Display Area in UTIL mode - normal view */}
                        <div 
                          className="absolute -top-[105px] left-[0px] w-[335px] h-[80px] mt-2 flex items-center px-3"
                          style={{ backgroundColor: vdmMessage ? '#FFB6C1' : '#78716c' }}
                        >
                          {vdmMessage && (
                            <>
                              {vdmMessage.type === 'error' && (
                                <svg width="40" height="40" viewBox="0 0 40 40" style={{ marginRight: '8px' }}>
                                  <polygon points="20,5 38,35 2,35" fill="none" stroke="black" strokeWidth="2" />
                                  <text x="20" y="30" textAnchor="middle" fontSize="20" fontWeight="bold">!</text>
                                </svg>
                              )}
                              <div style={{ flex: 1, textAlign: 'left' }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'black' }}>{vdmMessage.text}</div>
                                {vdmMessage.line2 && <div style={{ fontSize: '13px', color: 'black' }}>{vdmMessage.line2}</div>}
                              </div>
                            </>
                          )}
                        </div>
                              </>
                    )
                  ) : null}
                </div>
              </div>
            </>
          ) : screenMode === 'GG2' ? (
            // G/G 2 screen (page 2)
            buttons.map((btn, i) => (
              <VscsButtonComponent
                key={i}
                config={{ ...btn, type: typeof btn.type === 'string' && Object.values(ButtonType).includes(btn.type as ButtonType) ? btn.type as ButtonType : ButtonType.NONE }}
                typeString={
                  btn.type === ButtonType.OVERRIDE
                    ? 'OVR'
                    : btn.type === ButtonType.RING
                      ? 'RING'
                      : btn.type === ButtonType.SHOUT
                        ? btn.dialCode ?? ''
                        : btn.type === ButtonType.NONE
                          ? ''
                          : ''
                }
                callback={btn.type !== ButtonType.NONE && (btn.shortName || btn.target) ? testFunc : undefined}
                className={`${btn.target} ${btn.type} vscs-button gg-button ${
                  btn.type !== ButtonType.NONE && (btn.shortName || btn.target)
                    ? 'cursor-pointer'
                    : 'cursor-not-allowed'
                }`}
                multiLineData={generateGGMultiLineData(currentSlice[i], i + ITEMS_PER_PAGE)}
              />
            ))
          ) : (
            // Default G/G 1 screen (page 1)
            buttons.map((btn, i) => (
              <VscsButtonComponent
                key={i}
                config={{ ...btn, type: typeof btn.type === 'string' && Object.values(ButtonType).includes(btn.type as ButtonType) ? btn.type as ButtonType : ButtonType.NONE }}
                typeString={
                  btn.type === ButtonType.OVERRIDE
                    ? 'OVR'
                    : btn.type === ButtonType.RING
                      ? 'RING'
                      : btn.type === ButtonType.SHOUT
                        ? btn.dialCode ?? ''
                        : btn.type === ButtonType.NONE
                          ? ''
                          : ''
                }
                callback={btn.type !== ButtonType.NONE && (btn.shortName || btn.target) ? testFunc : undefined}
                className={`${btn.target} ${btn.type} vscs-button gg-button ${
                  btn.type !== ButtonType.NONE && (btn.shortName || btn.target)
                    ? 'cursor-pointer'
                    : 'cursor-not-allowed'
                }`}
                multiLineData={generateGGMultiLineData(currentSlice[i], i)}
              />
            ))
          )}
          
          {/* Static buttons row - only show the 4 small buttons on G/G screens */}
          {!screenMode.startsWith('AG') && screenMode !== 'UTIL' && (
            <div className="vscs-empty col-start-1 col-end-7">
              <div className="flex gap-x-3 px-5">
                <div className="bg-stone-500 w-1/4 h-20"></div>
                <div className="bg-stone-500 w-1/4 h-20"></div>
                <div className="bg-stone-500 w-1/4 h-20"></div>
                <div className="bg-stone-500 w-1/4 h-20"></div>
              </div>
            </div>
          )}
          {/* CALL ANS button - only show on G/G screens */}
          {!screenMode.startsWith('AG') && screenMode !== 'UTIL' && (
                <VscsStaticButton onClick={() => callAnsBtn()}>
                  <span className="vscs-button-label">CALL ANS</span>
                </VscsStaticButton>
          )}
          
          {/* Large square button to the right of HOLD/CALL ANS - spans 2 rows - only show on G/G screens */}
          {!screenMode.startsWith('AG') && screenMode !== 'UTIL' && (
            <div className="bg-stone-500 vscs-empty row-span-2 w-40 mt-2 vscs-large-square-button"></div>
          )}
          {/* VDM Message Display Area - shows error/status/warning messages in pink */}
          {screenMode !== 'UTIL' && (
            <VdmMessageDisplay message={vdmMessage} />
          )}
          {/* R/T button section - hide in UTIL mode since it's in overlay, show on other pages */}
          {screenMode !== 'UTIL' && (
            <div className="col-span-2 relative">
              {/* R/T Indicator positioned above the static button using absolute positioning */}
              <div className="absolute -top-3 left-0 right-0 text-black bg-zinc-50 text-center w-[165px] h-5">
                <div className="text-center text-lg leading-tight">
                  {rtEnabled ? 'R/T ON' : 'R/T OFF'}
                </div>
              </div>
              {/* R/T Auxiliary Message Area Button - changes color and shows content based on state */}
              <div 
                className="vscs-static-button w-[165px] h-20 cursor-pointer mt-2 flex flex-col justify-start items-start p-2 text-left"
                style={{ 
                  backgroundColor: overridingPositions.length > 0 ? '#008000' : '#40e0d0',
                  color: 'black'
                }}
                onClick={() => setRtEnabled(!rtEnabled)}
              >
                {/* Call Forwarding Display (when active) */}
                {callForwardInfo && (
                  <div className="text-sm leading-tight">
                    {callForwardInfo.type === 'DA' ? (
                      <>
                        <div>CALLS FWD TO:</div>
                        <div>{callForwardInfo.positionLetter} {callForwardInfo.sectorNumber}</div>
                      </>
                    ) : (
                      <>
                        <div>CALLS FWD TO:</div>
                        <div>{callForwardInfo.dialCode}</div>
                      </>
                    )}
                  </div>
                )}
                
                {/* Overriding Positions Display (always shown when being overridden) */}
                {overridingPositions.length > 0 && (
                  <div className="text-sm w-full leading-tight">
                    {overridingPositions.map((pos, idx) => (
                      <div key={idx} className="flex justify-between w-full">
                        <span>{pos.position}</span>
                        <span>{pos.dialCode}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Emergency PTT buttons - positioned to the right of R/T button on A/G screens only */}
          {screenMode.startsWith('AG') && screenMode !== 'UTIL' && (
            <div className="col-span-3 flex gap-3 justify-start items-center" style={{ height: '80px', marginTop: '8px' }}>
              <button 
                className={`vscs-button border-cutoff ${hasGuardFrequencies ? 'state-emergency-ptt' : 'state-emergency-ptt state-unavailable'} ${emergencyPttPressed.uhf ? 'state-touched' : ''}`}
                onMouseDown={() => {
                  if (hasGuardFrequencies) {
                    setEmergencyPttPressed(prev => ({ ...prev, uhf: true }));
                    console.log('UHF Emergency PTT pressed - start transmission');
                    sendMsg({ call: "UHF_EMERGENCY", da: false, freq: 243000000, h: true, r: true, status: "", t: true, talking: true });
                  }
                }}
                onMouseUp={() => {
                  if (hasGuardFrequencies) {
                    setEmergencyPttPressed(prev => ({ ...prev, uhf: false }));
                    console.log('UHF Emergency PTT released - stop transmission');
                    sendMsg({ call: "UHF_EMERGENCY", da: false, freq: 243000000, h: true, r: true, status: "", t: false, talking: false });
                  }
                }}
                onMouseLeave={() => {
                  if (hasGuardFrequencies) {
                    setEmergencyPttPressed(prev => ({ ...prev, uhf: false }));
                    console.log('UHF Emergency PTT mouse leave - stop transmission');
                    sendMsg({ call: "UHF_EMERGENCY", da: false, freq: 243000000, h: true, r: true, status: "", t: false, talking: false });
                  }
                }}
                disabled={!hasGuardFrequencies}
                style={{ width: '80px', height: '60px', fontSize: '10px' }}
              >
                <div>
                  <div>PTT</div>
                  <div>UHF</div>
                </div>
              </button>
              <button 
                className={`vscs-button border-cutoff ${hasGuardFrequencies ? 'state-emergency-ptt' : 'state-emergency-ptt state-unavailable'} ${emergencyPttPressed.both ? 'state-touched' : ''}`}
                onMouseDown={() => {
                  if (hasGuardFrequencies) {
                    setEmergencyPttPressed(prev => ({ ...prev, both: true }));
                    console.log('BOTH Emergency PTT pressed - start transmission');
                    sendMsg({ call: "BOTH_EMERGENCY", da: false, freq: 121500000, h: true, r: true, status: "", t: true, talking: true });
                  }
                }}
                onMouseUp={() => {
                  if (hasGuardFrequencies) {
                    setEmergencyPttPressed(prev => ({ ...prev, both: false }));
                    console.log('BOTH Emergency PTT released - stop transmission');
                    sendMsg({ call: "BOTH_EMERGENCY", da: false, freq: 121500000, h: true, r: true, status: "", t: false, talking: false });
                  }
                }}
                onMouseLeave={() => {
                  if (hasGuardFrequencies) {
                    setEmergencyPttPressed(prev => ({ ...prev, both: false }));
                    console.log('BOTH Emergency PTT mouse leave - stop transmission');
                    sendMsg({ call: "BOTH_EMERGENCY", da: false, freq: 121500000, h: true, r: true, status: "", t: false, talking: false });
                  }
                }}
                disabled={!hasGuardFrequencies}
                style={{ width: '80px', height: '60px', fontSize: '10px' }}
              >
                <div>
                  <div>PTT</div>
                  <div>BOTH</div>
                </div>
              </button>
              <button 
                className={`vscs-button border-cutoff ${hasGuardFrequencies ? 'state-emergency-ptt' : 'state-emergency-ptt state-unavailable'} ${emergencyPttPressed.vhf ? 'state-touched' : ''}`}
                onMouseDown={() => {
                  if (hasGuardFrequencies) {
                    setEmergencyPttPressed(prev => ({ ...prev, vhf: true }));
                    console.log('VHF Emergency PTT pressed - start transmission');
                    sendMsg({ call: "VHF_EMERGENCY", da: false, freq: 121500000, h: true, r: true, status: "", t: true, talking: true });
                  }
                }}
                onMouseUp={() => {
                  if (hasGuardFrequencies) {
                    setEmergencyPttPressed(prev => ({ ...prev, vhf: false }));
                    console.log('VHF Emergency PTT released - stop transmission');
                    sendMsg({ call: "VHF_EMERGENCY", da: false, freq: 121500000, h: true, r: true, status: "", t: false, talking: false });
                  }
                }}
                onMouseLeave={() => {
                  if (hasGuardFrequencies) {
                    setEmergencyPttPressed(prev => ({ ...prev, vhf: false }));
                    console.log('VHF Emergency PTT mouse leave - stop transmission');
                    sendMsg({ call: "VHF_EMERGENCY", da: false, freq: 121500000, h: true, r: true, status: "", t: false, talking: false });
                  }
                }}
                disabled={!hasGuardFrequencies}
                style={{ width: '80px', height: '60px', fontSize: '10px' }}
              >
                <div>
                  <div>PTT</div>
                  <div>VHF</div>
                </div>
              </button>
            </div>
          )}

          {/* HOLD button - only show on G/G screens */}
          {!screenMode.startsWith('AG') && screenMode !== 'UTIL' && (
            <div className="mt-2">
              <VscsStaticButton onClick={() => props.holdBtn()}>
                HOLD
              </VscsStaticButton>
            </div>
          )}

          <div className="grid col-span-9 grid-cols-subgrid text-center -mt-3">
            <div className={`text-black bg-zinc-50 text-center px-0.0 py-0.0 ml-0.0 mr-[13px] h-4 ${screenMode === 'UTIL' ? 'transform  -translate-y-[97px] translate-x-1.5' : ''}`}>
              <div className="text-center text-lg leading-tight">
                {screenMode === 'AG1' ? 'A/G 1' :
                 screenMode === 'AG2' ? 'A/G 2' : 
                 screenMode === 'AG_STATUS' ? 'A/G STATUS' :
                 screenMode === 'UTIL' ? 'UTIL' :
                 screenMode === 'GG2' ? 'G/G 2' :
                 'G/G 1'}
              </div>
            </div>
            <div className={`text-black bg-zinc-50 text-center px-0.0 py-0.0 ml-0.0 mr-[13px] h-4 ${screenMode === 'UTIL' ? 'transform -translate-y-[97px] translate-x-1.5' : ''}`}>
              <div className="text-center text-lg leading-tight">{func}</div>
            </div>
            <div className="col-span-7 h-4"></div>

            {/* SCRN ALT button - hide in UTIL mode since it's overlaid */}
            {screenMode !== 'UTIL' ? (
              <VscsStaticButton 
                onClick={() => scrnAltBtn()}
                className={isAltScreen ? 'scrn-alt-active' : ''}
              >
                SCRN ALT
              </VscsStaticButton>
            ) : (
              <div></div>
            )}
            
            {/* Conditional bottom row based on screen selection mode */}
            {isAltScreen && screenMode !== 'UTIL' ? (
              // Screen selection mode - replace normal buttons with screen options (violet background)
              // Skip for UTIL mode since screen selection is in overlay position
              <>
                <VscsStaticButton 
                  className="screen-select"
                  onClick={() => selectScreen('AG1')}
                >
                  A/G 1
                </VscsStaticButton>
                <VscsStaticButton 
                  className="screen-select"
                  onClick={() => selectScreen('AG2')}
                >
                  A/G 2
                </VscsStaticButton>
                <VscsStaticButton 
                  className="screen-select"
                  onClick={() => selectScreen('AG_STATUS')}
                >
                  A/G STATUS
                </VscsStaticButton>
                <VscsStaticButton 
                  className="screen-select"
                  onClick={() => selectScreen('GG1')}
                >
                  G/G 1
                </VscsStaticButton>
                <VscsStaticButton 
                  className="screen-select"
                  onClick={() => selectScreen('GG2')}
                >
                  G/G 2
                </VscsStaticButton>
                <VscsStaticButton 
                  className="screen-select"
                  onClick={() => selectScreen('UTIL')}
                >
                  UTIL
                </VscsStaticButton>
              </>
            ) : (
              // Normal button row - different buttons for A/G vs G/G vs UTIL screens
              <>
                {screenMode.startsWith('AG') ? (
                  // A/G page function buttons
                  <>
                    <VscsStaticButton onClick={() => funcAltBtn()}>
                      <span className="vscs-button-label">FUNC ALT</span>
                    </VscsStaticButton>
                    <VscsStaticButton 
                      onClick={() => (screenMode === 'AG1' || screenMode === 'AG2') ? swapPages() : undefined}
                      disabled={!(screenMode === 'AG1' || screenMode === 'AG2')}
                    >
                      A/G ALT
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => {/* TODO: Implement AUTO VOICE ROUTE */}}>
                      AUTO VOICE ROUTE
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => {/* TODO: Implement MAIN STBY */}}>
                      MAIN STBY
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => {/* TODO: Implement BUEC */}}>
                      BUEC
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => {/* TODO: Implement XCPL */}}>
                      XCPL
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => {/* TODO: Implement REM MUTE */}}>
                      REM MUTE
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => {/* TODO: Implement FTS MON */}}>
                      FTS MON
                    </VscsStaticButton>
                  </>
                ) : screenMode === 'UTIL' ? (
                  // UTIL page function buttons are in overlay, so keep function row empty
                  <></>
                ) : (
                  // G/G page function buttons (original)
                  <>
                    <VscsStaticButton onClick={() => funcAltBtn()}>
                      FUNC ALT
                    </VscsStaticButton>
                    <VscsStaticButton 
                      onClick={() => (screenMode === 'GG1' || screenMode === 'GG2') ? swapPages() : undefined}
                      disabled={!(screenMode === 'GG1' || screenMode === 'GG2')}
                    >
                      <span className="vscs-button-label">G/G ALT</span>
                    </VscsStaticButton>
                    <VscsStaticButton disabled={true}>
                      <span className="vscs-button-label">PSN REL</span>
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => props.toggleGg()}>
                      <div>
                        <div className="flex items-center justify-center vscs-button-label">G/G</div>
                        <div className="h-6">
                          {props.ggLoud ? (
                            <SpeakerSvgComponent />
                          ) : (
                            <img src="/VSCSHeadsetIcon.bmp" alt="Headset" style={{ width: '40px', height: '30px' }} />
                          )}
                        </div>
                      </div>
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => props.toggleOver()}>
                      <div>
                        <div className="flex items-center justify-center vscs-button-label">OVR</div>
                        <div className="h-6">
                          {props.overrideLoud ? (
                            <SpeakerSvgComponent />
                          ) : (
                            <img src="/VSCSHeadsetIcon.bmp" alt="Headset" style={{ width: '40px', height: '30px' }} />
                          )}
                        </div>
                      </div>
                    </VscsStaticButton>
                    <VscsStaticButton disabled={true}>
                      <span className="vscs-button-label">{func === 'PRI' ? 'CALL FWD' : 'HOLLER ON/OFF'}</span>
                    </VscsStaticButton>
                    <VscsStaticButton 
                      className="col-start-8 col-end-10"
                      width="165px"
                      onClick={() => props.releaseBtn()}
                    >
                      <span className="vscs-button-label">RLS</span>
                    </VscsStaticButton>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Main Dual Screen VSCS Component
export default function VscsComponent(props: VscsProps) {
  // Load zoa_position.json from public and set in Zustand store if not already loaded
  const setPositionData = useCoreStore((s: any) => s.setPositionData);
  const positionData = useCoreStore((s: any) => s.positionData);
  useEffect(() => {
    if (!positionData || !positionData.positions || positionData.positions.length === 0) {
      fetch('/zoa_position.json')
        .then(res => res.json())
        .then(data => {
          setPositionData(data);
        })
        .catch(err => {
          console.error('Failed to load zoa_position.json:', err);
        });
    }
  }, []);

  return (
    <div className="flex items-center justify-center gap-4 bg-black p-4">
      {/* Left VSCS Panel - defaults to A/G1 */}
      <VscsPanel {...props} panelId="left" defaultScreenMode="AG1" />
      {/* VIK Keypad in the middle */}
      <div className="flex-shrink-0">
        <VikKeypad />
      </div>
      {/* Right VSCS Panel - defaults to G/G1 */}
      <VscsPanel {...props} panelId="right" defaultScreenMode="GG1" />
    </div>
  );
}
