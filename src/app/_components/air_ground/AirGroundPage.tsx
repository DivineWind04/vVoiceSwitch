// components/AirGroundPage.tsx
'use client'

import React, { useState } from 'react';
import AirGroundRow from './AirGroundRow';
import FrequencyButton from './FreqButton';
import SquareSelectorButton from '../base_button/SquareSelectorButton';
import SummaryButton from './SummaryButton';

import FrequencyConfig from 'example-config.json';

const AirGroundPage: React.FC = () => {
  // State for the selected page
  const [selectedPage, setSelectedPage] = useState(1);

  const handlePageChange = (page: number) => {
    setSelectedPage(page);
  };

  // Select the correct array from AGLines based on currentPage
  const currentFreqPage = FrequencyConfig.AGLines[selectedPage - 1];

  const renderRows = () => {
    const rows: React.JSX.Element[] = [];
  
    // Map over the currentFreqPage array to make the AirGroundRow components
    if (currentFreqPage) {
      currentFreqPage.map((line, index) => {
        rows.push(
          <AirGroundRow
            key={index}
            frequency={line.frequency}
            name={line.name}
            prefMode={true}
            currMode={true}
            outOfService={'out_of_service' in line ? line.out_of_service : undefined} // Use a type guard to check if out_of_service is in line
          />
        );
      });
    }
  
    // If there are less than 6 frequencies, add offline rows
    while (rows.length < 6) {
      rows.push(
        <AirGroundRow
          key={rows.length}
          frequency="" // Empty frequency
          name="" // Empty name
          prefMode={true}
          currMode={true}
          offline={true} // Set offline to true
        />
      );
    }
  
    return rows;
  };

  const renderPageButtons = () => {
    const buttons: React.JSX.Element[] = [];
  
    // Create an array of page numbers excluding the current page
    const pages = [1, 2, 3, 4, 5].filter(page => page !== selectedPage);
  
    // Map over the pages array to create the buttons
    pages.map((page, index) => {
      buttons.push(
        <SquareSelectorButton
          key={index}
          topLine={`A/G ${page}`}
          onClick={() => handlePageChange(page)}
        />
      );
    });
  
    return buttons;
  };

  
  return (
    <div className="p-4">
      {/* Render rows */}
      {renderRows()}
      {/* Control row */}
      <div className="flex space-x-1">
        <SummaryButton />
        {renderPageButtons()}
      </div>

      {/* Selected page */}
      <div className="text-white text-center items-center justify-center font-bold text-sm">
        A/G PAGE {selectedPage}
      </div>
    </div>
  );
};

export default AirGroundPage;
