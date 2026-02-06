// components/DisplayField.tsx
"use client";

import React from 'react';
import '../vatlines/styles.css';
import { useCoreStore } from '~/model';

type DisplayFieldProps = {
  label: string;
};

const DisplayField: React.FC<DisplayFieldProps> = ({ label }) => {
  // Get the appropriate buffer based on label type
  const iaDisplayBuffer = useCoreStore((s: any) => s.iaDisplayBuffer);
  const callerIdBuffer = useCoreStore((s: any) => s.callerIdBuffer);
  
  // Determine which value to display
  const displayValue = label === 'IA DISPLAY' ? iaDisplayBuffer : 
                       label === 'CALLER ID' ? callerIdBuffer : '';
  
  return (
    <div className="flex items-center space-x-1">
      <div className="w-64 h-3 bg-customBlue flex items-center justify-start px-1">
        <span className="text-customYellow text-xs rdvs-label leading-none">{displayValue}</span>
      </div>
      <span className="text-customYellow text-sm rdvs-label">{label}</span>
    </div>
  );
};

export default DisplayField;
