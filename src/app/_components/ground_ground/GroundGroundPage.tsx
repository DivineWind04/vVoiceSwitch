// components/GroundGroundPage.tsx
"use client";

import React, { useState } from "react";
import DAButton from "./DAButton";
import SquareSelectorButton from "../base_button/SquareSelectorButton";
import OOSButton from "../base_button/OOSButton";

import FrequencyConfig from "example-config.json";
import Keypad from "./Keypad";

const GroundGroundPage: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1); // State to track current page

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const renderButtons = () => {
    const buttons: React.JSX.Element[] = [];

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
    <div className="p-4">
      {/* // extras left out flex flex-col items-center justify-center */}
      {/* Render 3 pages of buttons */}
      <div className="mb-1 flex grid grid-cols-3 gap-1">
        {currentPage === 3 ? (
          <>
            <Keypad></Keypad>
          </>
        ) : (
          <>{renderButtons()}</>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-1">
        {[1, 2, 3].map((page) => (
          <SquareSelectorButton
            key={page}
            topLine={`G/G ${page}`}
            onClick={() => handlePageChange(page)}
          />
        ))}
      </div>

      {/* Selected page */}
      <div className="items-center justify-center text-center text-sm font-bold text-white">
        G/G PAGE {currentPage}
      </div>
    </div>
  );
};

export default GroundGroundPage;
