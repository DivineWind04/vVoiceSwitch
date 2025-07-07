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
    border-2 border-customGray flex items-start justify-center
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
      <div className={`flex flex-col h-full justify-center ${bottomLine ? '' : 'items-center'}`}>
        <span className="text-xl font-bold">
          {topLine}
        </span>
        {bottomLine && <span className="text-xl font-bold">{bottomLine}</span>}
      </div>

    </button>
  );
};

export default SquareSelectorButton;
