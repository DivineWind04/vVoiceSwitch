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
       ${isActive ? 'border-black' : 'border-customLightBlue'}`}
      onClick={onClick}
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
      <div className="flex flex-col">
        <span className={`text-2xl ${direction === 'up' ? '' : 'rotate-180'}`}>^</span>
        <span className="absolute inset-0 flex items-center justify-center text-base">&#9728;</span>
      </div>
    </button>
  );
};

export default BrightnessButton;
