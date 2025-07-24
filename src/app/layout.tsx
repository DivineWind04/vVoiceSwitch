import "~/styles/globals.css";
import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { TRPCReactProvider } from "~/trpc/react";
import { WebSocketProvider } from "~/contexts/WebSocketContext";

export const metadata: Metadata = {
  title: "vIVSR",
  description: "Virtual IVSR Interface",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body>
        <TRPCReactProvider>
          <WebSocketProvider>
            {children}
          </WebSocketProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}