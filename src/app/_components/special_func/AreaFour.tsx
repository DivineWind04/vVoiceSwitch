// components/AreaFour.tsx
'use client'

import React from 'react';
// import BrightnessButton from './BrightnessButton';
import FieldSelector from './FieldSelector';
import ScrollButton from './ScrollButton';
import DisplayField from './DisplayField';
import ScrollIndicator from './ScrollIndicator';

const AreaFour: React.FC = () => {
  return (
    <div className="flex p-2 -mb-4">
      {/* Brightness Controls */}
      <div className="flex items-center space-x-1 mr-1">
        {/* <BrightnessButton direction="up" />
        <BrightnessButton direction="down" /> */}
      </div>

      {/* Select Field Selector and Field Scroll Controls */}
      <div className="flex items-center space-x-4 ml-[160px]">
        <FieldSelector />
        <div className="flex items-center space-x-1">
          <ScrollButton direction="up" onClick={() => console.log('Scroll Up')} />
          <ScrollButton direction="down" onClick={() => console.log('Scroll Down')} />
        </div>
      </div>

      {/* Scroll Indicator and Display Fields */}
      <div className="flex items-end ml-[5px] space-x-1 justify-end">
        {/* Align ScrollIndicator with the bottom of the lower DisplayField box */}
        <div className="flex flex-col justify-end space-y-1">
          <div className="flex mb-[20px] items-center"> {/* Ensures the indicator aligns with the box */}
            <ScrollIndicator indicate={false} />
          </div>
        </div>
        <div className="flex flex-col space-y-[1px]">
          <DisplayField label="IA DISPLAY" />
          <DisplayField label="CALLER ID" />
        </div>
      </div>
    </div>
  );
};

export default AreaFour;
