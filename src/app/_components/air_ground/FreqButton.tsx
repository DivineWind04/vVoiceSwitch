// components/FrequencyButton.tsx

"use client"; // Mark as Client Component if using Next.js

import React, { CSSProperties, useEffect, useState } from 'react';
import '../vatlines/styles.css';

type FrequencyButtonProps = {
  frequency: string;
  name: string;
  prefMode: boolean; // True for headset (initial), False for loudspeaker
  currMode: boolean; // True for headset, False for loudspeaker
  squareBtn?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
  onToggleRoute?: (toHeadset: boolean) => void; // toggle between HS/LS
};

const FrequencyButton: React.FC<FrequencyButtonProps> = ({ frequency, prefMode: initialprefMode,
                                                            currMode: initialCurrentMode, name, squareBtn = false,
                                                            style, onClick, onToggleRoute }) => {
  const [isActive, setIsActive] = useState(false);
  const [isprefMode, setIsprefMode] = useState(initialprefMode); // Initialize prefMode to the provided prop
  const [isCurrentMode, setIsCurrentMode] = useState(initialCurrentMode); // Initialize current mode to false

  useEffect(() => {
    setIsprefMode(initialprefMode);
  }, [initialprefMode]);
  useEffect(() => {
    setIsCurrentMode(initialCurrentMode);
  }, [initialCurrentMode]);

  const handleMouseDown = () => {
    setIsActive(true);
  };

  const handleMouseUp = () => {
    setIsActive(false);
  const next = !isprefMode;
  setIsprefMode(next); // Toggle prefMode
  setIsCurrentMode(next); // Mirror current for now
  onToggleRoute?.(next);
    if (onClick) onClick();
  };

  return (
    <button
      className={`relative w-${squareBtn ? '16' : '28'} h-16 bg-customBlue text-customYellow border-t-2 border-l-2 border-b-2 border-r-2 flex items-start justify-center text-center group ${isActive ? 'border-customBlue' : ''}`}
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
      {/* Preferred Individual A/G Routing - top left corner */}
      {isprefMode ? (
        <div className="absolute top-0 left-0.5">
          <img src="/headphone.svg" alt="Headset" style={{ width: 20, height: 20, border: '1px solid #fffd46' }} />
        </div>
      ) : (
        <div className="absolute top-0 left-0.5">
          <img src="/speaker.svg" alt="Speaker" style={{ width: 18, height: 18, border: '1px solid #fffd46' }} />
        </div>
      )}

      {/* Current A/G Routing - top right corner */}
      {isCurrentMode ? (
        <div className="absolute top-0 right-0.5">
          <img src="/headphone.svg" alt="Headset" style={{ width: 20, height: 20 }} />
        </div>
      ) : (
        <div className="absolute top-0 right-0.5">
          <img src="/speaker.svg" alt="Speaker" style={{ width: 18, height: 18 }} />
        </div>
      )}

      {/* Frequency Text - centered in button */}
      <span className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-${ squareBtn ? "xl" : "2xl"} rdvs-label`}>{frequency}</span>

      {/* Hover Info Box
      <div className="absolute bottom-full top-0 -left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs p-2 mr-4 self-center text-center text-customYellow bg-customGray border border-customBlue rounded-md shadow-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
        {name}
      </div> */}
    </button>
  );
};

export default FrequencyButton;
