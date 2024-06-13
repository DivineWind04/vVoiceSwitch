// components/AirGroundRow.tsx

import React from 'react';
import FrequencyButton from './FreqButton';
import SquareButton from '../base_button/SquareButton';

type AirGroundRowProps = {
  frequency: string;
  hasHeadset: boolean;
  hasLoudspeaker: boolean;
};

const AirGroundRow: React.FC<AirGroundRowProps> = ({ frequency, hasHeadset, hasLoudspeaker }) => {
  return (
    <div className="flex mb-2.5 gap-2.5">
      {/* Frequency Button */}
      <FrequencyButton
        frequency={frequency}
        hasHeadset={hasHeadset}
        hasLoudspeaker={hasLoudspeaker}
      />
      {/* Square Buttons */}
      <SquareButton topLine='TX' bottomLine='SEL' />
      <SquareButton topLine='RX' bottomLine='SEL' />
      <SquareButton topLine='TX' bottomLine='MAIN' />
      <SquareButton topLine='RX' bottomLine='MAIN' />
    </div>
  );
};

export default AirGroundRow;
