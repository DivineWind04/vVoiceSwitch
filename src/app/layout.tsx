import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";

export const metadata = {
  title: "vETVS",
  description: "Virtual Enhanced Terminal Voice Switch System",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} font-ivsr tracking-widest`}>
      <body>
        {children}
      </body>
    </html>
  );
}
