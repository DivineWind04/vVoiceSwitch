// components/AirGroundPage.tsx
'use client'

import React, { useMemo, useState } from 'react';
import AirGroundRow from './AirGroundRow';
import FreqRow from "./FreqRow";
import SquareSelectorButton from '../base_button/SquareSelectorButton';
import SummaryButton from './SummaryButton';

import { useCoreStore } from '~/model';

interface AirGroundPageProps {
  hideRows?: boolean;
}

const AirGroundPage: React.FC<AirGroundPageProps> = ({ hideRows = false }) => {
  // State for the selected page
  const [selectedPage, setSelectedPage] = useState(1);
  const [showFreqSummary, setShowFreqSummary] = useState(false);

  const handlePageChange = (page: number) => {
    setShowFreqSummary(false);
    setSelectedPage(page);
  };

  const ag_status = useCoreStore((s: any) => s.ag_status);
  const ITEM_PER_PAGE = 6;
  const currentSlice = useMemo(() => {
    // Implement overflow logic: if there are more frequencies than can fit on page 1, 
    // automatically overflow them to page 2
    if (selectedPage === 1) {
      // Page 1: show first ITEM_PER_PAGE items
      const slice = ag_status.slice(0, ITEM_PER_PAGE);
      // ensure length 6
      if (slice.length < ITEM_PER_PAGE) {
        return [...slice, ...new Array(ITEM_PER_PAGE - slice.length).fill(undefined)]
      }
      return slice;
    } else if (selectedPage === 2) {
      // Page 2: show overflow items (items beyond ITEM_PER_PAGE)
      const slice = ag_status.slice(ITEM_PER_PAGE);
      // Limit to ITEM_PER_PAGE items and pad if needed
      const limitedSlice = slice.slice(0, ITEM_PER_PAGE);
      if (limitedSlice.length < ITEM_PER_PAGE) {
        return [...limitedSlice, ...new Array(ITEM_PER_PAGE - limitedSlice.length).fill(undefined)];
      }
      return limitedSlice;
    } else {
      // For other pages, use existing logic (pages 3,4,5)
      const start = (selectedPage - 1) * ITEM_PER_PAGE;
      const end = start + ITEM_PER_PAGE;
      const slice = ag_status.slice(start, end);
      if (slice.length < ITEM_PER_PAGE) {
        return [...slice, ...new Array(ITEM_PER_PAGE - slice.length).fill(undefined)]
      }
      return slice;
    }
  }, [ag_status, selectedPage]);

  const handleSumClick = () => {
    setShowFreqSummary(!showFreqSummary);
  }

  const formatFreq = (freq: number) => {
    if (!freq) return "";
    const val = freq / 1_000_000;
    if (val % 1 === 0) return val.toFixed(1);
    return val.toString().replace(/0+$/, '').replace(/\.$/, '');
  };

  const renderRows = () => {
    const rows: React.JSX.Element[] = [];

    if (showFreqSummary) {
      // Use live ag_status data instead of mock FrequencyConfig
      // Display all frequencies in a summary grid format (6 rows of up to 5 frequencies each)
      const allFrequencies = ag_status.filter((data: any) => data && data.freq);
      
      // Group frequencies into rows of 5
      for (let i = 0; i < 6; i++) {
        const rowStart = i * 5;
        const rowEnd = rowStart + 5;
        const rowFrequencies = allFrequencies.slice(rowStart, rowEnd);
        
        // Map to FreqRow format
        const entries = rowFrequencies.map((data: any) => ({
          frequency: formatFreq(data.freq),
          name: data.name || formatFreq(data.freq),
          prefMode: data.h, // headset mode
          currMode: data.h  // current mode (same for now)
        }));
        
        rows.push(
          <FreqRow
            key={i}
            entries={entries}
          />
        );
      }
    } else {
        currentSlice.map((data: any, index: number) => {
          rows.push(
            <AirGroundRow key={index} data={data} offline={!data} />
          );
        });
    }
    return rows;
  };

  const renderPageButtons = () => {
    const buttons: React.JSX.Element[] = [];
  
    // Create an array of page numbers excluding the current page
    const pages = [1, 2, 3, 4, 5].filter(page => page !== selectedPage || showFreqSummary);
  
    // Map over the pages array to create the buttons
    pages.map((page, index) => {
      buttons.push(
        <SquareSelectorButton
          key={index}
          topLine={`A/G ${page}`}
          onClick={() => handlePageChange(page)}
          useRdvsFont={true}
        />
      );
    });
  
    return buttons;
  };

  
  return (
    <div className={hideRows ? "px-4 pt-0 pb-4" : "p-4"}>
      {/* Render rows */}
      {!hideRows && renderRows()}
      {/* Control row */}
      <div className="flex gap-1">
        {!showFreqSummary &&
        <SummaryButton onClick={handleSumClick} compact={hideRows} />
        }
        {renderPageButtons()}
      </div>

      {/* Selected page */}
      {!hideRows ? (
        <div className="text-white text-center items-center justify-center text-sm rdvs-label">
          A/G PAGE {selectedPage}
        </div>
      ) : (
        <div className="text-white text-center items-center justify-center text-sm rdvs-label">
          G/G PAGE 3
        </div>
      )}
    </div>
  );
};

export default AirGroundPage;
