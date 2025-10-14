import React from 'react';

// IVSR Wrapper - for now, use VSCS as a placeholder until IVSR component is available
import VSCSPanel from '../panel';

export default function IVSRWrapper() {
  // TODO: Replace with actual IVSR component when available
  return (
    <div style={{ background: 'black', color: 'white', padding: '20px' }}>
      <h2>IVSR Interface (Using VSCS Placeholder)</h2>
      <VSCSPanel />
    </div>
  );
}