// components/SummaryButton.tsx

import React, { useState } from 'react';
import '../vatlines/styles.css';

type SummaryButtonProps = {
  onClick?: () => void; // Optional onClick handler
  style?: React.CSSProperties;
  compact?: boolean; // When true, sizes to match square buttons (w-16 h-16)
};

const SummaryButton: React.FC<SummaryButtonProps> = ({ onClick, style, compact = false }) => {
  const [isActive, setIsActive] = useState(false);

  const handleMouseDown = () => {
    setIsActive(true);
  };

  const handleMouseUp = () => {
    setIsActive(false);
    if (onClick) onClick();
  };

  // Size classes based on compact mode
  const sizeClass = compact ? 'w-16 h-16' : 'w-28 h-16';
  const textClass = compact ? 'text-base' : 'text-lg';

  return (
    <button
      className={`relative ${sizeClass} bg-customBlue text-customYellow 
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
        <span className={`${textClass} rdvs-label`}>
          SUMM
        </span>
      </div>
    </button>
  );
};

export default SummaryButton;
