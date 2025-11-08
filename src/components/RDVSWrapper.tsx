  // Type guard for StandardButtonProps
  function isStandardButton(btn: RdvsButtonComponentProps): btn is StandardButtonProps {
    return btn && typeof (btn as any).config === 'object' && typeof (btn as any).callback === 'function';
  }
// NOTE: This wrapper should only be used via the main UI switch in src/app/page.tsx
import React, { useEffect, useState } from 'react';
import { ButtonType } from '../app/_components/vatlines/types';
import type { RdvsButtonComponentProps, StandardButtonProps } from '../app/_components/vatlines/rdvs_button';
import { useCoreStore } from '../model';
import RdvsButtonComponent from '../app/_components/vatlines/rdvs_button'; // Import the RdvsButtonComponent
import { rdvsButtonPatterns } from './rdvsButtonPatterns';

// RDVS Wrapper - placeholder for now due to complex prop requirements

export default function RDVSWrapper() {
  // State for selected radio button (for showing long radio button overlay)
  const [selectedRadioIndex, setSelectedRadioIndex] = useState<number | null>(null);
  
  // Get sendMsg from store for WebSocket messaging
  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  
  // Function to get button pattern based on line type
  const getButtonPattern = (lineType: number) => {
    console.log('Getting pattern for line type:', lineType);
    switch (lineType) {
      case 0: 
        console.log('Using OVERRIDE pattern');
        return rdvsButtonPatterns.OVERRIDE;
      case 1: 
        console.log('Using RING pattern');
        return rdvsButtonPatterns.RING;
      case 2: 
        console.log('Using SHOUT pattern');
        return rdvsButtonPatterns.SHOUT;
      default: 
        console.log('Using DEFAULT pattern');
        return rdvsButtonPatterns.DEFAULT;
    }
  };

  // Use positionData to hydrate buttons for ground-to-ground
  const setPositionData = useCoreStore((s: any) => s.setPositionData);
  const positionData = useCoreStore((s: any) => s.positionData);
  const selectedPositions = useCoreStore((s: any) => s.selectedPositions);
  // Map ground-to-ground buttons and cyan box buttons from positionData.positions and their lines
  const gg_status = useCoreStore((s: any) => s.gg_status);
  const ag_status = useCoreStore((s: any) => s.ag_status);
  const ptt = useCoreStore((s: any) => s.ptt); // Get PTT status from WebSocket
  
  // Use the currently selected position for ground-to-ground rendering (like VSCS)
  const buttons: RdvsButtonComponentProps[] = [];
  let currentPosition = null;
  
  // Use selectedPositions[0] to get the current position (matches VSCS logic)
  if (selectedPositions && selectedPositions.length > 0) {
    currentPosition = selectedPositions[0];
  }
  
  console.log('RDVS currentPosition:', currentPosition);
  console.log('RDVS gg_status:', gg_status);
  
  if (currentPosition && Array.isArray(currentPosition.lines)) {
    console.log('RDVS processing lines:', currentPosition.lines.length);
    currentPosition.lines.forEach((line: any, lineIdx: number) => {
      // Line structure: [id, type, label]
      const lineType = Array.isArray(line) ? line[1] : line.type;
      
      // Get button pattern based on line type
      const pattern = getButtonPattern(lineType);
      console.log(`RDVS Line ${lineIdx}: type=${lineType}, pattern=`, pattern);
      
      // Cyan box button logic - status-based behavior per DA Pushbutton Status table
      let typeLetter = '';
      if (lineType === 0) typeLetter = 'O';  // Override
      else if (lineType === 1) typeLetter = 'C';  // Ring
      else if (lineType === 2) typeLetter = 'A';  // Shout
      
      // Get status for line type indicator behavior from gg_status
      let statusObj = (typeof gg_status?.[lineIdx] === 'object' && gg_status?.[lineIdx] !== null) ? gg_status[lineIdx] : {};
      let indicatorState = 'off';
      
      // Map call status to indicator animations based on DA Pushbutton Status table
      const callStatus = statusObj.status || 'off';
      console.log(`RDVS Line ${lineIdx}: status=${callStatus}, lineType=${lineType}`);
      
      if (lineType === 0) {
        // Override line behavior
        if (callStatus === 'off' || callStatus === '' || callStatus === 'idle') {
          indicatorState = 'off'; // Circuit idle
        } else if (callStatus === 'ok' || callStatus === 'active') {
          indicatorState = 'on'; // Connection made (steady-on)
        } else if (callStatus === 'busy' || callStatus === 'overridden') {
          indicatorState = 'flutter'; // Circuit busy/overridden
        }
      } else if (lineType === 1) {
        // Ring line behavior  
        if (callStatus === 'off' || callStatus === '' || callStatus === 'idle') {
          indicatorState = 'off'; // Circuit idle
        } else if (callStatus === 'chime' || callStatus === 'ringing') {
          indicatorState = 'flashing'; // Incoming call being received (1 per second, 50/50 on/off)
        } else if (callStatus === 'hold') {
          indicatorState = 'winking'; // Call in HOLD condition (1 per second, 95/5 on/off)
        } else if (callStatus === 'ok' || callStatus === 'active') {
          indicatorState = 'flutter'; // Connection made (12 per second, 80/20 on/off)
        }
      } else if (lineType === 2) {
        // Shout line behavior
        if (callStatus === 'off' || callStatus === '' || callStatus === 'idle') {
          indicatorState = 'off'; // Circuit idle
        } else if (callStatus === 'ok' || callStatus === 'active') {
          indicatorState = 'flutter'; // Connection made (12 per second, 80/20 on/off)
        } else if (callStatus === 'busy') {
          indicatorState = 'on'; // Circuit busy (steady-on)
        }
      }
      
      // Standard ground-to-ground button for the line with integrated cyan box
      // Parse two lines separated by a comma in the JSON line data
      let line1 = '';
      let line2 = '';
      if (Array.isArray(line) && line.length >= 3) {
        const parts = String(line[2]).split(',');
        line1 = parts[0] ? parts[0].trim() : '';
        line2 = parts[1] ? parts[1].trim() : '';
      } else if (typeof line === 'string') {
        const parts = line.split(',');
        line1 = parts[0] ? parts[0].trim() : '';
        line2 = parts[1] ? parts[1].trim() : '';
      }
      
      // Get call type and ID for proper messaging
      const call_id = Array.isArray(line) ? line[0] : (line.id || line.call?.substring(3) || '');
      const lineTypeValue = Array.isArray(line) ? line[1] : line.type;
      
      buttons.push({
        config: {
          id: String(line[0]),
          shortName: line1,
          label: line1, // For compatibility
          target: call_id,
          type: 'NONE',
        },
        typeString: typeLetter, // Pass the line type letter to the existing cyan box
        callback: (target: string, type: any) => {
          // Implement G/G calling logic similar to other UIs
          console.log('RDVS G/G Button clicked:', { target, type, lineType: lineTypeValue, call_id, currentStatus: statusObj.status });
          
          // Get current status for this line
          const currentStatus = statusObj.status || 'off';
          
          // Determine action based on line type and current status
          if (lineTypeValue === 0) {
            // Override line - send override call
            console.log('RDVS: Sending override call');
            sendMsg({ type: 'call', cmd1: call_id, dbl1: 0 }); // Override call
          } else if (lineTypeValue === 1) {
            // Ring line - handle ring/pickup logic
            if (currentStatus === 'off' || currentStatus === '' || currentStatus === 'idle') {
              console.log('RDVS: Sending ring call');
              sendMsg({ type: 'call', cmd1: call_id, dbl1: 1 }); // Ring call
            } else if (currentStatus === 'chime' || currentStatus === 'ringing') {
              console.log('RDVS: Accepting incoming call');
              sendMsg({ type: 'pick_up', cmd1: call_id, dbl1: 1 }); // Accept call
            } else if (currentStatus === 'ok' || currentStatus === 'active') {
              console.log('RDVS: Hanging up active call');
              sendMsg({ type: 'stop', cmd1: call_id, dbl1: 1 }); // Hangup
            }
          } else if (lineTypeValue === 2) {
            // Shout line - send shout call
            console.log('RDVS: Sending shout call');
            sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 }); // Shout call
          }
          
          // Log the action for debugging cyan box animations
          console.log('RDVS: Cyan box should animate based on new call status');
        },
        multiLineData: { line1, line2 },
        buttonPattern: pattern, // Add pattern for text color reference
        lineTypeInfo: {
          typeLetter: typeLetter,
          indicatorState: indicatorState
        }
      });
    });
  }
  const formatFreq = (freq: number) => {
    if (!freq) return '';
    const val = freq / 1_000_000;
    if (val % 1 === 0) return val.toFixed(1);
    return val.toString().replace(/0+$/, '').replace(/\.$/, '');
  };

  // Map first 12 ATG buttons to RadioButtonProps, hydrating frequency from ag_status
  const airToGroundButtons = Array.from({ length: 12 }).map((_, idx) => {
    const ag = ag_status && ag_status[idx] ? ag_status[idx] : {};
    
    // Debug logging for first button to see available properties
    if (idx === 0 && ag.freq) {
      console.log('RDVS ag_status data for button 0:', ag);
    }
    
    const button = {
      variant: 'radio' as const,
      radioSize: 'short' as const,
      label: ag.name,
      frequency: ag.freq ? formatFreq(ag.freq) : '--------',
      checked: !!ag.t,
      pttActive: ptt && !!ag.t, // Pass PTT status when this freq is selected for TX
      talking: !!ag.talking, // Pass talking status for flutter when others transmit
      selected: selectedRadioIndex === idx, // Check if this button is selected
      // Radio module status props from WebSocket data
      rxSelected: !!ag.r, // RX indicator from ag_status
      rxHsSelected: !!ag.h, // HS indicator from ag_status
      rxLsSelected: !!ag.l, // LS indicator from ag_status (if available)
      txSelected: !!ag.t, // TX indicator from ag_status
      rxMsMode: ag.rxMsMode || 'M', // RX M/S mode from ag_status
      txMsMode: ag.txMsMode || 'M', // TX M/S mode from ag_status
      receiverAudio: !!ag.audio, // Audio present indicator
      onSelect: () => {
        console.log(`Radio button ${idx} clicked. Current selected: ${selectedRadioIndex}`);
        // Toggle selection: if already selected, deselect; otherwise select this one
        setSelectedRadioIndex(selectedRadioIndex === idx ? null : idx);
      },
      // Add TX/RX callback functionality like VSCS
      onChange: (value: string) => {
        console.log('RDVS A/G Button changed:', { idx, value, freq: ag.freq });
      },
      // Add click handlers for TX/RX functionality
      onTxClick: () => {
        if (ag.freq) {
          console.log('RDVS A/G TX clicked:', { freq: ag.freq, currentTx: ag.t, newTx: !ag.t });
          sendMsg({ type: 'tx', cmd1: '' + ag.freq, dbl1: !ag.t });
        }
      },
      onRxClick: () => {
        if (ag.freq) {
          console.log('RDVS A/G RX clicked:', { freq: ag.freq, currentRx: ag.r, newRx: !ag.r });
          sendMsg({ type: 'rx', cmd1: '' + ag.freq, dbl1: !ag.r });
        }
      },
      onHsClick: () => {
        if (ag.freq) {
          console.log('RDVS A/G HS clicked:', { freq: ag.freq, currentHs: ag.h });
          sendMsg({ type: 'set_hs', cmd1: '' + ag.freq, dbl1: !ag.h });
        }
      },
      // Radio module control handlers
      onRxMsClick: () => {
        if (ag.freq) {
          console.log('RDVS A/G RX M/S clicked:', { freq: ag.freq, currentMode: ag.rxMsMode });
          // Toggle between Main and Standby modes
          sendMsg({ type: 'set_rx_ms', cmd1: '' + ag.freq, dbl1: ag.rxMsMode === 'M' });
        }
      },
      onTxMsClick: () => {
        if (ag.freq) {
          console.log('RDVS A/G TX M/S clicked:', { freq: ag.freq, currentMode: ag.txMsMode });
          // Toggle between Main and Standby modes  
          sendMsg({ type: 'set_tx_ms', cmd1: '' + ag.freq, dbl1: ag.txMsMode === 'M' });
        }
      },
      onRxHsLsClick: () => {
        if (ag.freq) {
          console.log('RDVS A/G HS/LS clicked:', { freq: ag.freq, currentHs: ag.h, currentLs: ag.l });
          // Toggle between Headset and Loudspeaker - cycle through HS → LS → OFF → HS
          if (ag.h && !ag.l) {
            // Currently HS, switch to LS
            sendMsg({ type: 'set_hs', cmd1: '' + ag.freq, dbl1: false });
            sendMsg({ type: 'set_ls', cmd1: '' + ag.freq, dbl1: true });
          } else if (!ag.h && ag.l) {
            // Currently LS, switch to OFF (both false)
            sendMsg({ type: 'set_ls', cmd1: '' + ag.freq, dbl1: false });
          } else {
            // Currently OFF or both, switch to HS
            sendMsg({ type: 'set_hs', cmd1: '' + ag.freq, dbl1: true });
            sendMsg({ type: 'set_ls', cmd1: '' + ag.freq, dbl1: false });
          }
        }
      }
    };
    
    // Debug logging for PTT status
    if (idx === 0) { // Log for first button to avoid spam
      console.log('RDVS PTT Debug:', { 
        ptt, 
        agT: ag.t, 
        pttActive: button.pttActive, 
        talking: button.talking,
        selected: button.selected 
      });
    }
    
    return button;
  });

  // Rest are ground-to-ground StandardButtonProps (already included above)
  const groundToGroundButtons = buttons.filter(isStandardButton);

  // Main RDVS panel layout
  return (
    <div
      className="rdvs-panel select-none p-2 text-white bg-black"
      style={{
        backgroundImage: 'url(/rdvs.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Header spacing */}
      <div style={{ height: '60px', width: '100%' }}></div>
      
      {/* TED Interior Matrix - Independent quadrant positioning for precise control */}
      <div className="relative">
        {/* Quadrant 1: Top-left (5×4 grid) - Uses buttons 0-15 (all available buttons) */}
        <div 
          className="absolute grid grid-cols-5"
          style={{ 
            top: '-5px',
            left: '5px',
            columnGap: '7px',
            rowGap: '7px'
          }}
        >
          {(() => {
            const q1Buttons = [];
            let q1Idx = 0;
            for (let row = 0; row < 4; row++) {
              for (let col = 0; col < 5; col++) {
                const btn = groundToGroundButtons[q1Idx];
                if (btn && isStandardButton(btn)) {
                  q1Buttons.push(
                    <div key={btn.config.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <RdvsButtonComponent {...btn} />
                    </div>
                  );
                  q1Idx++;
                } else {
                  q1Buttons.push(<div key={`q1-empty-${row}-${col}`}></div>);
                }
              }
            }
            return q1Buttons;
          })()}
        </div>

        {/* Air-to-ground buttons: Top-center (columns 5-7, rows 0-3) */}
        <div 
          className="absolute grid grid-cols-3"
          style={{ 
            top: '-5px',
            left: 'calc(5 * 61px + 5 * 15px + 10px)', // Position after Q1
            columnGap: '7px',
            rowGap: '7px'
          }}
        >
          {airToGroundButtons.slice(0, 12).map((atgBtn, atgIdx) => {
            let labelText = '';
            if (ag_status && ag_status[atgIdx]) {
              labelText = ag_status[atgIdx].call_name || ag_status[atgIdx].name || '';
            }
            return (
              <div key={atgBtn.label + atgIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {labelText && (
                  <div style={{ color: '#00FFFF', fontWeight: 'lighter', fontSize: '14px', marginBottom: '2px' }}>{labelText}</div>
                )}
                <RdvsButtonComponent {...atgBtn} />
              </div>
            );
          })}
        </div>

        {/* Quadrant 3: Bottom-left (5×4 grid) - Gets remaining buttons after Q1 */}
        <div 
          className="absolute grid grid-cols-5"
          style={{ 
            top: 'calc(3 * 63px + 4 * 7px + 6px)', // Position below top quadrants
            left: '5px',
            columnGap: '7px',
            rowGap: '7px'
          }}
        >
          {(() => {
            const q3Buttons = [];
            let q3Idx = 0; // Start from button 0 like Q1, but will use different slots
            let buttonCount = 0;
            
            for (let row = 0; row < 4; row++) {
              for (let col = 0; col < 5; col++) {
                // Q1 uses first 16 buttons (fills 16 of its 20 slots)
                // Q3 should get any remaining buttons (none currently since we only have 16 total)
                const btn = groundToGroundButtons[16 + buttonCount]; // Start after Q1's 16 buttons
                
                if (btn && isStandardButton(btn)) {
                  q3Buttons.push(
                    <div key={btn.config.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <RdvsButtonComponent {...btn} />
                    </div>
                  );
                } else {
                  q3Buttons.push(<div key={`q3-empty-${row}-${col}`}></div>);
                }
                buttonCount++;
              }
            }
            return q3Buttons;
          })()}
        </div>

        {/* Quadrant 4: Bottom-right (5×4 grid) - Gets buttons only after Q3 is full */}
        <div 
          className="absolute grid grid-cols-5"
          style={{ 
            top: 'calc(4 * 55px + 2 * 1px + 1px)', // Same vertical position as Q3
            left: 'calc(5 * 70px + 5 * 6px + 10px)', // Position after Q3
            width: '400px', // Explicit width for proper grid layout
            columnGap: '0px', // Precise control over Q4 spacing
            rowGap: '7px'
          }}
        >
          {(() => {
            const q4Buttons = [];
            let buttonCount = 0;
            
            for (let row = 0; row < 4; row++) {
              for (let col = 0; col < 5; col++) {
                // Q4 gets buttons only after Q1 (16 buttons) and Q3 (20 buttons) are filled
                // So Q4 starts at button index 36
                const btn = groundToGroundButtons[36 + buttonCount];
                
                if (btn && isStandardButton(btn)) {
                  q4Buttons.push(
                    <div key={btn.config.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '70px' }}>
                      <RdvsButtonComponent {...btn} />
                    </div>
                  );
                } else {
                  // Empty slot - maintains grid structure for spacing control
                  q4Buttons.push(<div key={`q4-empty-${row}-${col}`} style={{ width: '70px', minHeight: '50px' }}></div>);
                }
                buttonCount++;
              }
            }
            return q4Buttons;
          })()}
        </div>

        {/* Long Radio Button Overlay - Shows when a short radio button is selected */}
        {selectedRadioIndex !== null && (
          <div 
            className="absolute"
            style={{ 
              top: '445px', 
              right: '20px',  // Position in bottom-right area
              zIndex: 1000    // Ensure it's on top
            }}
          >
            <RdvsButtonComponent 
              variant="radio"
              radioSize="long"
              label={airToGroundButtons[selectedRadioIndex]?.label || `ATG ${selectedRadioIndex + 1}`}
              frequency={airToGroundButtons[selectedRadioIndex]?.frequency}
              checked={airToGroundButtons[selectedRadioIndex]?.checked}
              pttActive={airToGroundButtons[selectedRadioIndex]?.pttActive}
              talking={airToGroundButtons[selectedRadioIndex]?.talking}
              rxSelected={airToGroundButtons[selectedRadioIndex]?.rxSelected}
              rxHsSelected={airToGroundButtons[selectedRadioIndex]?.rxHsSelected}
              rxLsSelected={airToGroundButtons[selectedRadioIndex]?.rxLsSelected}
              txSelected={airToGroundButtons[selectedRadioIndex]?.txSelected}
              rxMsMode={airToGroundButtons[selectedRadioIndex]?.rxMsMode}
              txMsMode={airToGroundButtons[selectedRadioIndex]?.txMsMode}
              receiverAudio={airToGroundButtons[selectedRadioIndex]?.receiverAudio}
              onRxClick={airToGroundButtons[selectedRadioIndex]?.onRxClick}
              onTxClick={airToGroundButtons[selectedRadioIndex]?.onTxClick}
              onRxMsClick={airToGroundButtons[selectedRadioIndex]?.onRxMsClick}
              onTxMsClick={airToGroundButtons[selectedRadioIndex]?.onTxMsClick}
              onRxHsLsClick={airToGroundButtons[selectedRadioIndex]?.onRxHsLsClick}
            />
          </div>
        )}
      </div>
      {/* Footer spacing */}
      <div style={{ height: '48px', width: '100%' }}></div>
    </div>
  );
}
