// components/BrightnessButton.tsx

import React, { useState } from 'react';
import { useCoreStore } from '../../../model';

type BrightnessButtonProps = {
  direction: 'up' | 'down';
  style?: React.CSSProperties;
};

const BrightnessButton: React.FC<BrightnessButtonProps> = ({ direction, style }) => {
  const [isActive, setIsActive] = useState(false);
  const adjustBrightness = useCoreStore((s) => s.adjustBrightness);

  const handleMouseDown = () => {
    setIsActive(true);
  };

  const handleMouseUp = () => {
    setIsActive(false);
    // Adjust brightness by +10 for up, -10 for down
    adjustBrightness(direction === 'up' ? 10 : -10);
  };
  
  return (
    <button
      className={`relative w-16 h-8 bg-customBlue text-customYellow 
      border-2 border-customGray flex items-start justify-center text-center
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
      <img 
        src={direction === 'up' ? '/ivsr/BrightUp.png' : '/ivsr/BrightDown.png'} 
        alt={`Brightness ${direction}`}
        className="w-full h-full object-contain"
      />
    </button>
  );
};

export default BrightnessButton;
