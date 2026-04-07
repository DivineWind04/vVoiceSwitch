import React, { useState } from "react";

interface StvsButtonProps {
  label: string;
  active?: boolean;
  hasFreq?: boolean;
  pttActive?: boolean;
  callStatus?: string; // G/G call status: 'chime', 'ringing', 'ok', 'active', 'busy', etc.
  brightness?: number; // Brightness level from ILLUM knob (0.1 to 1.0)
  onClick?: () => void;
  style?: React.CSSProperties;
}

const StvsButton: React.FC<StvsButtonProps> = ({ label, active = false, hasFreq = false, pttActive = false, callStatus, brightness = 1.0, onClick, style }) => {
  const [pressed, setPressed] = useState(false);
  
  // Function to play button press sound
  const playButtonSound = () => {
    try {
      const audio = new Audio('/stvsButton.wav');
      audio.volume = 1.0; // Adjust volume as needed
      audio.play().catch(error => {
        console.log('Could not play button sound:', error);
      });
    } catch (error) {
      console.log('Audio not available:', error);
    }
  };
  
  // Handle button click with sound
  const handleClick = () => {
    playButtonSound(); // Play sound on button press
    onClick?.(); // Call the original onClick handler
  };
  
  // Determine diode state based on context
  let diodeClass = '';
  let diodeStyle = {};
  
  // Helper function to apply brightness to any diode style
  const applyBrightness = (baseStyle: any) => ({
    ...baseStyle,
    opacity: brightness,
    filter: baseStyle.filter ? `${baseStyle.filter} brightness(${brightness})` : `brightness(${brightness})`,
  });
  
  if (callStatus) {
    // G/G button states
    if (callStatus === 'chime' || callStatus === 'ringing') {
      // Incoming call - flash green (50% on/off, 60 times/min)
      diodeClass = 'stvs-flash-green';
    } else if ((callStatus === 'ok' && pttActive) || callStatus === 'active') {
      // Call accepted/active - flutter green (same as frequency buttons)
      diodeClass = 'stvs-flutter-green';
    } else if (callStatus === 'busy') {
      // Line busy - solid red
      diodeClass = 'stvs-solid-red';
    } else if (callStatus === 'ok') {
      // Connected but not active - steady green
      diodeClass = 'bg-green-500';
      diodeStyle = applyBrightness({
        boxShadow: '0 0 8px 2px #00ff00, 0 0 2px #00ff00',
        filter: 'brightness(1.2) drop-shadow(0 0 6px #00ff00)',
      });
    } else {
      // Default state for G/G buttons - amber
      diodeClass = 'bg-amber-500';
      diodeStyle = applyBrightness({
        boxShadow: '0 0 8px 2px #ffcc00ff, 0 0 2px #ffcc00ff',
        filter: 'brightness(1.2) drop-shadow(0 0 6px #ffcc00ff)',
      });
    }
  } else {
    // Frequency button states
    if (pttActive && hasFreq) {
      diodeClass = 'stvs-flutter-green';
    } else if (hasFreq) {
      diodeClass = 'bg-green-500';
      diodeStyle = applyBrightness({
        boxShadow: '0 0 8px 2px #00ff00, 0 0 2px #00ff00',
        filter: 'brightness(1.2) drop-shadow(0 0 6px #00ff00)',
      });
    } else {
      diodeClass = 'bg-amber-500';
      diodeStyle = applyBrightness({
        boxShadow: '0 0 8px 2px #ffcc00ff, 0 0 2px #ffcc00ff',
        filter: 'brightness(1.2) drop-shadow(0 0 6px #ffcc00ff)',
      });
    }
  }

  return (
    <button
      className="absolute flex flex-col items-center justify-center rounded-md border-2 border-gray-700 transition-all select-none bg-zinc-950"
      style={{
        boxShadow: pressed ? '0 1px 2px #111' : '0 2px 8px #111',
        transform: pressed ? 'scale(0.96) translateY(2px)' : 'none',
        fontFamily: 'ETVSButton, monospace',
        overflow: 'hidden',
        transition: 'box-shadow 0.1s, transform 0.1s',
        ...style,
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={handleClick}
    >
      {/* Horizontal line through the middle */}
      <div
        className="absolute left-0 w-full"
        style={{
          top: '50%',
          height: '2.5px',
          background: 'rgba(255,255,255,0.95)',
          boxShadow: 'none',
          transform: 'translateY(-50%)',
          zIndex: 5,
        }}
      />
      <span
        className="absolute top-2 left-1/2 -translate-x-1/2 z-10 font-normal text-white tracking-widest"
        style={{
          letterSpacing: 0,
          fontFamily: "'ETVSButton', monospace",
          textShadow: 'none',
          fontSize: 'clamp(0.45rem, 0.85vw, 0.8rem)',
          maxWidth: '95%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: 'center',
          lineHeight: 1.1,
        }}
        title={label}
      >
        {label}
      </span>
      {/* Gloss overlay (should be on top of line and text) */}
      <div
        className="absolute left-0 top-0 w-full h-1/2 rounded-t-md pointer-events-none"
        style={{
          background: 'linear-gradient(180deg,rgba(255,255,255,0.35) 0%,rgba(255,255,255,0.10) 60%,rgba(255, 255, 255, 0) 100%)',
          zIndex: 20,
        }}
      />
      {/* Diodes absolutely positioned near the line, not affecting text layout */}
      <div className="absolute left-1/2 -translate-x-1/2 z-10 flex gap-2" style={{ top: 'calc(50% + 8px)', opacity: brightness }}>
        <span 
          className={`w-2 h-2 rounded-full shadow ${diodeClass}`} 
          style={diodeStyle}
        />
        <span 
          className={`w-2 h-2 rounded-full shadow ${diodeClass}`} 
          style={diodeStyle}
        />
      </div>
    </button>
  );
};

export default StvsButton;
