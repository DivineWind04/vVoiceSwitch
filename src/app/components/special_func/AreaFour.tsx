// components/AreaFour.tsx
'use client'

import React from 'react';
import BrightnessButton from './BrightnessButton';
import FieldSelector from './FieldSelector';
import ScrollButton from './ScrollButton';
import DisplayField from './DisplayField';
import ScrollIndicator from './ScrollIndicator';

const AreaFour: React.FC = () => {
  return (
    <div className="flex items-center mt-4 ml-4 mr-4 -mb-1.5">
      {/* Brightness Controls */}
      <div className="flex items-center space-x-2.5">
        <BrightnessButton direction="up" onClick={() => console.log('Brightness Up')} />
        <BrightnessButton direction="down" onClick={() => console.log('Brightness Down')} />
      </div>

      {/* Select Field Selector and Field Scroll Controls */}
      <div className="flex items-center space-x-2.5 ml-13">
        <FieldSelector />
        <div className="flex items-center space-x-2.5">
          <ScrollButton direction="up" onClick={() => console.log('Scroll Up')} />
          <ScrollButton direction="down" onClick={() => console.log('Scroll Down')} />
        </div>
      </div>

      {/* Scroll Indicator and Display Fields */}
      <div className="flex items-end ml-14 space-x-2 justify-end">
        {/* Align ScrollIndicator with the bottom of the lower DisplayField box */}
        <div className="flex flex-col justify-end space-y-1">
          <div className="flex items-center"> {/* Ensures the indicator aligns with the box */}
            <ScrollIndicator indicate={false} />
          </div>
          <div className="flex items-center"></div> {/* Empty placeholder to balance the height */}
        </div>
        <div className="flex flex-col">
          <DisplayField label="IA DISPLAY" />
          <DisplayField label="CALLER ID" />
        </div>
      </div>
    </div>
  );
};

export default AreaFour;
