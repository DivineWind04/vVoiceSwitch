import "../../styles/globals.css";
import "../_components/vatlines/styles.css";
import { GeistSans } from 'geist/font/sans';
import React from 'react';

export default function StvsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${GeistSans.variable} font-ivsr tracking-widest`}>
      {children}
    </div>
  );
}
