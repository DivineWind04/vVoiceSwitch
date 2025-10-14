// components/AirGroundPage.tsx
'use client'

import React, { useMemo, useState } from 'react';
import AirGroundRow from './AirGroundRow';
import FreqRow from "./FreqRow";
import SquareSelectorButton from '../base_button/SquareSelectorButton';
import SummaryButton from './SummaryButton';

import FrequencyConfig from 'example-config.json';
import { useCoreStore } from '~/model';

const AirGroundPage: React.FC = () => {
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

  const renderRows = () => {
    const rows: React.JSX.Element[] = [];

    if (showFreqSummary) {
      const agLines = FrequencyConfig?.AGLines as any[] | undefined;
      const base = agLines?.[0] as any[] | undefined;
      const transposeFrequencyConfig = base?.map((_: any, colIndex: number) => agLines?.slice(0, 4).map((row: any) => row[colIndex]));
      transposeFrequencyConfig?.map((freqPage: any, idx: number) => {
        rows.push(
            <FreqRow
                key={idx}
                entries={freqPage}
            />
        );
      });
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
        {!showFreqSummary &&
        <SummaryButton onClick={handleSumClick} />
        }
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
