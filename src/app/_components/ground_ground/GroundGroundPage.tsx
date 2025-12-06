// components/GroundGroundPage.tsx
"use client";

import React, { useMemo, useState } from "react";
import DAButton from "./DAButton";
import SquareSelectorButton from "../base_button/SquareSelectorButton";
import OOSButton from "../base_button/OOSButton";

import FrequencyConfig from "example-config.json";
import Keypad from "./Keypad";
import { useCoreStore } from "~/model";

interface GroundGroundPageProps {
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

const GroundGroundPage: React.FC<GroundGroundPageProps> = ({ currentPage: externalPage, onPageChange: externalOnPageChange }) => {
  const [internalPage, setInternalPage] = useState(1); // State to track current page
  
  const currentPage = externalPage !== undefined ? externalPage : internalPage;
  const setCurrentPage = externalOnPageChange || setInternalPage;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  const ptt = useCoreStore((s: any) => s.ptt);
  const gg_status = useCoreStore((s: any) => s.gg_status);
  const ITEM_PER_PAGE = 18;
  const currentSlice = useMemo(() => {
    // Implement overflow logic: if there are more G/G entries than can fit on page 1,
    // automatically overflow them to page 2
    if (currentPage === 1) {
      // Page 1: show first ITEM_PER_PAGE items
      const slice = gg_status.slice(0, ITEM_PER_PAGE);
      if (slice.length < ITEM_PER_PAGE) {
        return [...slice, ...new Array(ITEM_PER_PAGE - slice.length).fill(undefined)];
      }
      return slice;
    } else if (currentPage === 2) {
      // Page 2: show overflow items (items beyond ITEM_PER_PAGE)
      const slice = gg_status.slice(ITEM_PER_PAGE);
      // Limit to ITEM_PER_PAGE items and pad if needed
      const limitedSlice = slice.slice(0, ITEM_PER_PAGE);
      if (limitedSlice.length < ITEM_PER_PAGE) {
        return [...limitedSlice, ...new Array(ITEM_PER_PAGE - limitedSlice.length).fill(undefined)];
      }
      return limitedSlice;
    } else {
      // For other pages, use existing logic
      const start = (currentPage - 1) * ITEM_PER_PAGE;
      const end = start + ITEM_PER_PAGE;
      const slice = gg_status.slice(start, end);
      if (slice.length < ITEM_PER_PAGE) {
        return [...slice, ...new Array(ITEM_PER_PAGE - slice.length).fill(undefined)];
      }
      return slice;
    }
  }, [gg_status, currentPage]);

  const renderButtons = () => {
    const buttons: React.JSX.Element[] = [];
    currentSlice.map((data: any, index: number) => {
      if (!data) {
        buttons.push(<OOSButton key={index} />);
        return;
      }
      const call_type = data?.call?.substring(0, 2);
      const call_id = data.call?.substring(3);
  let onClick: (() => void) | undefined = undefined;
  let indicator = false;
  let indicatorClassName = '';
      // Simplified mapping; follow panel.tsx behavior
      if (call_type === 'SO') {
        if (data.status === 'idle') {
          onClick = () => sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 });
        } else if (data.status === 'online' || data.status === 'chime') {
          indicatorClassName = 'flutter receive flashing';
          onClick = () => sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 });
        } else if (data.status === 'ok') {
          indicator = ptt;
          indicatorClassName = indicator ? 'flutter active' : 'steady green';
          onClick = () => sendMsg({ type: 'stop', cmd1: call_id, dbl1: 1 });
        } else if (data.status === 'overridden' || data.status === 'terminate') {
          onClick = undefined;
        } else {
          // fallback: allow hangup if not overridden/terminate
          onClick = () => sendMsg({ type: 'stop', cmd1: call_id, dbl1: 1 });
        }
      } else {
        if (data.status === 'off' || data.status === '') {
          onClick = () => sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 });
        } else if (data.status === 'busy') {
          onClick = undefined;
          indicatorClassName = 'steady red';
        } else if (data.status === 'hold') {
          onClick = undefined;
          indicatorClassName = 'flutter hold';
        } else if (data.status === 'pending' || data.status === 'terminate' || data.status === 'overridden') {
          onClick = undefined;
        } else if (data.status === 'ok' || data.status === 'active') {
          onClick = () => sendMsg({ type: 'stop', cmd1: call_id, dbl1: 2 });
          indicator = ptt || data.status === 'active';
          indicatorClassName = indicator ? 'flutter active' : 'steady green';
        } else if (data.status === 'chime' || data.status === 'ringing') {
          onClick = () => sendMsg({ type: 'stop', cmd1: call_id, dbl1: 2 });
          indicator = true;
          indicatorClassName = 'flutter receive flashing';
        }
      }

      buttons.push(
        <DAButton
          key={index}
          topLine={data.call_name || data.call}
          latching={false}
          onClick={onClick}
          controlledIndicator={indicator}
          indicatorClassName={indicatorClassName}
        />
      );
    });
    return buttons;
  };

  return (
  <div className="pt-4 pb-4 px-4">
      {/* Render pages of buttons */}
      <div className="mb-0.5">
        <div className="flex grid grid-cols-3 gap-1">
          {renderButtons()}
        </div>
      </div>
      {/* Navigation buttons */}
      <div className="flex gap-1 mt-1 mb-0.5">
        {[1, 2, 3].map((page) => (
          <SquareSelectorButton
            key={page}
            topLine={`G/G ${page}`}
            onClick={() => handlePageChange(page)}
          />
        ))}
      </div>
      {/* Selected page */}
      <div className="text-center text-sm font-bold text-white mt-0.5">
        G/G PAGE {currentPage}
      </div>
    </div>
  );
};

export default GroundGroundPage;
