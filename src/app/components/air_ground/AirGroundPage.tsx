// components/AirGroundPage.tsx
'use client'

import React, { useState } from 'react';
import AirGroundRow from './AirGroundRow';
import FrequencyButton from './FreqButton';
import SquareSelectorButton from '../base_button/SquareSelectorButton';
import SummaryButton from './SummaryButton';

const AirGroundPage: React.FC = () => {
  // Example data for rows
  const rows = [
    { frequency: "120.75", hasHeadset: true, hasLoudspeaker: true },
    { frequency: "129.4", hasHeadset: true, hasLoudspeaker: true },
    { frequency: "134.3", hasHeadset: true, hasLoudspeaker: true },
    { frequency: "121.5", hasHeadset: false, hasLoudspeaker: false },
    { frequency: "267.5", hasHeadset: true, hasLoudspeaker: false },
    { frequency: "243.0", hasHeadset: false, hasLoudspeaker: true }
  ];

  // State for the selected page
  const [selectedPage, setSelectedPage] = useState(1);

  return (
    <div className="p-4">
      {/* Render rows */}
      {rows.map((row, index) => (
        <AirGroundRow
          key={`row-${index}`}
          frequency={row.frequency}
          hasHeadset={row.hasHeadset}
          hasLoudspeaker={row.hasLoudspeaker}
        />
      ))}
      {/* Control row */}
      <div className="flex space-x-2.5">
        <SummaryButton />
        {Array.from({ length: 4 }, (_, i) => i + 2).map(page => (
          <SquareSelectorButton key={`page-${page}`} topLine={`A/G ${page}`} />
        ))}
      </div>

      {/* Selected page */}
      <div className="text-white text-center items-center justify-center font-bold text-lg">
        A/G PAGE {selectedPage}
      </div>
    </div>
  );
};

export default AirGroundPage;
