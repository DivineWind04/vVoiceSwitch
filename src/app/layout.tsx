import "~/styles/globals.css";
import "../../etvs-src/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import Script from "next/script";

export const metadata = {
  title: "vIVSR",
  description: "Virtual Interm Voice Switch System",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body>
        {process.env.NODE_ENV === 'development' && (
          <Script id="devlog-forwarder" strategy="afterInteractive">{`
(function(){
  const orig={log:console.log,warn:console.warn,error:console.error};
  const buf=[];let timer=null;
  function flush(){
    if(!buf.length) return;
    const logs=[...buf]; buf.length=0;
    fetch('/api/devlog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({logs})}).catch(()=>{});
  }
  function capture(level,...args){
    const msg=args.map(a=>{try{return typeof a==='object'?JSON.stringify(a):String(a);}catch{return String(a);}}).join(' ');
    buf.push('['+level+'] '+msg);
    if(!timer){timer=setTimeout(()=>{timer=null;flush();},200);}
  }
  console.log=function(...a){orig.log(...a);capture('log',...a);};
  console.warn=function(...a){orig.warn(...a);capture('warn',...a);};
  console.error=function(...a){orig.error(...a);capture('error',...a);};
})();
          `}</Script>
        )}
        {children}
      </body>
    </html>
  );
}
