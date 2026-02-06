// components/SquareSelectorButton.tsx

import React, { useState } from 'react';
import '../vatlines/styles.css';

type SquareSelectorButtonProps = {
  topLine: string;
  bottomLine?: string;
  onClick?: () => void; // Optional onClick handler
  style?: React.CSSProperties;
  useRdvsFont?: boolean; // Use RDVS font style (EDSTv302)
  isActive?: boolean; // External active state (e.g., for keypad active)
};

const SquareSelectorButton: React.FC<SquareSelectorButtonProps> = ({ topLine, bottomLine, onClick, style, useRdvsFont = false, isActive: externalActive }) => {
  const [isPressing, setIsPressing] = useState(false);

  const handleMouseDown = () => {
    setIsPressing(true);
  };

  const handleMouseUp = () => {
    setIsPressing(false);
    if (onClick) onClick();
  };

  // Button is visually active if being pressed OR externally marked active
  const isActive = isPressing || externalActive;

  // Always use rdvs-label font, but size varies: xl for page selectors, 2xl for others
  const fontClass = useRdvsFont ? 'text-xl rdvs-label' : 'text-2xl rdvs-label';

  return (
    <button
      className={`relative w-16 h-16 bg-customBlue text-customYellow 
    border-2 border-customGray flex items-start justify-center
    ${isActive ? 'border-customBlue' : ' border-customWhite'}`}
      style={{
        borderBottomColor: isActive ? '#000080' : '#818181',
        borderRightColor: isActive ? '#000080' : '#818181',
        ...style
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsPressing(false)} // Handle case where mouse leaves without release
    >
      {/* Centered and styled text */}
      <div className={`flex flex-col h-full justify-center ${bottomLine ? '' : 'items-center'}`}>
        <span className={fontClass}>
          {topLine}
        </span>
        {bottomLine && <span className={fontClass}>{bottomLine}</span>}
      </div>

    </button>
  );
};

export default SquareSelectorButton;
