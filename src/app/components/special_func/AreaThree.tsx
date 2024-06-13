// components/AreaThree.tsx
'use client'

import React, { useState } from 'react';
import SquareButton from '../base_button/SquareButton';

const AreaThree: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1); // State to track current page

  const renderButtons = () => {
    const buttonsPerPage = 14; // 2 columns * 7 rows = 14 buttons
    const buttons = [];

    for (let i = 0; i < buttonsPerPage; i++) {
      buttons.push(
        <SquareButton
          key={i}
          topLine={`SPE ${i + 1}`}
          onClick={() => console.log(`Special Button ${i + 1} clicked`)}
        />
      );
    }

    return buttons;
  };

  return (
    <div className="p-4 space-y-2.5">
      {/* Render buttons */}
      <div className="grid grid-cols-2 mb-2.5 gap-2.5">
        {renderButtons()}
      </div>

      {/* Status Text - Not Implemented */}
      <div className="text-white text-center items-center justify-center font-bold text-lg mt-4">
        
      </div>
    </div>
  );
};

export default AreaThree;