// components/AreaThree.tsx
"use client";

import React, { useState, useRef } from "react";
import { useCoreStore } from '~/model';
import SquareSelectorButton from "../base_button/SquareSelectorButton";
import OOSButton from "../base_button/OOSButton";

interface AreaThreeProps {
  setSettingModal: (v: boolean) => void;
  onToggleKeypad?: () => void;
  keypadActive?: boolean;
}

const AreaThree: React.FC<AreaThreeProps> = ({ setSettingModal, onToggleKeypad, keypadActive }) => {
  const [currentPage, setCurrentPage] = useState(1); // State to track current page
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  const gg_status = useCoreStore((s: any) => s.gg_status);
  const selectedChime = useCoreStore((s: any) => s.selectedChime);
  const cycleChime = useCoreStore((s: any) => s.cycleChime);

  // Handle chime type button - cycle and play sample
  const handleChimeType = () => {
    cycleChime();
    const nextChime = selectedChime >= 13 ? 1 : selectedChime + 1;
    const paddedNum = nextChime.toString().padStart(2, '0');
    const chimeFile = `/ivsr/IVSRChime-${paddedNum}.wav`;
    
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    // Play the new chime
    audioRef.current = new Audio(chimeFile);
    audioRef.current.play().catch(err => console.log('Could not play chime:', err));
  };

  const relAction = () => {
    // Release ALL active G/G calls
    const activeCalls = (gg_status || []).filter((call: any) => 
      call && (call.status === 'ok' || call.status === 'active')
    );
    
    console.log('[REL] Releasing', activeCalls.length, 'active calls');
    
    activeCalls.forEach((call: any) => {
      // Extract call ID - handle different formats (SO_, gg_, etc.)
      let call_id;
      const fullCall = call.call;
      const lineType = call.lineType ?? 2; // Use line type from data, default to 2 (regular)
      
      if (fullCall?.startsWith('SO_')) {
        // Shout/Override format: "SO_891" -> "891"
        call_id = fullCall.substring(3);
      } else if (fullCall?.startsWith('gg_')) {
        // Ground-Ground format: "gg_05_123" -> extract the ID part
        call_id = fullCall.substring(3);
      } else {
        // Fallback - use substring(3) for standard 3-char prefix
        call_id = fullCall?.substring(3) || '';
      }
      
      if (call_id) {
        const isShoutOverride = fullCall?.startsWith('SO_');
        const dbl1 = isShoutOverride ? 1 : lineType;
        console.log('[REL] Stopping call:', call_id, 'isShoutOverride:', isShoutOverride, 'dbl1:', dbl1);
        sendMsg({ type: 'stop', cmd1: call_id, dbl1 });
      }
    });
  };

  const buttons = [
    { topLine: "PHBK", action: () => console.log("PHBK clicked") },
    { topLine: "CHME", bottomLine: "TYPE", action: handleChimeType },
    null,
    null,
    null,
    null,
    null,
    { topLine: "IA", action: onToggleKeypad, isActive: keypadActive },
    { topLine: "CA", action: () => console.log("CA clicked") },
    {
      topLine: "RECN",
      bottomLine: "ENB",
      action: () => setSettingModal(true),
    },
    {
      topLine: "CALL",
      bottomLine: "FWD",
      action: () => console.log("CALL FWD clicked"),
    },
    {
      topLine: "FREQ",
      bottomLine: "FWD",
      action: () => console.log("FREQ FWD clicked"),
    },
    {
      topLine: "KEY",
      bottomLine: "PAD",
      action: onToggleKeypad,
      isActive: keypadActive,
    },
    { topLine: "REL", action: relAction },
  ];

  return (
    <div className="space-y-1 p-4">
      {/* Render buttons */}
      <div className="grid grid-flow-col grid-cols-2 grid-rows-7 gap-1">
        {buttons.map((button, index) =>
          button == null ? (
            <OOSButton key={index} />
          ) : (
            <SquareSelectorButton
              key={index}
              topLine={button.topLine}
              bottomLine={button.bottomLine}
              onClick={button.action}
              isActive={button.isActive}
            />
          ),
        )}
      </div>

      {/* Status Text - Not Implemented */}
      <div className="mt-4 items-center justify-center text-center text-lg font-bold text-white"></div>
    </div>
  );
};

export default AreaThree;
