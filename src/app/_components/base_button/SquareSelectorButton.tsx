// components/SquareSelectorButton.tsx

import React, { useState } from 'react';

type SquareSelectorButtonProps = {
  topLine: string;
  bottomLine?: string;
  onClick?: () => void; // Optional onClick handler
  style?: React.CSSProperties;
};

const SquareSelectorButton: React.FC<SquareSelectorButtonProps> = ({ topLine, bottomLine, onClick, style }) => {
  const [isActive, setIsActive] = useState(false);

  const handleMouseDown = () => {
    setIsActive(true);
  };

  const handleMouseUp = () => {
    setIsActive(false);
    if (onClick) onClick();
  };

  return (
    <button
      className={`relative w-16 h-16 bg-customBlue text-customYellow 
    border-4 border-customBlack flex items-start justify-center text-center
    ${isActive ? 'border-black' : 'border-customLightBlue'}`}
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
      <div className={`flex flex-col h-full justify-center ${bottomLine ? '' : 'items-center'}`}>
        <span className="text-[14px] font">
          {topLine}
        </span>
        {bottomLine && <span className="text-[14px] font-bold">{bottomLine}</span>}
      </div>

    </button>
  );
};

export default SquareSelectorButton;
