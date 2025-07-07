// components/FieldSelector.tsx

import React, { useState } from 'react';

type FieldSelectorProps = {
  onClick?: () => void; // Optional onClick handler
  style?: React.CSSProperties;
};

const FieldSelector: React.FC<FieldSelectorProps> = ({ onClick, style }) => {
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
      className={`items-center relative w-16 h-8 bg-customBlue text-customYellow 
    border-2 border-customGray flex justify-center text-center
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
      <div className="relative">
        <span className="text-sm font-bold">SEL</span>
      </div>
    </button>
  );
};

export default FieldSelector;
