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
      {/* Text anchored to top of indicator */}
      <div className="absolute bottom-2.5 left-0 right-0 flex flex-col items-center justify-end">
        <span className="text-lg font-bold uppercase break-words leading-tight">
          {topLine}
        </span>
        {bottomLine && (
          <span className="text-lg font-bold uppercase break-words leading-tight">
            {bottomLine}
          </span>
        )}
      </div>
      {isIndicatorVisible && (
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-customGreen"></div>
      )}
    </button>
  );
};

export default SquareButton;
