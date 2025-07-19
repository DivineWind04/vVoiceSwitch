// components/DisplayField.tsx

import React from 'react';

type DisplayFieldProps = {
  label: string;
};

const DisplayField: React.FC<DisplayFieldProps> = ({ label }) => {
  return (
    <div className="flex items-center space-x-1">
      <div className="w-60 h-4 bg-customBlue">
        {/* Empty Box */}
      </div>
      <span className="text-yellow-300 font-bold text-[14px]">{label}</span>
    </div>
  );
};

export default DisplayField;