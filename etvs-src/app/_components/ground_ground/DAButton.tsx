// components/DAButton.tsx

import React, { useState } from 'react';
import { useCoreStore } from '~/model';

type DAButtonProps = {
  topLine: string;
  middleLine?: string;
  bottomLine?: string;
  onClick?: () => void; // Optional onClick handler
  latching: boolean; // True for latching button, False for momentary button
  showIndicator?: boolean; // Optional prop to show indicator
  dialLine?: number; // Dial line number. Could be phone number, IA code, or Function Code
  style?: React.CSSProperties;
  controlledIndicator?: boolean;
  indicatorClassName?: string;
};

const DAButton: React.FC<DAButtonProps> = ({ topLine, middleLine, bottomLine, onClick, showIndicator = false, style, latching, dialLine, controlledIndicator, indicatorClassName }) => {
  const [isActive, setIsActive] = useState(false);
  const [isIndicatorVisible, setIndicatorVisible] = useState(showIndicator);

  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);

  const handleMouseDown = () => {
    setIsActive(true);
    setIndicatorVisible(!isIndicatorVisible); // Toggle indicator visibility
  };

  const handleMouseUp = () => {
    setIsActive(false);
    if (onClick) onClick();
    // if non-latching, hide indicator on release
    if (!latching) setIndicatorVisible(false);

    // Send backend message similar to src implementation when dialLine present
    try {
      if (dialLine !== undefined && dialLine !== null) {
        sendMsg({ type: 'add', cmd1: '' + dialLine, dbl1: 2 });
      }
    } catch (ex) {
      console.error('sendMsg failed', ex);
    }
  };

  const indicatorVisible = controlledIndicator ?? isIndicatorVisible;
  
  // Parse the indicatorClassName to determine the correct state
  const shouldFlutter = indicatorClassName?.includes('flutter active');
  const shouldFlutterRed = indicatorClassName?.includes('flutter red');
  const shouldFlashGreen = indicatorClassName?.includes('flutter receive flashing'); // Incoming calls
  const shouldSolidRed = indicatorClassName?.includes('steady red'); // Busy lines
  const isSteady = indicatorClassName?.includes('steady green'); // Connected steady
  
  return (
    <button
      className={`etvs-btn relative flex items-center justify-center text-center select-none ${isActive ? 'etvs-btn-active' : 'etvs-btn-inactive'}`}
      style={style}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsActive(false)}
    >
      {/* Label area, styled to match etvs-btn-label */}
      <div className="etvs-btn-label">
        <span>{topLine}</span>
        {middleLine && <span>{middleLine}</span>}
        {bottomLine && <span>{bottomLine}</span>}
      </div>
      
      {/* ETVS-style indicator bar with G/G state animations */}
      {(indicatorVisible || indicatorClassName) && (
        <div 
          className={`etvs-btn-indicator ${
            shouldFlutter ? 'etvs-flutter' : 
            shouldFlutterRed ? 'etvs-flutter-red' : 
            shouldFlashGreen ? 'etvs-flash-green' : 
            shouldSolidRed ? 'etvs-solid-red' : 
            isSteady ? 'etvs-steady' : ''
          }`}
        />
      )}
    </button>
  );
};

export default DAButton;
