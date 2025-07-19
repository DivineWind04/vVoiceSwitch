// components/OOSButton.tsx

import React, { useState } from 'react';

type OOSButtonProps = {
  style?: React.CSSProperties;
};

const OOSButton: React.FC<OOSButtonProps> = ({ style }) => {
  return (
    <button
      className={`relative w-16 h-16 bg-customBlue text-customYellow 
    border-4 border-customBlack flex items-start justify-center text-center
    border-customLightBlue`}
      style={{
        borderBottomColor: '#000000',
        borderRightColor: '#000000',
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
    >
    </button>
  );
};

export default OOSButton;
