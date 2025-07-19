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
      className={`relative w-14 h-8 bg-customBlue text-customYellow 
    border-4 border-black flex items-center justify-center text-center
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
      {/* <div className={`${direction === 'up' ? '' : 'rotate-180'} w-8 h-8 border-customYellow border-t-[3px] border-l-[3px] transform rotate-45 border-customYellow`}></div> */}

      <span 
        className={`text-[50px] ${direction === 'up' ? 'rotate-[-90deg]' : 'rotate-90'}`} 
        style={{marginLeft: '-2px'}}
      >
        &#10095;
      </span>
    </button>
  );
};

export default ScrollButton;
