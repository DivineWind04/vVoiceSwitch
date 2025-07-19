// components/AirGroundPage.tsx
'use client'

import React, { useState } from 'react';
import AirGroundRow from './AirGroundRow';
import FrequencyButton from './FreqButton';
import ChiseledSelectorButton from '../base_button/ChiseledSelectorButton';
import SummaryButton from './SummaryButton';
import SummFreqButton from './SummFreqButton';
import OOSButton from '../base_button/OOSButton';

import FrequencyConfig from 'example-config.json';
import DAButton from '../ground_ground/DAButton';

type AirGroundPageProps = {
  isGG3Active?: boolean;
  currentGGPage?: number;
  onExitGG3?: () => void;
};

const AirGroundPage: React.FC<AirGroundPageProps> = ({ isGG3Active = false, currentGGPage = 1, onExitGG3 }) => {
  // State for the selected page
  const [selectedPage, setSelectedPage] = useState(1);
  // State for the summary mode
  const [isSummaryEnabled, setIsSummaryEnabled] = useState(false);

  const handlePageChange = (page: number) => {
    setSelectedPage(page);
    setIsSummaryEnabled(false); // Exit summary mode when switching to any radio page
    if (isGG3Active && onExitGG3) {
      onExitGG3(); // Exit G/G 3 mode when switching A/G pages
    }
  };

  const handleSummaryToggle = () => {
    setIsSummaryEnabled(!isSummaryEnabled);
    // When enabling summary mode, don't change page
    // When disabling summary mode, don't change page
  };

  const handlePage1Click = () => {
    setSelectedPage(1);
    setIsSummaryEnabled(false); // Exit summary mode and go to page 1
  };

  // Select the correct array from AGLines based on currentPage
  const currentFreqPage = FrequencyConfig.AGLines[selectedPage - 1];

  const renderRows = () => {
    const rows: React.JSX.Element[] = [];
  
    // If G/G 3 is active, show 6x5 grid of DAButtons
    if (isGG3Active) {
      // Get all frequencies from all G/G pages
      const allGGLines = FrequencyConfig.GGLines.flat().filter(line => line !== null);
      const gridRows: React.JSX.Element[] = [];
      
      // Create 6 rows of 5 buttons each (30 total)
      for (let row = 0; row < 6; row++) {
        const rowButtons: React.JSX.Element[] = [];
        for (let col = 0; col < 5; col++) {
          const index = row * 5 + col;
          const line = allGGLines[index];
          
          if (line) {
            rowButtons.push(
              <DAButton
                key={index}
                topLine={line.name_top}
                middleLine={"name_middle" in line ? line.name_middle : undefined}
                bottomLine={"name_bottom" in line ? line.name_bottom : undefined}
                onClick={() =>
                  console.log(`Ground Ground Button ${line.name_top} clicked`)
                }
                latching={false}
                dialLine={"dial_line" in line ? line.dial_line : undefined}
              />
            );
          } else {
            // Add empty button if no frequency data
            rowButtons.push(
              <OOSButton key={index} />
            );
          }
        }
        
        gridRows.push(
          <div key={`gg-row-${row}`} className="flex flex-row space-x-[3px] mb-[3px]">
            {rowButtons}
          </div>
        );
      }
      
      rows.push(
        <div key="gg-grid" className="my-[1px]">
          {gridRows}
        </div>
      );
      
      return rows;
    }

    // If A/G Sum is enabled, show summary grid instead of AirGroundRows
    if (isSummaryEnabled) {
      // Use frequencies from the currently selected page instead of all pages
      const currentPageFrequencies = currentFreqPage || [];
      const summaryRows: React.JSX.Element[] = [];
      
      // Create 6 rows of 5 buttons each (30 total)
      for (let row = 0; row < 6; row++) {
        const rowButtons: React.JSX.Element[] = [];
        for (let col = 0; col < 5; col++) {
          const index = row * 5 + col;
          const line = currentPageFrequencies[index];
          
          if (line) {
            rowButtons.push(
              <SummFreqButton
                key={index}
                frequency={line.frequency}
                name={line.name}
                prefMode={true}
                currMode={true}
              />
            );
          } else {
            // Add empty button if no frequency data - no prefMode/currMode
            rowButtons.push(
              <OOSButton
              />
            );
          }
        }
        
        summaryRows.push(
          <div key={`summary-row-${row}`} className="flex flex-row space-x-[3px] mb-[3px]">
            {rowButtons}
          </div>
        );
      }
      
      rows.push(
        <div key="summary-grid" className="my-[1px]">
          {summaryRows}
        </div>
      );
    } else {
      // Show normal AirGroundRows when summary is not enabled
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
    }
    
    return rows;
  };

  const renderPageButtons = () => {
    const buttons: React.JSX.Element[] = [];
  
    // Always exclude the currently selected page
    const pagesToShow = [1, 2, 3, 4, 5].filter(page => page !== selectedPage);
  
    // Map over the pages array to create the buttons
    pagesToShow.map((page, index) => {
      buttons.push(
        <ChiseledSelectorButton
          key={index}
          topLine={`A/G ${page}`}
          onClick={() => handlePageChange(page)}
        />
      );
    });
  
    return buttons;
  };

  
  return (
    <div className="p-2">
      {/* Render rows */}
      {renderRows()}
      {/* Control row */}
      <div className="flex space-x-[3px]">
        {isSummaryEnabled ? (
          <ChiseledSelectorButton
            topLine="A/G 1"
            onClick={handlePage1Click}
          />
        ) : isGG3Active ? (
          <ChiseledSelectorButton
            topLine="A/G SUM"
            onClick={handleSummaryToggle}
          />
        ) : (
          <SummaryButton onClick={handleSummaryToggle} />
        )}
        {renderPageButtons()}
      </div>

      {/* Selected page */}
      <div className="text-yellow-300 text-center items-center justify-center font text-[14px]]">
        {isGG3Active ? `G/G PAGE ${currentGGPage}` : isSummaryEnabled ? `RADIO SUMMARY PAGE ${selectedPage}` : `RADIO PAGE ${selectedPage}`}
      </div>
    </div>
  );
};

export default AirGroundPage;
