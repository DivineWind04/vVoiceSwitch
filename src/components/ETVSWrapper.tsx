// NOTE: This wrapper should only be used via the main UI switch in src/app/page.tsx
import React from 'react';

// ETVS Page wrapper - imports from etvs-src
import ETVSPage from '../../etvs-src/app/page';

export default function ETVSWrapper() {
  return <ETVSPage />;
}