// ...existing code...
import React, { useRef, useState, useCallback } from "react";
// Knob component: scroll to rotate, animated with min/max detents
const Knob: React.FC<{
  src: string;
  alt: string;
  style: React.CSSProperties;
  minAngle?: number;
  maxAngle?: number;
  onChange?: (angle: number) => void;
}> = ({ src, alt, style, minAngle = -135, maxAngle = 135, onChange }) => {
  const [angle, setAngle] = useState(0);
  const animRef = useRef<number | null>(null);
  const targetAngle = useRef(0);

  // Animate rotation
  const animate = () => {
    setAngle((prev) => {
      const diff = targetAngle.current - prev;
      if (Math.abs(diff) < 0.5) {
        const finalAngle = targetAngle.current;
        onChange?.(finalAngle);
        return finalAngle;
      }
      return prev + diff * 0.2;
    });
    if (Math.abs(targetAngle.current - angle) > 0.5) {
      animRef.current = requestAnimationFrame(animate);
    } else {
      animRef.current = null;
    }
  };

  // Handle scroll with min/max constraints
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const increment = e.deltaY > 0 ? -10 : 10; // Reversed: scroll down = decrease, scroll up = increase
    const newAngle = targetAngle.current + increment;
    
    // Constrain to min/max angles
    targetAngle.current = Math.max(minAngle, Math.min(maxAngle, newAngle));
    
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
import StvsKeypad from "./StvsKeypad";
import StvsLever from "./StvsSwitch";
import { useCoreStore } from "~/model";
import { shallow } from "zustand/shallow";
import SettingModal from "../components/SettingModal";
// ...existing code...


const StvsBase: React.FC = () => {
  const [mounted, setMounted] = React.useState(false);
  const [settingModal, setSettingModal] = React.useState(false);
  const [brightness, setBrightness] = React.useState(1.0); // Range 0.0 to 1.0
  
  const freqSelector = useCallback((s: any) => s.ag_status || [], []);
  const ggSelector = useCallback((s: any) => s.gg_status || [], []);
  const pttSelector = useCallback((s: any) => s.ptt || false, []);
  const freqData = useCoreStore(freqSelector);
  const ggData = useCoreStore(ggSelector);
  const pttActive = useCoreStore(pttSelector);
  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  
  // Convert ILLUM knob angle (-135 to +135) to brightness (0.1 to 1.0)
  const handleIllumChange = useCallback((angle: number) => {
    // Map angle range (-135 to +135) to brightness range (0.1 to 1.0)
    const normalizedAngle = (angle + 135) / 270; // 0 to 1
    const brightness = 0.1 + (normalizedAngle * 0.9); // 0.1 to 1.0
    setBrightness(brightness);
  }, []);
  
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
    <div className="w-full h-full flex flex-col items-center justify-center bg-black" style={{
      zoom: 1,
      transform: 'scale(1)',
      transformOrigin: 'top left'
    }}>
      <SettingModal open={settingModal} setModal={setSettingModal} />
      {/* Responsive SVG container with aspect ratio matching viewBox 899.16x164.4 */}
      <div
        className="relative w-full max-w-full"
        style={{ 
          aspectRatio: '899.16/164.4', 
          width: '100%',
          zoom: 1,
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }}
      >
        {/* SVG base */}
        <img src="/stvs.svg" alt="STVS Panel" className="w-full h-full object-contain" />
        {/* Transparent clickspot over DENRO logo (approximate position/size, adjust as needed) */}
        <button
          aria-label="Open Settings"
          onClick={() => setSettingModal(true)}
          style={{
            position: 'absolute',
            left: '2.5%', // Adjust as needed to match DENRO position
            top: '2%',   // Adjust as needed to match DENRO position
            width: '17%', // Adjust width to cover DENRO
            height: '22%', // Adjust height to cover DENRO
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            zIndex: 30,
          }}
        />

        {/* Knobs positioned and scaled relative to SVG viewBox (899.16x164.4) */}
        {/* Example: 170px left, 320px top in SVG -> left: 18.9%, top: 194.6% (but top must be within 0-100%)
            So, use: percent = (value / viewBox dimension) * 100 */}
        {/* Trainee Knob: left 170, top 120, width 96, height 96 (example) */}
        <Knob
          src="/knob.png"
          alt="Trainee Knob"
          minAngle={-135}
          maxAngle={135}
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
          minAngle={-135}
          maxAngle={135}
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
          minAngle={-135}
          maxAngle={135}
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
          minAngle={-135}
          maxAngle={135}
          onChange={handleIllumChange}
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
          minAngle={-135}
          maxAngle={135}
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
          const ggItem = ggData[idx]; // Get the corresponding G/G data item
          
          // Handle placeholder entries from [] in config - render empty button
          if (ggItem?.isPlaceholder) {
            return (
              <StvsButton
                key={"gg-placeholder-"+idx}
                label=""
                brightness={brightness}
                style={{
                  left: `${(895 + col*60)/899.16*59}%`,
                  top: `${(20 + row*38)/164.4*90}%`,
                  width: `${(40/899.16)*75}%`,
                  height: `${(40/164.4)*75}%`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  zIndex: 15,
                }}
              />
            );
          }
          
          // Implement click logic matching IVSR/ETVS behavior
          let onClick: (() => void) | undefined = undefined;
          
          if (ggItem && ggItem.call) {
            const call_type = ggItem.call?.substring(0, 2);
            const call_id = ggItem.call?.substring(3);
            const lineType = ggItem.lineType ?? 2; // Use line type from data, default to 2 (regular)
            
            if (call_type === 'SO') {
              // Special Operator calls
              if (ggItem.status === 'idle') {
                onClick = () => sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 });
              } else if (ggItem.status === 'online' || ggItem.status === 'chime') {
                onClick = () => sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 }); // Answer/Join
              } else if (ggItem.status === 'ok') {
                onClick = () => sendMsg({ type: 'stop', cmd1: call_id, dbl1: 1 }); // Hangup SO
              } else if (ggItem.status === 'overridden' || ggItem.status === 'terminate') {
                onClick = undefined; // No action available
              }
            } else {
              // Direct Line calls (DL_xxx) and others
              if (ggItem.status === 'off' || ggItem.status === '' || ggItem.status === 'idle') {
                onClick = () => sendMsg({ type: 'call', cmd1: call_id, dbl1: lineType }); // Initiate call
              } else if (ggItem.status === 'busy' || ggItem.status === 'hold') {
                onClick = undefined; // No action available
              } else if (ggItem.status === 'pending' || ggItem.status === 'terminate' || ggItem.status === 'overridden') {
                onClick = undefined; // No action available
              } else if (ggItem.status === 'ok' || ggItem.status === 'active' || ggItem.status === 'chime' || ggItem.status === 'ringing') {
                onClick = () => sendMsg({ type: 'stop', cmd1: call_id, dbl1: lineType }); // Hangup DL
              }
            }
          }
          
          return (
            <StvsButton
              key={"gg-"+idx}
              label={gg}
              callStatus={ggItem?.status}
              pttActive={pttActive}
              brightness={brightness}
              onClick={onClick}
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
        
        {Array.from({ length: 6 }, (_, i) => (
          <StvsLever
            key={"lever-"+i}
            defaultPosition={0.5}
            brightness={brightness}
            onPositionChange={(position) => console.log(`Lever ${i+1} set to: ${position.toFixed(2)}`)}
            style={{
              left: `${(515 + i*59)/899.16*60}%`,
              top: `${(25/164.4)*90}%`,
              width: `${(40/899.16)*55}%`,
              height: `${(40/164.4)*55}%`,
              maxWidth: 'none',
              maxHeight: 'none',
            }}
          />
        ))}
        
        {freqButtons.map((freq, i) => (
          <StvsButton
            key={"freq-"+i}
            label={freq}
            hasFreq={!!freq}
            pttActive={pttActive && !!freq}
            brightness={brightness}
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
        {/* XMIT buttons, linked to freqButtons[i] */}
        {Array.from({ length: 6 }, (_, i) => (
          <StvsButton
            key={"xmit-"+i}
            label="XMIT"
            hasFreq={!!freqButtons[i]}
            brightness={brightness}
            style={{
              left: `${(423 + i*49)/899.16*72}%`,
              top: `${(60/164.4)*145}%`,
              width: `${(40/899.16)*75}%`,
              height: `${(40/164.4)*75}%`,
              maxWidth: 'none',
              maxHeight: 'none',
              zIndex: 15,
            }}
          />
        ))}
        {/* RCV buttons, linked to freqButtons[i] */}
        {Array.from({ length: 6 }, (_, i) => (
          <StvsButton
            key={"rcv-"+i}
            label="RCV"
            hasFreq={!!freqButtons[i]}
            brightness={brightness}
            style={{
              left: `${(423 + i*49)/899.16*72}%`,
              top: `${(60/164.4)*205}%`,
              width: `${(40/899.16)*75}%`,
              height: `${(40/164.4)*75}%`,
              maxWidth: 'none',
              maxHeight: 'none',
              zIndex: 15,
            }}
          />
        ))}
        <StvsButton
          label="RING"
          active
          brightness={brightness}
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
          brightness={brightness}
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
          brightness={brightness}
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
          brightness={brightness}
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
          brightness={brightness}
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
          brightness={brightness}
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
          brightness={brightness}
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
          brightness={brightness}
          onClick={() => setSettingModal(true)}
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
        
        {/* STVS Keypad positioned manually like other buttons */}
        <div 
          className="absolute z-50"
          style={{
            left: `${(700/899.16)*94}%`,  
            top: `${(20/164.4)*75}%`,     
            width: `${(180/899.16)*100}%`, 
            height: `${(140/164.4)*100}%`, 
            transform: 'scale(1.5)',       
            transformOrigin: 'top left'
          }}
        >
          <StvsKeypad brightness={brightness} />
        </div>
      </div>
    </div>
  );
};

export default StvsBase;
