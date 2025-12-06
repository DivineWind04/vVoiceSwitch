// NOTE: This wrapper should only be used via the main UI switch in src/app/page.tsx
import React from 'react';

// STVS Wrapper - for now, use VSCS as a placeholder until STVS component is available
import StvsPage from '../app/stvs/page';

export default function STVSWrapper() {
  // Render the real STVS UI
  return (
    <div style={{ background: 'black', color: 'white', padding: '20px' }}>
      <StvsPage />
    </div>
  );
}