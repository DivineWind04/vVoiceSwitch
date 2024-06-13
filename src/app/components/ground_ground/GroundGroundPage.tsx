// components/GroundGroundPage.tsx
'use client'

import React, { useState } from 'react';
import SquareButton from '../base_button/SquareButton';
import SquareSelectorButton from '../base_button/SquareSelectorButton';

const GroundGroundPage: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1); // State to track current page

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const renderButtons = () => {
    const buttonsPerPage = 18; // 3 columns * 6 rows = 18 buttons per page
    const buttons = [];

    for (let i = 0; i < buttonsPerPage; i++) {
      buttons.push(
        <SquareButton
          key={i}
          topLine={`BTN ${i + 1}`}
          onClick={() => console.log(`Button ${i + 1} clicked on page ${currentPage}`)}
        />
      );
    }

    return buttons;
  };

  return (
    <div className="p-4">
      {/* // extras left out flex flex-col items-center justify-center */}
      {/* Render 3 pages of buttons */}
      <div className="grid grid-cols-3 mb-2.5 gap-2.5">
        {renderButtons().slice((currentPage - 1) * 18, currentPage * 18)}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-2.5">
        {[1, 2, 3].map((page) => (
          <SquareSelectorButton
            key={page}
            topLine={`G/G ${page}`}
            onClick={() => handlePageChange(page)}
          />
        ))}
      </div>

      {/* Selected page */}
      <div className="text-white text-center items-center justify-center font-bold text-lg">
        G/G PAGE {currentPage}
      </div>
    </div>
  );
};

export default GroundGroundPage;