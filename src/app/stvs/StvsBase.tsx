// ...existing code...
import React, { useRef, useState, useCallback } from "react";
// Knob component: scroll to rotate, animated
const Knob: React.FC<{
  src: string;
  alt: string;
  style: React.CSSProperties;
}> = ({ src, alt, style }) => {
  const [angle, setAngle] = useState(0);
  const animRef = useRef<number | null>(null);
  const targetAngle = useRef(0);

  // Animate rotation
  const animate = () => {
    setAngle((prev) => {
      const diff = targetAngle.current - prev;
      if (Math.abs(diff) < 0.5) return targetAngle.current;
      return prev + diff * 0.2;
    });
    if (Math.abs(targetAngle.current - angle) > 0.5) {
      animRef.current = requestAnimationFrame(animate);
    } else {
      animRef.current = null;
    }
  };

  // Handle scroll
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    targetAngle.current += e.deltaY > 0 ? 10 : -10;
    if (!animRef.current) {
      animRef.current = requestAnimationFrame(animate);
    }
  };

  return (
    <img
      src={src}
      alt={alt}
      className="absolute z-20 cursor-pointer select-none"
      style={{
        ...style,
        transform: `rotate(${angle}deg)`,
        transition: 'box-shadow 0.2s',
      }}
      onWheel={onWheel}
      draggable={false}
    />
  );
};
import StvsButton from "./StvsButton";
import { useCoreStore } from "~/model";
import { shallow } from "zustand/shallow";
// ...existing code...


