// components/GroundGroundPage3.tsx
"use client";

import React, { useMemo } from "react";
import DAButton from "./DAButton";
import OOSButton from "../base_button/OOSButton";
import { useCoreStore } from "~/model";

const GroundGroundPage3: React.FC = () => {
  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  const ptt = useCoreStore((s: any) => s.ptt);
  const gg_status = useCoreStore((s: any) => s.gg_status);
  
  const ITEM_PER_PAGE_3 = 30; // 6 rows x 5 columns
  
  // Get items starting from index 36 (after pages 1 and 2's 18 items each)
  const currentSlice = useMemo(() => {
    const start = 36; // After 2 pages of 18 items
    const slice = gg_status.slice(start, start + ITEM_PER_PAGE_3);
    if (slice.length < ITEM_PER_PAGE_3) {
      return [...slice, ...new Array(ITEM_PER_PAGE_3 - slice.length).fill(undefined)];
    }
    return slice;
  }, [gg_status]);

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
    <div className="pt-4 pb-1 px-8">
      {/* 6 rows x 5 columns grid for page 3 */}
      <div>
        <div className="flex grid grid-cols-5 gap-x-0.1 gap-y-1">
          {renderButtons()}
        </div>
      </div>
    </div>
  );
};

export default GroundGroundPage3;
