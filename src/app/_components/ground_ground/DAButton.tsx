// components/DAButton.tsx

import React, { useState } from 'react';
import '../vatlines/styles.css';

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
  tooltip?: string; // Hover tooltip text
};

const DAButton: React.FC<DAButtonProps> = ({ topLine, middleLine, bottomLine, onClick, showIndicator = false, style, latching, dialLine, controlledIndicator, indicatorClassName, tooltip }) => {
  const [isActive, setIsActive] = useState(false);
  const [isIndicatorVisible, setIndicatorVisible] = useState(showIndicator);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseDown = () => {
    setIsActive(true);
    setIndicatorVisible(!isIndicatorVisible); // Toggle indicator visibility
  };

  const handleMouseUp = () => {
    setIsActive(false);
    if (onClick) onClick();
    // if non-latching, hide indicator on release
    if (!latching) setIndicatorVisible(false);
  };

  const indicatorVisible = controlledIndicator ?? isIndicatorVisible;
  return (
    <div className="relative inline-block">
    <button
      className={`relative w-16 h-16 bg-customBlue text-customYellow 
    border-2 border-customGray flex items-center justify-center text-center
    ${isActive ? 'border-customBlue' : ' border-customWhite'}`}
      style={{
        borderBottomColor: isActive ? '#000080' : '#818181',
        borderRightColor: isActive ? '#000080' : '#818181',
        ...style
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setIsActive(false); setIsHovered(false); }}
      onMouseEnter={() => setIsHovered(true)}
    >
      {/* Centered and styled text */}
      {!middleLine && !bottomLine ? (
        // Single line - center vertically
        <span className="text-2xl rdvs-label break-words">
          {topLine}
        </span>
      ) : (
        <div className="flex flex-col items-center justify-center">
          <span className="text-2xl rdvs-label break-words leading-tight">
            {topLine}
          </span>
          {middleLine && (
            <span className="text-2xl rdvs-label break-words leading-tight">
              {middleLine}
            </span>
          )}
          {bottomLine && (
            <span className="text-2xl rdvs-label break-words leading-tight">
              {bottomLine}
            </span>
          )}
        </div>
      )}
      {indicatorClassName ? (
        <div className={indicatorClassName}>
          <div className="ct">
            <div className="inner"></div>
          </div>
        </div>
      ) : indicatorVisible && (
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-customGreen"></div>
      )}
    </button>
    {tooltip && isHovered && (
      <div
        style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '4px',
          backgroundColor: '#1a1a2e',
          color: '#e0e0e0',
          fontSize: '10px',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
          padding: '3px 6px',
          border: '1px solid #555',
          borderRadius: '2px',
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      >
        {tooltip}
      </div>
    )}
    </div>
  );
};

export default DAButton;
