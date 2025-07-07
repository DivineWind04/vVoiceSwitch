// components/DisplayField.tsx

import React from 'react';

type DisplayFieldProps = {
  label: string;
};

const DisplayField: React.FC<DisplayFieldProps> = ({ label }) => {
  return (
    <div className="flex items-center space-x-1">
      <div className="w-64 h-3 bg-customBlue">
        {/* Empty Box */}
      </div>
      <span className="text-customYellow font-bold text-sm">{label}</span>
    </div>
  );
};

export default DisplayField;
