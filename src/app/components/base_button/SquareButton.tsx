// components/SquareButton.tsx

import React, { useState } from 'react';

type SquareButtonProps = {
  topLine: string;
  bottomLine?: string;
  onClick?: () => void; // Optional onClick handler
  showIndicator?: boolean; // Optional prop to show indicator
  style?: React.CSSProperties;
};

const SquareButton: React.FC<SquareButtonProps> = ({ topLine, bottomLine, onClick, showIndicator = false, style }) => {
  const [isActive, setIsActive] = useState(false);
  const [isIndicatorVisible, setIndicatorVisible] = useState(showIndicator);

  const handleMouseDown = () => {
    setIsActive(true);
    setIndicatorVisible(!isIndicatorVisible); // Toggle indicator visibility
  };

  const handleMouseUp = () => {
    setIsActive(false);
    if (onClick) onClick();
  };

  return (
    <button
      className={`relative w-16 h-16 bg-customBlue text-customYellow 
    border-4 border-customGray flex items-start justify-center text-center
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
      <div className="absolute top-0 flex flex-col items-center space-y-0">
        <span className="text-lg font-bold uppercase break-words -mb-2 -mt-1">
          {topLine}
        </span>
        <span className="text-lg font-bold uppercase break-words -mt-2">
          {bottomLine}
        </span>
      </div>
      {isIndicatorVisible && (
        <div className="absolute bottom-1 left-1 right-1 h-2 bg-customGreen"></div>
      )}
    </button>
  );
};

export default SquareButton;
