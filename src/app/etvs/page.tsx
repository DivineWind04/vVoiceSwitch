"use client";

import React from 'react';
// Mount the preserved etvs-src app inside the main app without modifying etvs-src files
import EtvsPanel from '../../../etvs-src/app/page';
import { GeistSans } from 'geist/font/sans';

export default function EtvsRoute() {
  return (
    <div className={`${GeistSans.variable} font-ivsr tracking-widest`}>
      <EtvsPanel />
    </div>
  );
}
