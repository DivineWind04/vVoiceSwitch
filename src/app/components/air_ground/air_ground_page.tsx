// components/AirGroundPage.tsx
'use client'

import React, { useState } from 'react';
import AirGroundRow from './air_ground_row';
import FrequencyButton from './freq_button';
import SquareButton from '../base_button/square_button';

const AirGroundPage: React.FC = () => {
  // Example data for rows
  const rows = [
    { frequency: "118.00", hasHeadset: true, hasLoudspeaker: true },
    { frequency: "119.00", hasHeadset: false, hasLoudspeaker: true },
    { frequency: "120.00", hasHeadset: true, hasLoudspeaker: true },
    { frequency: "121.00", hasHeadset: false, hasLoudspeaker: false },
    { frequency: "122.00", hasHeadset: true, hasLoudspeaker: false },
    { frequency: "123.00", hasHeadset: false, hasLoudspeaker: true }
  ];

  // State for the selected page
  const [selectedPage, setSelectedPage] = useState(1);

  return (
    <div className="p-4 space-y-2.5">
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
        <FrequencyButton frequency='SUMM' />
        {Array.from({ length: 4 }, (_, i) => i + 2).map(page => (
          <SquareButton key={`page-${page}`} topLine={`A/G ${page}`} />
        ))}
      </div>

      {/* Selected page */}
      <div className="text-white text-center items-center justify-center font-bold text-lg mt-4">
        A/G PAGE {selectedPage}
      </div>
    </div>
  );
};

export default AirGroundPage;
