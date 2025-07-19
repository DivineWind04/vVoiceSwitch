// components/OOSFreqButton.tsx

import React, { useState } from 'react';

type OOSFreqButtonProps = {
  style?: React.CSSProperties;
};

const OOSFreqButton: React.FC<OOSFreqButtonProps> = ({ style }) => {
  return (
    <button
      className={`relative w-28 h-16 bg-customBlue text-customYellow 
    border-[3px] border-customBlue flex items-start justify-center`}
      style={{
        ...style
      }}
    >
    </button>
  );
};

export default OOSFreqButton;
