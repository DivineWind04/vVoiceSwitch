// components/FrequencyButton.tsx

"use client"; // Mark as Client Component if using Next.js

import React, { CSSProperties, useState } from 'react';
import { FaHeadphones, FaVolumeOff } from 'react-icons/fa';

type FrequencyButtonProps = {
  frequency: string;
  name: string;
  prefMode: boolean; // True for headset (initial), False for loudspeaker
  currMode: boolean; // True for headset, False for loudspeaker
  style?: CSSProperties;
  onClick?: () => void;
};

const FrequencyButton: React.FC<FrequencyButtonProps> = ({ frequency, prefMode: initialprefMode, currMode: initialCurrentMode, name, style, onClick }) => {
  const [isActive, setIsActive] = useState(false);
  const [isprefMode, setIsprefMode] = useState(initialprefMode); // Initialize prefMode to the provided prop
  const [isCurrentMode, setIsCurrentMode] = useState(initialCurrentMode); // Initialize current mode to false

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
      className={`relative w-28 h-16 bg-customBlue text-customYellow border-t-2 border-l-2 border-b-2 border-r-2 flex items-start justify-center text-center group ${isActive ? 'border-customBlue' : ''}`}
      style={{
        borderTopColor: '#ffffff',
        borderLeftColor: '#ffffff',
        borderBottomColor: isActive ? '#000080' : '#818181',
        borderRightColor: isActive ? '#000080' : '#818181',
        ...style
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setIsActive(false)} // Handle case where mouse leaves without release
    >
      {/* Preferred Individual A/G Routing */}
      {isprefMode ? (
        <div className="absolute top-2 left-2">
          <FaHeadphones className="text-customYellow border border-customYellow" />
        </div>
      ) : (
        <div className="absolute top-2 left-2">
          <FaVolumeOff className="text-customYellow border border-customYellow" />
        </div>
      )}

      {/* Current A/G Routing */}
      {isCurrentMode ? (
        <div className="absolute top-2 right-2">
          <FaHeadphones className="text-customYellow " />
        </div>
      ) : (
        <div className="absolute top-2 right-2">
          <FaVolumeOff className="text-customYellow" />
        </div>
      )}

      {/* Frequency Text */}
      <span className="absolute bottom-0 text-2xl font-bold">{frequency}</span>

      {/* Hover Info Box
      <div className="absolute bottom-full top-0 -left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs p-2 mr-4 self-center text-center text-customYellow bg-customGray border border-customBlue rounded-md shadow-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
        {name}
      </div> */}
    </button>
  );
};

export default FrequencyButton;
