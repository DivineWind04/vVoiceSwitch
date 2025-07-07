// components/AirGroundRow.tsx

import React from 'react';
import FrequencyButton from './FreqButton';
import SquareButton from '../base_button/SquareButton';
import OOSButton from '../base_button/OOSButton';
import OOSFreqButton from './OOSFreqButton';
import { off } from 'process';

type AirGroundRowProps = {
  frequency: string;
  name: string;
  prefMode: boolean; // True for hs, False for ls
  currMode: boolean; // True for hs, False for ls
  outOfService?: boolean;
  offline?: boolean;
};

const AirGroundRow: React.FC<AirGroundRowProps> = ({ frequency, name, prefMode, currMode, outOfService, offline }) => {
  return (
    <div className="flex mb-1 gap-1">
      {/* Frequency Button */}
      {!offline ? (
        <FrequencyButton
          name={name}
          frequency={frequency}
          prefMode={prefMode}
          currMode={currMode}
        />
      ) : (
        <OOSFreqButton />
      )  
      }
      {/* Square Buttons */}
      {!outOfService && !offline ? (
        <>
          <SquareButton topLine='TX' bottomLine='SEL' />
          <SquareButton topLine='RX' bottomLine='SEL' />
          <SquareButton topLine='TX' bottomLine='MAIN' />
          <SquareButton topLine='RX' bottomLine='MAIN' />
        </>
      ) : (
        <>
          <OOSButton />
          <OOSButton />
          <OOSButton />
          <OOSButton />
        </>
      )}
    </div>
  );
};

export default AirGroundRow;
