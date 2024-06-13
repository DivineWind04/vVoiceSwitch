// components/DisplayField.tsx

import React from 'react';

type DisplayFieldProps = {
  label: string;
};

const DisplayField: React.FC<DisplayFieldProps> = ({ label }) => {
  return (
    <div className="flex items-center space-x-1">
      <div className="w-64 h-4 bg-customBlue">
        {/* Empty Box */}
      </div>
      <span className="text-customYellow font-bold">{label}</span>
    </div>
  );
};

export default DisplayField;
