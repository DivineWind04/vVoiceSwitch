import React from 'react';

// STVS Wrapper - for now, use VSCS as a placeholder until STVS component is available
import VSCSPanel from '../panel';

export default function STVSWrapper() {
  // TODO: Replace with actual STVS component when available
  return (
    <div style={{ background: 'black', color: 'white', padding: '20px' }}>
      <h2>STVS Interface (Using VSCS Placeholder)</h2>
      <VSCSPanel />
    </div>
  );
}