// components/FrequencyButton.tsx

import React, { CSSProperties } from 'react';
import { FaHeadphones, FaVolumeUp } from 'react-icons/fa';  // Importing icons from react-icons

type FrequencyButtonProps = {
  frequency: string;
  hasHeadset?: boolean;
  hasLoudspeaker?: boolean;
  style?: CSSProperties; // Accepting style as a prop
};

const FrequencyButton: React.FC<FrequencyButtonProps> = ({ frequency, hasHeadset, hasLoudspeaker, style }) => {
  return (
    <button
      className="relative w-28 h-16 bg-customBlue text-customYellow border-t-4 border-l-4 border-customWhite border-b-4 border-r-4 border-customGray flex items-center justify-center"
      style={{ borderBottomColor: '#818181', borderRightColor: '#818181', ...style }}
    >
      {/* Headphone icon */}
      {hasHeadset && (
        <div className="absolute top-2 left-2 border border-customYellow">
          <FaHeadphones className="text-customYellow" />
        </div>
      )}
      {/* Loudspeaker icon */}
      {hasLoudspeaker && (
        <FaVolumeUp className="absolute top-2 right-2 text-customYellow" />
      )}
      {/* Frequency Text */}
      <span className="absolute bottom-0 text-2xl font-bold">{frequency}</span>
    </button>
  );
};

export default FrequencyButton;
