// components/ScrollButton.tsx

import React, { useState } from 'react';

type ScrollButtonProps = {
  direction: 'up' | 'down';
  onClick?: () => void; // Optional onClick handler
  style?: React.CSSProperties;
};

const ScrollButton: React.FC<ScrollButtonProps> = ({ direction, onClick, style }) => {
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
      <span className={`text-xl self-center ${direction === 'up' ? '' : 'rotate-180'}`}>&#9650;</span>
    </button>
  );
};

export default ScrollButton;
