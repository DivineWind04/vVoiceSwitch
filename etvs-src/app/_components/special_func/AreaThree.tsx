// components/AreaThree.tsx
"use client";

import React, { useState } from "react";
import { useCoreStore } from '~/model';
import SquareSelectorButton from "../base_button/SquareSelectorButton";
import OOSButton from "../base_button/OOSButton";

const AreaThree: React.FC<{ setSettingModal: (v: boolean) => void }> = ({ setSettingModal }) => {
  const [currentPage, setCurrentPage] = useState(1); // State to track current page

  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  const gg_status = useCoreStore((s: any) => s.gg_status);
  // Find the first active G/G call (customize as needed)
  const activeCall = gg_status.find((c: any) => c && c.status && c.status !== 'off' && c.status !== '');

  const relAction = () => {
    if (!activeCall) return;
    if (activeCall.status === 'overridden' || activeCall.status === 'terminate') return;
    const call_id = activeCall.call?.substring(3);
    sendMsg({ type: 'stop', cmd1: call_id, dbl1: 2 });
  };

  const buttons = [
    { topLine: "PHBK", action: () => console.log("PHBK clicked") },
    null,
    null,
    null,
    null,
    null,
    null,
    { topLine: "IA", action: () => console.log("IA clicked") },
    { topLine: "CA", action: () => console.log("CA clicked") },
    {
      topLine: "RECN",
      bottomLine: "ENBL",
      action: () => setSettingModal(true),
    },
    {
      topLine: "CALL",
      bottomLine: "FWD",
      action: () => console.log("CALL FWD clicked"),
    },
    {
      topLine: "FREQ",
      bottomLine: "FWD",
      action: () => console.log("FREQ FWD clicked"),
    },
    {
      topLine: "KEY",
      bottomLine: "PAD",
      action: () => console.log("KEY PAD clicked"),
    },
    { topLine: "REL", action: relAction },
  ];

  return (
    <div className="space-y-1 p-4">
      {/* Render buttons */}
      <div className="grid grid-flow-col grid-cols-2 grid-rows-7 gap-1">
        {buttons.map((button, index) =>
          button == null ? (
            <OOSButton key={index} />
          ) : (
            <SquareSelectorButton
              key={index}
              topLine={button.topLine}
              bottomLine={button.bottomLine}
              onClick={button.action}
            />
          ),
        )}
      </div>

      {/* Status Text - Not Implemented */}
      <div className="mt-4 items-center justify-center text-center text-lg font-bold text-white"></div>
    </div>
  );
};

export default AreaThree;
