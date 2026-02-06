// components/SummaryButton.tsx

import React, { useState } from 'react';

type SummaryButtonProps = {
  onClick?: () => void; // Optional onClick handler
  style?: React.CSSProperties;
  compact?: boolean; // When true, sizes to match square buttons
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
  const sizeClass = compact ? 'w-14 h-14' : 'w-28 h-14';

  return (
    <button
      className={`relative ${sizeClass} bg-customBlue text-customYellow border-b-blue300
    border-4 border-customBlack flex items-center justify-center text-center  clipped-box
    ${isActive ? 'border-black' : 'border-customBlue'}`}
      style={{
        fontFamily: "ivsr, sans-serif",
        borderTopColor: isActive ? '#000000' : '#1f67fa',
        borderLeftColor: isActive ? '#000000' : '#1f67fa',
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
      {/* Centered and styled text */}
      <div className={`flex flex-col h-full justify-center`}>
        <span className="text-[12px] font">
          A/G SUM
        </span>
      </div>
    </button>
  );
};

export default SummaryButton;
