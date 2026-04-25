// components/StvsKeypadButton.tsx

import React, { useState } from 'react';

type StvsKeypadButtonProps = {
  topLine: string;
  bottomLine?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  brightness?: number; // Brightness from ILLUM knob
};

const StvsKeypadButton: React.FC<StvsKeypadButtonProps> = ({ 
  topLine, 
  bottomLine, 
  onClick, 
  style, 
  brightness = 1.0 
}) => {
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
      className={`relative w-[49px] h-[49px] bg-white text-black border-2 border-gray-400 
        flex flex-col items-center justify-center text-center font-bold
        ${isActive ? 'bg-gray-200 border-gray-600' : 'bg-white border-gray-400'}
        hover:bg-gray-100 transition-colors select-none`}
      style={{
        boxShadow: isActive ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
        transform: isActive ? 'translateY(1px)' : 'none',
        fontFamily: 'ETVSButton, monospace',
        ...style
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsActive(false)}
      onClick={onClick}
    >
      {/* Letters on top, smaller */}
      {topLine && (
        <span className="text-[10px] font-normal leading-none mb-0.5">
          {topLine}
        </span>
      )}
      
      {/* Numbers on bottom, larger */}
      {bottomLine && (
        <span className="text-[14px] font-bold leading-none">
          {bottomLine}
        </span>
      )}
      
      {/* For * and # keys that only have one symbol */}
      {!bottomLine && topLine && (
        <span className="text-[14px] font-bold leading-none">
          {topLine}
        </span>
      )}
    </button>
  );
};

export default StvsKeypadButton;