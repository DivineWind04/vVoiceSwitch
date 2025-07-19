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
    border-4 border-customBlack flex items-center justify-center text-center 
    ${isActive ? 'border-black' : 'border-customBlue'}`}
      style={{
        borderBottomColor: isActive ? '#1f67fa' : '#000000',
        borderRightColor: isActive ? '#1f67fa' : '#000000',
        backgroundImage: `
          linear-gradient(45deg, #1f67fa 25%, transparent 25%), 
          linear-gradient(-45deg, #1f67fa 25%, transparent 25%), 
          linear-gradient(45deg, transparent 75%, #1f67fa 75%), 
          linear-gradient(-45deg, transparent 75%, #1f67fa 75%)
        `,
        backgroundSize: '2px 2px',
        backgroundPosition: '0 0, 0 1px, 1px -1px, -1px 0px',
        backgroundColor: '#000000',
        ...style
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsActive(false)} // Handle case where mouse leaves without release
    >
      {/* Centered and styled text */}
      {!middleLine && !bottomLine ? (
        // Single line - center vertically
        <span className="text-[14px] font break-words">
          {topLine}
        </span>
      ) : (
        <div className="flex flex-col items-center justify-center">
          <span className="text-[14px] font break-words leading-tight">
            {topLine}
          </span>
          {middleLine && (
            <span className="text-[14px] font break-words leading-tight">
              {middleLine}
            </span>
          )}
          {bottomLine && (
            <span className="text-[14px] font break-words leading-tight">
              {bottomLine}
            </span>
          )}
        </div>
      )}
      {isIndicatorVisible && (
        <div className="absolute bottom-[1px] w-[46px] h-[13px] py-[2px] bg-customGreen px-[5px]"></div>
      )}
    </button>
  );
};

export default DAButton;
