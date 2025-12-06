// components/StatusArea.tsx

import React from 'react';

// Define the prop types for the component
type StatusAreaProps = {
  position: string;
  warnings?: string;
  errors?: string;
};

const StatusArea: React.FC<StatusAreaProps> = ({ position, warnings, errors }) => {
  return (
    <div className="flex justify-start items-center p-2 text-customYellow -mt-4 ml-8">
      {/* Display Position */}
      <span className="text-customYellow font-bold">
        {position}
      </span>
      
      {/* Conditionally display Warnings if provided */}
      {warnings && (
        <span className="text-customYellow font-bold">
          {warnings}
        </span>
      )}
      
      {/* Conditionally display Errors if provided */}
      {errors && (
        <span className="text-customRed font-bold">
          {errors}
        </span>
      )}
    </div>
  );
};

export default StatusArea;
