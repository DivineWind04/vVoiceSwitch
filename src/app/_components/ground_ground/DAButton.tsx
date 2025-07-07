// components/DAButton.tsx

import React, { useState } from 'react';

type DAButtonProps = {
  topLine: string;
  middleLine?: string;
  bottomLine?: string;
  onClick?: () => void; // Optional onClick handler
  latching: boolean; // True for latching button, False for momentary button
  showIndicator?: boolean; // Optional prop to show indicator
  dialLine?: number; // Dial line number. Could be phone number, IA code, or Function Code
  style?: React.CSSProperties;
};

const DAButton: React.FC<DAButtonProps> = ({ topLine, middleLine, bottomLine, onClick, showIndicator = false, style, latching, dialLine }) => {
  const [isActive, setIsActive] = useState(false);
  const [isIndicatorVisible, setIndicatorVisible] = useState(showIndicator);

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

  return (
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
      onMouseLeave={() => setIsActive(false)} // Handle case where mouse leaves without release
    >
      {/* Centered and styled text */}
      {!middleLine && !bottomLine ? (
        // Single line - center vertically
        <span className="text-lg font-bold break-words">
          {topLine}
        </span>
      ) : (
        <div className="flex flex-col items-center justify-center">
          <span className="text-lg font-bold break-words leading-tight">
            {topLine}
          </span>
          {middleLine && (
            <span className="text-lg font-bold break-words leading-tight">
              {middleLine}
            </span>
          )}
          {bottomLine && (
            <span className="text-lg font-bold break-words leading-tight">
              {bottomLine}
            </span>
          )}
        </div>
      )}
      {isIndicatorVisible && (
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-customGreen"></div>
      )}
    </button>
  );
};

export default DAButton;
