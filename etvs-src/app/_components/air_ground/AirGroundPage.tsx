// components/AirGroundPage.tsx
'use client'

import React, { useState, useMemo } from 'react';
import AirGroundRow from './AirGroundRow';
import FrequencyButton from './FreqButton';
import ChiseledSelectorButton from '../base_button/ChiseledSelectorButton';
import SummaryButton from './SummaryButton';
import SummFreqButton from './SummFreqButton';
import OOSButton from '../base_button/OOSButton';

import { useCoreStore } from '~/model';
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

  // Use live ag_status from store, like ivsr
  const ag_status = useCoreStore(s => s.ag_status);
  const ITEM_PER_PAGE = 6;
  // Implement overflow logic: if there are more frequencies than can fit on page 1, 
  // automatically overflow them to page 2
  const currentFreqPage = useMemo(() => {
    if (selectedPage === 1) {
      // Page 1: show first ITEM_PER_PAGE items
      return ag_status.slice(0, ITEM_PER_PAGE);
    } else if (selectedPage === 2) {
      // Page 2: show overflow items (items beyond ITEM_PER_PAGE)
      const slice = ag_status.slice(ITEM_PER_PAGE);
      // Limit to ITEM_PER_PAGE items
      return slice.slice(0, ITEM_PER_PAGE);
    } else {
      // For other pages, use existing logic
      return ag_status.slice((selectedPage - 1) * ITEM_PER_PAGE, selectedPage * ITEM_PER_PAGE);
    }
  }, [ag_status, selectedPage]);

  const renderRows = () => {
    const rows: React.JSX.Element[] = [];
  
  // G/G 3 mode removed: only render A/G rows using ag_status

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
      // Render one AirGroundRow per frequency, passing data as a single object
      if (currentFreqPage && Array.isArray(currentFreqPage)) {
        currentFreqPage.forEach((freq, idx) => {
          rows.push(
            <AirGroundRow key={idx} data={freq} />
          );
        });
        // Fill up to 6 rows with empty buttons if needed
        for (let i = currentFreqPage.length; i < 6; i++) {
          rows.push(<AirGroundRow key={i} data={undefined} />);
        }
      } else {
        // If no data, render 6 empty rows
        for (let i = 0; i < 6; i++) {
          rows.push(<AirGroundRow key={i} data={undefined} />);
        }
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
