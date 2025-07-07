// components/BrightnessButton.tsx

import React, { useState } from 'react';

type BrightnessButtonProps = {
  direction: 'up' | 'down';
  onClick?: () => void; // Optional onClick handler
  style?: React.CSSProperties;
};

const BrightnessButton: React.FC<BrightnessButtonProps> = ({ direction, onClick, style }) => {
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
      className={`relative w-16 h-8 bg-customBlue text-customYellow 
      border-2 border-customGray flex items-start justify-center text-center
      ${isActive ? 'border-customBlue' : ' border-customWhite'}`}
      onClick={onClick}
      style={{
        borderBottomColor: isActive ? '#000080' : '#818181',
        borderRightColor: isActive ? '#000080' : '#818181',
        ...style
      }}    
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsActive(false)} // Handle case where mouse leaves without release
      >
      <div className="flex flex-col">
        <span className={`text-2xl ${direction === 'up' ? '' : 'rotate-180'}`}>^</span>
        <span className="absolute inset-0 flex items-center justify-center text-base">&#9728;</span>
      </div>
    </button>
  );
};

export default BrightnessButton;
