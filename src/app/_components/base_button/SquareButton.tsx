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
    border-4 border-customBlack flex items-start justify-center text-center
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
      {/* Text anchored to top of indicator */}
      <div className="absolute bottom-[14px] left-0 right-0 flex flex-col items-center justify-end">
        <span className="text-[14px] font uppercase break-words leading-tight">
          {topLine}
        </span>
        {bottomLine && (
          <span className="text-[14px] font uppercase break-words leading-tight">
            {bottomLine}
          </span>
        )}
      </div>
      {isIndicatorVisible && (
        <div className="absolute bottom-[1px] w-[46px] h-[13px] py-[2px] bg-customGreen px-[5px]"></div>
      )}
    </button>
  );
};

export default SquareButton;
