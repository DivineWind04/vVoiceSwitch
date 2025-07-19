// components/GroundGroundPage.tsx
"use client";

import React, { useState } from "react";
import DAButton from "./DAButton";
import ChiseledSelectorButton from "../base_button/ChiseledSelectorButton";
import OOSButton from "../base_button/OOSButton";

import FrequencyConfig from "example-config.json";
import Keypad from "./Keypad";

type GroundGroundPageProps = {
  onGG3Toggle: (isActive: boolean, page: number) => void;
};

const GroundGroundPage: React.FC<GroundGroundPageProps> = ({ onGG3Toggle }) => {
  const [currentPage, setCurrentPage] = useState(1); // State to track current page
  const [previousPage, setPreviousPage] = useState(1); // State to track previous page before G/G 3

  const handlePageChange = (page: number) => {
    if (page !== 3) {
      setPreviousPage(page); // Store the previous page when not selecting G/G 3
    }
    setCurrentPage(page);
    onGG3Toggle(page === 3, page); // Notify parent when G/G 3 is active and pass current page
  };

  const renderButtons = () => {
    const buttons: React.JSX.Element[] = [];

    // Normal page rendering for all pages now (moved 5x6 grid to AirGroundPage)
    // Select the correct array from GGLines based on currentPage
    const currentLines = FrequencyConfig.GGLines[currentPage - 1];

    // Map over the currentLines array to get the buttons
    if (currentLines)
      currentLines.map((line, index) => {
        // Check if this is an out of service entry
        if (line == null) {
          buttons.push(<OOSButton key={index} />);
        } else {
          buttons.push(
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
            />,
          );
        }
      });

    return buttons;
  };

  return (
    <div className="p-2">
      {/* // extras left out flex flex-col items-center justify-center */}
      {/* Render buttons */}
      <div className="mb-[3px] flex grid grid-cols-3 gap-[3px]">
        {renderButtons()}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-1">
        {[1, 2, 3].map((page) => (
          <ChiseledSelectorButton
            key={page}
            topLine={`G/G ${page}`}
            onClick={() => handlePageChange(page)}
          />
        ))}
      </div>

      {/* Selected page */}
      <div className="items-center justify-center text-center text-[16px] font text-yellow-300">
        G/G PAGE {currentPage === 3 ? previousPage : currentPage}
      </div>
    </div>
  );
};

export default GroundGroundPage;
