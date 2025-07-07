// components/ScrollIndicator.tsx

import React from 'react';

type ScrollIndicatorProps = {
  indicate: boolean; // Prop to control the color change
};

const ScrollIndicator: React.FC<ScrollIndicatorProps> = ({ indicate }) => {
  return (
    <div
      className={`w-3 h-3 ${indicate ? 'bg-customYellow' : 'bg-customBlue'}`}
    ></div>
  );
};

export default ScrollIndicator;
