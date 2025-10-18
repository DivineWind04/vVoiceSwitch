// components/FreqRow.tsx

import React from 'react';
import FrequencyButton from './FreqButton';
import SquareButton from '../base_button/SquareButton';

type FreqRowProps = {
  entries: Array<{
    frequency: string | number;
    name: string;
    prefMode?: any;
    currMode?: any;
  }>;
};

const FreqRow: React.FC<FreqRowProps> = ({ entries }) => {

  const renderCols = () => {
    const cols: React.JSX.Element[] = [];
    entries.map(entry => {
    cols.push(
      <FrequencyButton frequency={String(entry.frequency)} name={entry.name} squareBtn={true}
               prefMode={entry.prefMode} currMode={entry.currMode}/>)
    })
    // If there are less than 5 frequencies, add empty buttons
    while (cols.length < 5) {
      cols.push(
          <SquareButton/>
      );
    }
    return cols;
  }

  return (
    <div className="flex mb-1 gap-1">
      {renderCols()}
    </div>
  );
};

export default FreqRow;
