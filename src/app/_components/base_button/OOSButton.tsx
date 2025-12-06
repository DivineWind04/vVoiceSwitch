// components/OOSButton.tsx

import React, { useState } from 'react';

type OOSButtonProps = {
  style?: React.CSSProperties;
};

const OOSButton: React.FC<OOSButtonProps> = ({ style }) => {
  return (
    <button
      className={`relative w-16 h-16 bg-customBlue text-customYellow 
    border-2 border-customBlue flex items-start justify-center`}
      style={{
        ...style
      }}
    >
    </button>
  );
};

export default OOSButton;
