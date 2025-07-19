// components/SummFreqButton.tsx

"use client"; // Mark as Client Component if using Next.js

import React, { CSSProperties, useState } from 'react';
import { FaHeadphones, FaVolumeOff } from 'react-icons/fa';

type SummFreqButtonProps = {
  frequency: string;
  name: string;
  prefMode?: boolean; // True for headset (initial), False for loudspeaker
  currMode?: boolean; // True for headset, False for loudspeaker
  style?: CSSProperties;
  onClick?: () => void;
};

const SummFreqButton: React.FC<SummFreqButtonProps> = ({ frequency, prefMode: initialprefMode, currMode: initialCurrentMode, name, style, onClick }) => {
  const [isActive, setIsActive] = useState(false);
  const [isprefMode, setIsprefMode] = useState(initialprefMode ?? false); // Initialize prefMode to the provided prop or false
  const [isCurrentMode, setIsCurrentMode] = useState(initialCurrentMode ?? false); // Initialize current mode to false

  const handleMouseDown = () => {
    setIsActive(true);
  };

  const handleMouseUp = () => {
    setIsActive(false);
    setIsprefMode(!isprefMode); // Toggle prefMode
    setIsCurrentMode(!isCurrentMode); // Toggle current mode
    if (onClick) onClick();
  };

  return (
    <button
      className={`relative w-16 h-16 bg-customBlue text-customYellow border-[4px] flex items-start justify-center text-center group ${isActive ? 'border-customBlue' : ''}`}
      style={{
        borderTopColor: isActive ? '#000000' : '#3275ff',
        borderLeftColor: isActive ? '#000000' : '#3275ff',
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
      {/* Preferred Individual A/G Routing */}
      {isprefMode ? (
        <div className="absolute top-[2px] left-[1px]">
          <FaHeadphones className="text-customYellow border border-customYellow" />
        </div>
      ) : (
        <div className="absolute top-[2px] left-[1px]">
          <FaVolumeOff className="text-customYellow border border-customYellow" />
        </div>
      )}

      {/* Current A/G Routing */}
      {isCurrentMode ? (
        <div className="absolute top-[2px] right-[3px]">
          <FaHeadphones className="text-customYellow " />
        </div>
      ) : (
        <div className="absolute top-[2px] right-[3px]">
          <FaVolumeOff className="text-customYellow" />
        </div>
      )}

      {/* Frequency Text */}
      <span className="absolute bottom-0 left-0 text-[10px] font pb-[20px] pl-1">{frequency}</span>

      {/* Hover Info Box
      <div className="absolute bottom-full top-0 -left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs p-2 mr-4 self-center text-center text-customYellow bg-customGray border border-customBlue rounded-md shadow-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
        {name}
      </div> */}
    </button>
  );
};

export default SummFreqButton;
