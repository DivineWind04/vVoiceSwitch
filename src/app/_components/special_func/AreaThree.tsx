// components/AreaThree.tsx
"use client";

import React, { useState } from "react";
import SquareSelectorButton from "../base_button/SquareSelectorButton";
import OOSButton from "../base_button/OOSButton";

const AreaThree: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1); // State to track current page

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
      action: () => console.log("RECN ENB clicked"),
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
    { topLine: "REL", action: () => console.log("REL clicked") },
  ];

  return (
    <div className="space-y-1 p-2">
      {/* Render buttons */}
      <div className="grid grid-flow-col grid-cols-2 grid-rows-7 gap-[3px]">
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
      <div className="mt-4 items-center justify-center text-center text-[14px] font-bold text-white"></div>
    </div>
  );
};

export default AreaThree;
