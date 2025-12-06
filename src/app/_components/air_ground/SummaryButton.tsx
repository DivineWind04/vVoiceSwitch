// components/SummaryButton.tsx

import React, { useState } from 'react';

type SummaryButtonProps = {
  onClick?: () => void; // Optional onClick handler
  style?: React.CSSProperties;
};

const SummaryButton: React.FC<SummaryButtonProps> = ({ onClick, style }) => {
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
      className={`relative w-28 h-16 bg-customBlue text-customYellow 
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
      <div className={`flex flex-col h-full justify-center`}>
        <span className="text-xl font-bold">
          SUMM
        </span>
      </div>
    </button>
  );
};

export default SummaryButton;
