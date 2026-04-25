import { GeistSans } from 'geist/font/sans';

export default function EtvsLayout({ children }: { children: React.ReactNode }) {
  // Section layout: do not render <html> or <body>
  return (
    <div className="font-ivsr tracking-widest">
      {children}
    </div>
  );
}
