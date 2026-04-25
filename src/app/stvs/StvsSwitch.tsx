// components/StvsLever.tsx

import React, { useState, useRef } from 'react';

type StvsLeverProps = {
  defaultPosition?: number; // 0.0 (bottom) to 1.0 (top)
  onPositionChange?: (position: number) => void;
  style?: React.CSSProperties;
  brightness?: number; // Brightness from ILLUM knob
  isReceivingAudio?: boolean; // VOX audio present
  frequencyId?: string; // For tracking which frequency this lever controls
};

const StvsLever: React.FC<StvsLeverProps> = ({ 
  defaultPosition = 0.5, 
  onPositionChange, 
  style, 
  brightness = 1.0,
  isReceivingAudio = false,
  frequencyId = ''
}) => {
  const [position, setPosition] = useState<number>(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const leverRef = useRef<HTMLDivElement>(null);

  // Determine VOX mode based on lever position
  // Top position (1.0) = Loudspeaker (L), Bottom position (0.0) = Headset (H), Middle = Off
  const isLoudspeakerMode = position > 0.66;
  const isHeadsetMode = position < 0.33;
  
  // LED states based on VOX functionality
  const amberLedState = isLoudspeakerMode ? (isReceivingAudio ? 'flutter' : 'solid') : 'off';
  const greenLedState = isHeadsetMode ? (isReceivingAudio ? 'flutter' : 'solid') : 'off';

  // Function to play lever sound
  const playLeverSound = () => {
    try {
      const audio = new Audio('/stvsButton.wav');
      audio.volume = 0.2; // Quieter for lever movement
      audio.play().catch(error => {
        console.log('Could not play lever sound:', error);
      });
    } catch (error) {
      console.log('Audio not available:', error);
    }
  };

  const updatePosition = (clientY: number) => {
    if (!leverRef.current) return;
    
    const rect = leverRef.current.getBoundingClientRect();
    const trackHeight = rect.height - 12 - 16; // Total height minus top/bottom margins and knob size
    const trackTop = rect.top + 6 + 8; // Account for housing margin and knob radius
    
    const relativeY = clientY - trackTop;
    let rawPosition = 1 - (relativeY / trackHeight); // Invert so top = 1, bottom = 0
    rawPosition = Math.max(0, Math.min(1, rawPosition)); // Clamp between 0 and 1
    
    // Snap to 3 hard detent positions
    let newPosition: number;
    if (rawPosition < 0.33) {
      newPosition = 0.0; // Bottom detent (Headset)
    } else if (rawPosition < 0.67) {
      newPosition = 0.5; // Middle detent (Off)
    } else {
      newPosition = 1.0; // Top detent (Loudspeaker)
    }
    
    setPosition(newPosition);
    onPositionChange?.(newPosition);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    playLeverSound();
    updatePosition(e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      updatePosition(e.clientY);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div 
      className="absolute cursor-pointer select-none"
      style={{ 
        ...style 
      }}
    >
      {/* Square housing like in the reference image */}
      <div 
        ref={leverRef}
        className="relative bg-gray-800 border-2 border-gray-600"
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(145deg, #3a3a3a 0%, #1a1a1a 50%, #2a2a2a 100%)',
          boxShadow: 'inset 0 0 6px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.3)',
          borderRadius: '2px',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Vertical slot/track */}
        <div 
          className="absolute bg-black border border-gray-700"
          style={{
            left: '50%',
            top: '6px',
            width: '20px',
            height: 'calc(100% - 12px)',
            transform: 'translateX(-50%)',
            borderRadius: '4px',
            boxShadow: 'inset 0 0 3px rgba(0,0,0,0.9)',
          }}
        />

        {/* Circular knob like in reference */}
        <div
          className="absolute border-2 border-gray-500 transition-all duration-100 ease-out"
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
            top: `${6 + (1 - position) * (100 - 30)}%`, // 6px from top, percentage-based positioning
            width: '20px',
            height: '20px',
            borderRadius: '50%', // Make it perfectly circular
            background: 'radial-gradient(circle at 30% 30%, #f5f5f5 0%, #e0e0e0 40%, #c0c0c0 100%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.3)',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        />

        {/* VOX Indicator LEDs inside the housing on the right side, clear of the switch */}
        <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex flex-col justify-between h-3/4">
          {/* Amber LED - Loudspeaker (L) function */}
          <div
            className={`w-4 h-4 rounded-full border border-gray-600 transition-all duration-200 ${
              amberLedState === 'flutter' ? 'animate-pulse' : ''
            }`}
            style={{
              backgroundColor: amberLedState !== 'off' ? '#ffcc00ff' : '#2a2a2a',
              boxShadow: amberLedState !== 'off' 
                ? `0 0 6px rgba(255, 128, 0, ${brightness * 0.8}), inset 0 1px 2px rgba(255, 200, 100, 0.3)` 
                : 'inset 0 0 3px rgba(0,0,0,0.8)',
              opacity: brightness,
              animation: amberLedState === 'flutter' ? 'flutter 833ms infinite' : 'none',
            }}
          />
          
          {/* Green LED - Headset (H) function */}
          <div
            className={`w-4 h-4 rounded-full border border-gray-600 transition-all duration-200 ${
              greenLedState === 'flutter' ? 'animate-pulse' : ''
            }`}
            style={{
              backgroundColor: greenLedState !== 'off' ? '#00ff00' : '#2a2a2a',
              boxShadow: greenLedState !== 'off' 
                ? `0 0 6px rgba(0, 255, 0, ${brightness * 0.8}), inset 0 1px 2px rgba(100, 255, 100, 0.3)` 
                : 'inset 0 0 3px rgba(0,0,0,0.8)',
              opacity: brightness,
              animation: greenLedState === 'flutter' ? 'flutter 833ms infinite' : 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default StvsLever;