const StvsBase: React.FC = () => {
  const [mounted, setMounted] = React.useState(false);
  const freqSelector = useCallback((s: any) => s.ag_status || [], []);
  const ggSelector = useCallback((s: any) => s.gg_status || [], []);
  const freqData = useCoreStore(freqSelector);
  const ggData = useCoreStore(ggSelector);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  // Always 6 frequency buttons, formatted to up to 3 decimals
  const formatFreq = (freq: number) => {
    if (!freq) return "";
    const val = freq / 1_000_000;
    if (val % 1 === 0) return val.toFixed(1); // whole number, show .0
    return val.toString().replace(/0+$/, '').replace(/\.$/, '');
  };
  const freqButtons = Array.from({ length: 6 }, (_, i) => {
    const f = freqData[i];
    if (!f) return "";
    if (f.name) return f.name;
    if (f.freq) return formatFreq(f.freq);
    return "";
  });
  // Always 12 G/G buttons (4x3 grid)
  const ggButtons = Array.from({ length: 12 }, (_, i) => ggData[i]?.call_name || ggData[i]?.call);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black">
      {/* Responsive SVG container with aspect ratio matching viewBox 899.16x164.4 */}
      <div
        className="relative w-full max-w-full"
        style={{ aspectRatio: '899.16/164.4', width: '100%' }}
      >
        {/* SVG base */}
        <img src="/stvs.svg" alt="STVS Panel" className="w-full h-full object-contain" />

        {/* Knobs positioned and scaled relative to SVG viewBox (899.16x164.4) */}
        {/* Example: 170px left, 320px top in SVG -> left: 18.9%, top: 194.6% (but top must be within 0-100%)
            So, use: percent = (value / viewBox dimension) * 100 */}
        {/* Trainee Knob: left 170, top 120, width 96, height 96 (example) */}
        <Knob
          src="/knob.png"
          alt="Trainee Knob"
          style={{
            left: `${(170/899.16)*33}%`,
            top: `${(120/164.4)*56}%`,
            width: `${(96/899.16)*40}%`,
            height: `${(96/164.4)*40}%`,
            maxWidth: 'none',
            maxHeight: 'none',
          }}
        />
        {/* Instructor Knob: left 600, top 120, width 96, height 96 (example) */}
        <Knob
          src="/knob.png"
          alt="Instructor Knob"
          style={{
            left: `${(170/899.16)*33}%`,
            top: `${(120/164.4)*100}%`,
            width: `${(96/899.16)*40}%`,
            height: `${(96/164.4)*40}%`,
            maxWidth: 'none',
            maxHeight: 'none',
          }}
        />
        {/* Three knob2.png images for user adjustment (example positions) */}
        <Knob
          src="/knob2.png"
          alt="SPKR"
          style={{
            left: `${(350/899.16)*70}%`,
            top: `${(40/164.4)*35}%`,
            width: `${(96/899.16)*40}%`,
            height: `${(96/164.4)*40}%`,
            maxWidth: 'none',
            maxHeight: 'none',
          }}
        />
        <Knob
          src="/knob2.png"
          alt="ILLUM"
          style={{
            left: `${(350/899.16)*70}%`,
            top: `${(40/164.4)*165}%`,
            width: `${(96/899.16)*40}%`,
            height: `${(96/164.4)*40}%`,
            maxWidth: 'none',
            maxHeight: 'none',
          }}
        />
        <Knob
          src="/knob2.png"
          alt="CHIME"
          style={{
            left: `${(350/899.16)*70}%`,
            top: `${(40/164.4)*300}%`,
            width: `${(96/899.16)*40}%`,
            height: `${(96/164.4)*40}%`,
            maxWidth: 'none',
            maxHeight: 'none',
          }}
        />

        {/* 4x3 grid of G/G buttons above frequency buttons */}
        {ggButtons.map((gg, idx) => {
          const row = Math.floor(idx / 3);
          const col = idx % 3;
          return (
            <StvsButton
              key={"gg-"+idx}
              label={gg}
              style={{
                left: `${(895 + col*60)/899.16*59}%`,
                top: `${(20 + row*38)/164.4*90}%`,
                width: `${(40/899.16)*75}%`,
                height: `${(40/164.4)*75}%`,
                maxWidth: 'none',
                maxHeight: 'none',
                zIndex: 15,
                pointerEvents: gg ? 'auto' : 'none',
              }}
            />
          );
        })}
        {/* Row of up to 6 frequency buttons above XMIT buttons */}
        {freqButtons.map((freq, i) => (
          <StvsButton
            key={"freq-"+i}
            label={freq}
            style={{
              left: `${(515 + i*60)/899.16*59}%`,
              top: `${(52/164.4)*100}%`,
              width: `${(40/899.16)*75}%`,
              height: `${(40/164.4)*75}%`,
              maxWidth: 'none',
              maxHeight: 'none',
              zIndex: 15,
              pointerEvents: freq ? 'auto' : 'none',
            }}
          />
        ))}
        <StvsButton
          label="XMIT"
          style={{
            left: `${(423/899.16)*72}%`,
            top: `${(60/164.4)*145}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="XMIT"
          active
          style={{
            left: `${(425/899.16)*80}%`,
            top: `${(60/164.4)*145}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />   
        <StvsButton
          label="XMIT"
          style={{
            left: `${(422/899.16)*89}%`,
            top: `${(60/164.4)*145}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="XMIT"
          active
          style={{
            left: `${(426/899.16)*96}%`,
            top: `${(60/164.4)*145}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />   
        <StvsButton
          label="XMIT"
          active
          style={{
            left: `${(427/899.16)*96}%`,
            top: `${(60/164.4)*145}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        /> 
        <StvsButton
          label="XMIT"
          active
          style={{
            left: `${(445/899.16)*100}%`,
            top: `${(60/164.4)*145}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="XMIT"
          active
          style={{
            left: `${(481/899.16)*100}%`,
            top: `${(60/164.4)*145}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />        
        <StvsButton
          label="RCV"
          style={{
            left: `${(423/899.16)*72}%`,
            top: `${(60/164.4)*205}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="RCV"
          active
          style={{
            left: `${(723/899.16)*47}%`,
            top: `${(60/164.4)*205}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="RCV"
          active
          style={{
            left: `${(723/899.16)*52}%`,
            top: `${(60/164.4)*205}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="RCV"
          active
          style={{
            left: `${(721/899.16)*57}%`,
            top: `${(60/164.4)*205}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="RCV"
          active
          style={{
            left: `${(720/899.16)*62}%`,
            top: `${(60/164.4)*205}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="RCV"
          active
          style={{
            left: `${(718/899.16)*67}%`,
            top: `${(60/164.4)*205}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="RCV"
          active
          style={{
            left: `${(718/899.16)*67}%`,
            top: `${(60/164.4)*205}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="RING"
          active
          style={{
            left: `${(718/899.16)*90}%`,
            top: `${(60/164.4)*28}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="IA"
          active
          style={{
            left: `${(718/899.16)*95}%`,
            top: `${(60/164.4)*28}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="BRF"
          active
          style={{
            left: `${(718/899.16)*90}%`,
            top: `${(60/164.4)*88}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="CA"
          active
          style={{
            left: `${(718/899.16)*95}%`,
            top: `${(60/164.4)*88}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="HOLD"
          active
          style={{
            left: `${(718/899.16)*90}%`,
            top: `${(88/164.4)*100}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="REL"
          active
          style={{
            left: `${(718/899.16)*95}%`,
            top: `${(88/164.4)*100}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="HL"
          active
          style={{
            left: `${(718/899.16)*90}%`,
            top: `${(122/164.4)*100}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />
        <StvsButton
          label="CONF"
          active
          style={{
            left: `${(718/899.16)*95}%`,
            top: `${(122/164.4)*100}%`,
            width: `${(40/899.16)*75}%`,
            height: `${(40/164.4)*75}%`,
            maxWidth: 'none',
            maxHeight: 'none',
            zIndex: 15,
          }}
        />                                                                                                        
      </div>
    </div>
  );
};

export default StvsBase;
