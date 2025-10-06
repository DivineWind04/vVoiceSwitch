import { useEffect, useMemo, useState } from 'react';
import {
  ActiveLandline,
  Button,
  ButtonType,
  CALL_TYPE,
  Configuration,
  IncomingLandline,
} from './App';
import HeadphoneSvgComponent from './headphone_svg';
import SpeakerSvgComponent from './speaker_svg';
import VscsButtonComponent from './vscs_button';
import VscsStaticButton from './vscs_static_button';
import VscsAG from './vscs_ag';
import VscsUtil from './vscs_util';
import { useCoreStore } from '~/model';
import './styles.css';

// Utility function to get line type from position configuration data
const getLineTypeFromConfig = (lineId: string, positionData: any): number | null => {
  if (!positionData || !lineId) return null;
  
  // Recursively search through facilities and positions
  const searchFacilities = (facilities: any[]): number | null => {
    for (const facility of facilities) {
      // Search positions in current facility
      if (facility.positions) {
        for (const position of facility.positions) {
          // Check if lines array format exists [lineId, lineType, description]
          if (position.lines && Array.isArray(position.lines)) {
            for (const line of position.lines) {
              if (Array.isArray(line) && line[0] === lineId) {
                return line[1]; // Return line type (0, 1, or 2)
              }
            }
          }
          
          // Check if lines_obj format exists {lineId: lineType}
          if (position.lines_obj && typeof position.lines_obj === 'object') {
            if (position.lines_obj[lineId] !== undefined) {
              return position.lines_obj[lineId];
            }
          }
        }
      }
      
      // Recursively search child facilities
      if (facility.childFacilities && facility.childFacilities.length > 0) {
        const result = searchFacilities(facility.childFacilities);
        if (result !== null) return result;
      }
    }
    return null;
  };
  
  // Handle both single facility and array of facilities
  if (Array.isArray(positionData)) {
    return searchFacilities(positionData);
  } else if (positionData.childFacilities) {
    return searchFacilities([positionData]);
  }
  
  return null;
};

// Map numeric line types to ButtonType enum
const mapLineTypeToButtonType = (lineType: number | null): ButtonType => {
  switch (lineType) {
    case 0: return ButtonType.OVERRIDE; // Override line
    case 1: return ButtonType.RING;     // Normal/Ring line  
    case 2: return ButtonType.SHOUT;    // Shout line
    default: return ButtonType.RING;    // Default to normal if unknown
  }
};

interface VscsProps {
  activeLandlines: ActiveLandline[];
  incomingLandlines: IncomingLandline[];
  outgoingLandlines: ActiveLandline[];
  heldLandlines: string[];
  config: Configuration;
  buttonPress: (id: string, type: CALL_TYPE) => void;
  holdBtn: () => void;
  releaseBtn: () => void;
  toggleGg: () => void;
  toggleOver: () => void;
  ggLoud: boolean;
  overrideLoud: boolean;
  settingsEdit: (val: boolean) => void;
  volume: {
    volume: number;
    setVolume: (val: number) => void;
  };
  playError: () => void;
  metadata: {
    position: string;
    sector: string;
    facilityId: string;
  };
}

export default function VscsComponent(props: VscsProps) {
  const [page, setPage] = useState(1);
  const [func, setFunc] = useState('PRI');
  const [screenMode, setScreenMode] = useState('GG1'); // 'GG1', 'GG2', 'AG1', 'AG2', 'AG_STATUS', 'UTIL'
  const [isAltScreen, setIsAltScreen] = useState(false); // Track if we're in alternate screen selection mode
  const [rtEnabled, setRtEnabled] = useState(false); // Track R/T button state (default OFF)
  
  const gg_status = useCoreStore((s: any) => s.gg_status);
  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  const positionData = useCoreStore((s: any) => s.positionData);
  
  const ITEMS_PER_PAGE = 27;
  
  const currentSlice = useMemo(() => {
    // Determine which page to use based on screen mode
    let currentPage = 1;
    if (screenMode === 'GG2') {
      currentPage = 2;
    } else if (screenMode === 'GG1') {
      currentPage = 1;
    }
    
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const slice = gg_status.slice(start, end);
    // Pad with empty slots if needed
    if (slice.length < ITEMS_PER_PAGE) {
      return [...slice, ...new Array(ITEMS_PER_PAGE - slice.length).fill(undefined)];
    }
    return slice;
    }, [gg_status, screenMode]);

  const btns: Button[] = useMemo(() => {
    return currentSlice.map((data: any) => {
      if (!data) {
        // Empty/unavailable button
        return {
          shortName: '',
          longName: '',
          target: '',
          type: ButtonType.NONE,
        };
      }
      
      // Get line ID from call field (skip 5-character prefix)
      const lineId = data.call?.substring(5) || '';
      
      // Look up line type from configuration data
      const configLineType = getLineTypeFromConfig(lineId, positionData);
      const buttonType = mapLineTypeToButtonType(configLineType);
      
      // Convert WebSocket data to Button format
      return {
        shortName: data.call_name || data.call?.substring(5) || '',
        longName: data.call_name || data.call?.substring(5) || '',
        target: data.call?.substring(5) || '',
        type: buttonType,
      };
    });
  }, [currentSlice, positionData]);

  // Generate multi-line data for G/G buttons based on Manual Page 27
  const generateGGMultiLineData = (data: any) => {
    if (!data) return undefined;
    
    // Extract meaningful parts from the data
    const callId = data.call?.substring(5) || '';
    const callName = data.call_name || callId;
    
    // Parse the call_name or call to extract different components
    // This may need adjustment based on actual data format
    const parts = callName.split(/[-_\s]/);
    
    return {
      line1: parts[0] || callName.substring(0, 8), // Agency name (first part or first 8 chars)
      line2: parts[1] || '', // Position designation
      line3: data.frequency || parts[2] || '', // Frequency designation
      line4: data.backup_status || data.status_info || '', // Additional info
      line5: 'RING' // Type indicator - will be overridden by typeString if provided
    };
  };
  const [buttons, setButtons] = useState(btns);
  const testFunc = (a: string, b: ButtonType) => {
    console.log('testFunc called with:', { target: a, type: b });
    
    // Don't allow clicks on buttons with no data (unavailable buttons)
    if (!a || !b || b === ButtonType.NONE) {
      console.log('Rejecting click - invalid target or type');
      return;
    }
    
    // Find the button data from gg_status
    const buttonData = currentSlice.find((data: any) => 
      data && data.call?.substring(5) === a
    );
    
    console.log('Found button data:', buttonData);
    console.log('Full call string:', buttonData?.call);
    console.log('Call prefix:', buttonData?.call?.substring(0, 2));
    console.log('Call ID:', buttonData?.call?.substring(5));
    
    // Only proceed if we have valid button data
    if (buttonData) {
      // Extract call ID properly - handle different formats
      let call_id;
      const fullCall = buttonData.call;
      
      if (fullCall?.startsWith('SO_')) {
        // Shout/Override format: "SO_891" -> "891"
        call_id = fullCall.substring(3);
      } else if (fullCall?.startsWith('gg_')) {
        // Ground-Ground format: "gg_05_123" -> "123" (skip "gg_05_")  
        call_id = fullCall.substring(6);
      } else {
        // Fallback to original logic
        call_id = fullCall?.substring(5) || '';
      }
      
      console.log('Processing call for ID:', call_id, 'Status:', buttonData.status, 'Full call:', fullCall);
      
      // Add immediate visual feedback - find the button element
      const buttonIndex = currentSlice.findIndex((data: any) => 
        data && data.call?.substring(5) === a
      );
      const buttonEl = document.querySelector(`.vscs-panel .grid .gg-button:nth-child(${buttonIndex + 1})`);
      
      // Handle different statuses based on IVSR/ETVS implementations
      // Check if this is a Shout/Override line (SO prefix)
      const isShoutOverride = buttonData.call?.startsWith('SO_');
      
      switch (buttonData.status) {
        case 'idle':
        case '':
        case 'off':
          // Add immediate "calling" visual feedback
          if (buttonEl) {
            buttonEl.classList.remove('state-active', 'state-busy', 'state-ringing', 'state-hold', 'state-unavailable');
            buttonEl.classList.add('state-ringing'); // Show amber flashing while calling
          }
          // Connect call
          console.log('Initiating call to:', call_id);
          sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 });
          break;
          
        case 'ok':
        case 'active':
          // Add immediate visual feedback for disconnecting
          if (buttonEl) {
            buttonEl.classList.remove('state-active', 'state-busy', 'state-ringing', 'state-hold', 'state-unavailable');
            // Brief flash to show action taken, will be updated by WebSocket response
          }
          // Disconnect call - use dbl1: 1 for SO lines, dbl1: 2 for others
          console.log('Disconnecting call from:', call_id, 'isShoutOverride:', isShoutOverride);
          sendMsg({ type: 'stop', cmd1: call_id, dbl1: isShoutOverride ? 1 : 2 });
          break;
          
        case 'chime':
        case 'ringing':
        case 'online':
          // Answer/Join incoming call - follow IVSR pattern exactly
          console.log('Answering incoming call from:', call_id, 'with status:', buttonData.status, 'isShoutOverride:', isShoutOverride);
          if (isShoutOverride && (buttonData.status === 'online' || buttonData.status === 'chime')) {
            // For SO lines with online/chime status, use 'call' to join
            const message = { type: 'call', cmd1: call_id, dbl1: 2 };
            console.log('Sending message for SO line:', message);
            sendMsg(message);
          } else {
            // For ALL other incoming calls (chime/ringing/online), use 'stop' with dbl1: 2 (IVSR pattern)
            const message = { type: 'stop', cmd1: call_id, dbl1: 2 };
            console.log('Sending message for regular line:', message);
            sendMsg(message);
          }
          break;
          
        case 'busy':
        case 'hold':
        case 'pending':
        case 'terminate':
        case 'overridden':
          // No action allowed for these states
          console.log('No action available for status:', buttonData.status);
          break;
          
        default:
          // Default action - try to connect
          if (buttonEl) {
            buttonEl.classList.remove('state-active', 'state-busy', 'state-ringing', 'state-hold', 'state-unavailable');
            buttonEl.classList.add('state-ringing'); // Show amber flashing while calling
          }
          sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 });
          break;
      }
    }
    // If no buttonData found, do nothing (button is unavailable)
  };

  const callAnsBtn = () => {
    const toAnswer = props.incomingLandlines[0];
    if (toAnswer) {
      testFunc(toAnswer.from, toAnswer.type as CALL_TYPE & ButtonType);
    } else {
      props.playError();
    }
  };

  const swapPages = () => {
    if (screenMode === 'GG1') {
      setScreenMode('GG2');
    } else if (screenMode === 'GG2') {
      setScreenMode('GG1');
    } else if (screenMode === 'AG1') {
      setScreenMode('AG2');
    } else if (screenMode === 'AG2') {
      setScreenMode('AG1');
    }
  };

  const funcAltBtn = () => {
    if (func === 'PRI') {
      setFunc('ALT');
    } else {
      setFunc('PRI');
    }
  };

  const scrnAltBtn = () => {
    if (!isAltScreen) {
      // Enter alternate screen selection mode
      setIsAltScreen(true);
    } else {
      // Exit alternate screen selection mode, return to current screen
      setIsAltScreen(false);
    }
  };

  const selectScreen = (screen: string) => {
    setScreenMode(screen);
    setIsAltScreen(false); // Exit screen selection mode
  };

  // Clean up any lingering elements when screen mode changes
  useEffect(() => {
    // When switching to G/G screens, clean up any A/G button states that might persist
    if (screenMode.startsWith('GG')) {
      // AGGRESSIVE cleanup - remove state-unselected from ALL elements in the component
      document.querySelectorAll('.vscs-panel .state-unselected').forEach((el) => {
        el.classList.remove('state-unselected');
      });
      
      // ALSO clean up A/G specific classes that might be persisting
      document.querySelectorAll('.vscs-panel .ag-idle, .vscs-panel .ag-active, .vscs-panel .ag-busy, .vscs-panel .ag-monitoring').forEach((el) => {
        el.classList.remove('ag-idle', 'ag-active', 'ag-busy', 'ag-monitoring');
      });
      
      // Also remove from A/G specific buttons
      document.querySelectorAll('.ag-button, .vscs-button.unassigned').forEach((el) => {
        el.classList.remove('state-unselected', 'state-active', 'state-busy', 'state-ringing', 'state-unavailable');
        el.classList.remove('ag-idle', 'ag-active', 'ag-busy', 'ag-monitoring');
      });
    }
  }, [screenMode]);

  // Update buttons when btns changes
  useEffect(() => {
    setButtons(btns);
  }, [btns]);

  // Handle dynamic button states from WebSocket data - ONLY for G/G screens
  useEffect(() => {
    // IMMEDIATE cleanup for G/G screens to prevent initial flash
    if (screenMode.startsWith('GG')) {
      // First, aggressively clean any state-unselected classes
      document.querySelectorAll('.vscs-panel .state-unselected').forEach((el) => {
        el.classList.remove('state-unselected');
      });
    }
    
    // Only apply dynamic states on G/G screens
    if (!screenMode.startsWith('GG')) {
      return;
    }
    
    // Clear all dynamic states first - but only for G/G grid buttons
    buttons.forEach((btn, index) => {
      const buttonEl = document.querySelector(`.vscs-panel .grid .gg-button:nth-child(${index + 1})`);
      if (buttonEl) {
        buttonEl.classList.remove('state-unselected', 'state-active', 'state-busy', 'state-ringing', 'state-unavailable');
      }
    });

    currentSlice.forEach((data: any, index: number) => {
      const buttonEl = document.querySelector(`.vscs-panel .grid .gg-button:nth-child(${index + 1})`);
      
      if (!data) {
        // Button is unavailable - add unavailable class
        buttonEl?.classList.add('state-unavailable');
        return;
      }

      const target = data.call?.substring(5) || data.target;
      
      // Only target the specific grid button, not all buttons with the target class
      if (buttonEl) {
        // DEFENSIVE CHECK: Only proceed if this is actually a G/G button
        if (!buttonEl.classList.contains('gg-button')) {
          console.warn('Found non-GG button with GG selector:', buttonEl, 'index:', index);
          return;
        }
        
        // Remove existing state classes
        buttonEl.classList.remove('state-unselected', 'state-active', 'state-busy', 'state-ringing', 'state-unavailable');
        
        // Add state based on WebSocket data
        switch (data.status) {
          case 'idle':
          case '':
          case 'off':
            // For idle buttons with data, use default .vscs-button styling (white background, black text)
            break;
            
          case 'ok':
          case 'active':
            // Connected call - green background, black text
            buttonEl.classList.add('state-active');
            break;
            
          case 'busy':
            // Busy line - black background, green text, flashing
            buttonEl.classList.add('state-busy');
            break;
            
          case 'chime':
          case 'ringing':
          case 'online':
            // Incoming call - amber background, black text, flashing
            buttonEl.classList.add('state-ringing');
            break;
            
          case 'hold':
            // Call on hold - yellow background, black text, winking
            buttonEl.classList.add('state-hold');
            break;
            
          case 'pending':
          case 'terminate':
          case 'overridden':
            // No action states - use unavailable styling
            buttonEl.classList.add('state-unavailable');
            break;
            
          default:
            // For unknown status with data, use default .vscs-button styling
            break;
        }
      }
    });
  }, [currentSlice, gg_status, buttons, screenMode]);  useEffect(() => {
    console.log('out1', props.outgoingLandlines);
    console.log('in1', props.incomingLandlines);
    console.log('act1', props.activeLandlines);
    // Outgoing
    props.outgoingLandlines.forEach((line) => {
      document
        .querySelectorAll(`.${line.target}.${line.type}`)
        .forEach((el) => {
          el.classList.toggle('vscs-active-call', false);
          el.classList.toggle('vscs-incoming-bg', true);
        });
    });
    let outgoingSlow = setInterval(() => {
      props.outgoingLandlines.forEach((line) => {
        document
          .querySelectorAll(`.${line.target} .${line.type}`)
          .forEach((el) => {
            el.classList.toggle('vscs-active-call');
          });
      });
    }, 750);

    // Incoming
    props.incomingLandlines.forEach((line) => {
      document
        .querySelectorAll(`.${line.target}.${line.type}`)
        .forEach((el) => {
          el.classList.toggle('vscs-active-call', false);
          el.classList.toggle('vscs-incoming-bg', true);
        });
      document.querySelectorAll(`.${line.from}.${line.type}`).forEach((el) => {
        el.classList.toggle('vscs-active-call', false);
        el.classList.toggle('vscs-incoming-bg', true);
      });
    });
    let incomingSlow = setInterval(() => {
      props.incomingLandlines.forEach((line) => {
        document
          .querySelectorAll(`.${line.target}.${line.type}`)
          .forEach((el) => {
            el.classList.toggle('vscs-active-call');
          });
        document
          .querySelectorAll(`.${line.from}.${line.type}`)
          .forEach((el) => {
            el.classList.toggle('vscs-active-call');
          });
      });
    }, 750);

    // Active
    props.activeLandlines.forEach((line) => {
      if (props.heldLandlines.includes(line.id)) {
        document
          .querySelectorAll(`.${line.target}.${line.type}`)
          .forEach((el) => {
            el.classList.toggle('vscs-held', false);
          });

        document
          .querySelectorAll(`.${line.from}.${line.type}`)
          .forEach((el) => {
            el.classList.toggle('vscs-held', false);
          });
      } else {
        const from =
          line.type === CALL_TYPE.CONVERTED_SHOUT ||
          line.type === CALL_TYPE.SHOUT
            ? line.from.split('-')[0]
            : line.from;
        document
          .querySelectorAll(`.${line.target}.${line.type}`)
          .forEach((el) => {
            el.classList.toggle('vscs-active-call', false);
            el.classList.toggle('vscs-active-bg', true);
          });

        document.querySelectorAll(`.${from}.${line.type}`).forEach((el) => {
          el.classList.toggle('vscs-active-call', false);
          el.classList.toggle('vscs-active-bg', true);
        });
      }
    });

    let activeFast = setInterval(() => {
      props.activeLandlines.forEach((line) => {
        if (props.heldLandlines.includes(line.id)) {
          document
            .querySelectorAll(`.${line.target}.${line.type}`)
            .forEach((el) => {
              el.classList.toggle('vscs-held', true);
            });
          document
            .querySelectorAll(`.${line.from}.${line.type}`)
            .forEach((el) => {
              el.classList.toggle('vscs-held', true);
            });
        } else {
          const from =
            line.type === CALL_TYPE.CONVERTED_SHOUT ||
            line.type === CALL_TYPE.SHOUT
              ? line.from.split('-')[0]
              : line.from;
          document
            .querySelectorAll(`.${line.target}.${line.type}`)
            .forEach((el) => {
              el.classList.toggle('vscs-active-call');
            });
          document.querySelectorAll(`.${from}.${line.type}`).forEach((el) => {
            el.classList.toggle('vscs-active-call');
          });
        }
      });
    }, 250);

    return () => {
      console.log('unloading lines arrays');
      clearInterval(outgoingSlow);
      clearInterval(incomingSlow);
      clearInterval(activeFast);
      // Only clear states from G/G grid buttons, not static buttons or A/G buttons
      buttons.forEach((btn, index) => {
        const buttonEl = document.querySelector(`.gg-button:nth-child(${index + 1})`);
        if (buttonEl) {
          buttonEl.classList.toggle('vscs-active-call', false);
          buttonEl.classList.toggle('vscs-active-bg', false);
          buttonEl.classList.toggle('vscs-incoming-bg', false);
          buttonEl.classList.toggle('vscs-held', false);
        }
      });
    };
  }, [
    props.activeLandlines,
    props.incomingLandlines,
    props.outgoingLandlines,
    props.heldLandlines,
  ]);

  return (
    <>
      <div className="bg-zinc-700 p-0.5 vscs-panel tracking-tight leading-none select-none">
        <div className="grid grid-cols-9 gap-y-3 mt-2">
          {/* Always show the current screen content - no screen selection in main grid */}
          {screenMode === 'AG1' ? (
            // A/G 1 screen
            <VscsAG page={1} sendMsg={sendMsg} />
          ) : screenMode === 'AG2' ? (
            // A/G 2 screen  
            <VscsAG page={2} sendMsg={sendMsg} />
          ) : screenMode === 'AG_STATUS' ? (
            // A/G Status screen - placeholder for now
            Array.from({ length: 27 }, (_, i) => (
              <div key={i} className="vscs-empty h-20 bg-stone-500 flex items-center justify-center text-white">
                {i === 13 ? 'A/G STATUS' : ''}
              </div>
            ))
          ) : screenMode === 'UTIL' ? (
            // Utility screen - create a container that spans the grid for overlay buttons
            <>
              {/* UTIL content in the regular grid cell */}
              <div className="col-span-9 relative">
                <VscsUtil sendMsg={sendMsg} />
                
                {/* Overlay the UTIL function buttons on top of the content */}
                <div className="absolute bottom-1 left-2 flex flex-wrap gap-3 justify-center" style={{ zIndex: 25 }}>
                  {screenMode === 'UTIL' ? (
                    isAltScreen ? (
                      // Screen selection mode - show SCRN ALT + magenta screen options in overlay position
                      <>
                        <VscsStaticButton 
                          onClick={() => scrnAltBtn()}
                          className={isAltScreen ? 'scrn-alt-active' : ''}
                        >
                          SCRN<br />ALT
                        </VscsStaticButton>
                        <VscsStaticButton 
                          className="screen-select"
                          onClick={() => selectScreen('AG1')}
                        >
                          A/G 1
                        </VscsStaticButton>
                        <VscsStaticButton 
                          className="screen-select"
                          onClick={() => selectScreen('AG2')}
                        >
                          A/G 2
                        </VscsStaticButton>
                        <VscsStaticButton 
                          className="screen-select"
                          onClick={() => selectScreen('AG_STATUS')}
                        >
                          A/G STATUS
                        </VscsStaticButton>
                        <VscsStaticButton 
                          className="screen-select"
                          onClick={() => selectScreen('GG1')}
                        >
                          G/G 1
                        </VscsStaticButton>
                        <VscsStaticButton 
                          className="screen-select"
                          onClick={() => selectScreen('GG2')}
                        >
                          G/G 2
                        </VscsStaticButton>
                        <VscsStaticButton 
                          className="screen-select"
                          onClick={() => selectScreen('UTIL')}
                        >
                          UTIL
                        </VscsStaticButton>
                        {/* R/T button positioned in overlay for UTIL mode */}
                        <div className="col-span-2 relative">
                          {/* R/T Indicator positioned above the static button */}
                          <div className="absolute -top-[117px] right-[265px] text-black bg-zinc-50 text-center w-[165px] h-5">
                            <div className="text-center text-lg leading-tight">
                              {rtEnabled ? 'R/T ON' : 'R/T OFF'}
                            </div>
                          </div>
                          <div 
                            className="relative -top-[105px] right-[265px] vscs-static-button w-[80px] h-20 bg-cyan-400 cursor-pointer mt-2"
                            onClick={() => setRtEnabled(!rtEnabled)}
                          >
                          </div>
                        </div>
                        {/* Large grey area positioned next to R/T button in UTIL mode */}
                        <div className="bg-stone-500 vscs-empty absolute -top-[105px] right-[440px] w-[335px] h-[80px] mt-2"></div>
                              </>
                    ) : (
                      // Normal UTIL function buttons
                      <>
                        <VscsStaticButton 
                          onClick={() => scrnAltBtn()}
                          className={isAltScreen ? 'scrn-alt-active' : ''}
                        >
                          SCRN<br />ALT
                        </VscsStaticButton>
                        <VscsStaticButton onClick={() => funcAltBtn()}>
                          FUNC<br />ALT
                        </VscsStaticButton>
                        <VscsStaticButton onClick={() => {/* TODO: Implement SCRN RTRN */}}>
                          &lt;SCRN&gt;<br />RTRN
                        </VscsStaticButton>
                        <VscsStaticButton onClick={() => {/* TODO: Implement SPLIT MODE */}}>
                          SPLIT<br />MODE
                        </VscsStaticButton>
                        <VscsStaticButton onClick={() => {/* TODO: Implement KEY CLICK */}}>
                          KEY<br />CLICK
                        </VscsStaticButton>
                        <VscsStaticButton onClick={() => {/* TODO: Implement DE-GAUSS */}}>
                          DE-<br />GAUSS
                        </VscsStaticButton>
                        <VscsStaticButton onClick={() => {/* TODO: Implement S/W MAINT */}}>
                          S/W<br />MAINT
                        </VscsStaticButton>
                        {/* R/T button positioned in overlay for UTIL mode */}
                        <div className="col-span-2 relative">
                          {/* R/T Indicator positioned above the static button */}
                          <div className="absolute -top-[117px] right-[265px] text-black bg-zinc-50 text-center w-[165px] h-5">
                            <div className="text-center text-lg leading-tight">
                              {rtEnabled ? 'R/T ON' : 'R/T OFF'}
                            </div>
                          </div>
                          <div 
                            className="relative -top-[105px] right-[265px] vscs-static-button w-[80px] h-20 bg-cyan-400 cursor-pointer mt-2"
                            onClick={() => setRtEnabled(!rtEnabled)}
                          >
                          </div>
                        </div>
                        {/* Large grey area positioned next to R/T button in UTIL mode */}
                        <div className="bg-stone-500 vscs-empty absolute -top-[105px] right-[440px] w-[335px] h-[80px] mt-2"></div>
                              </>
                    )
                  ) : null}
                </div>
              </div>
            </>
          ) : screenMode === 'GG2' ? (
            // G/G 2 screen (page 2)
            buttons.map((btn, i) => (
              <VscsButtonComponent
                key={i}
                config={btn}
                typeString={
                  btn.type === ButtonType.OVERRIDE
                    ? 'OVR'
                    : btn.type === ButtonType.RING
                      ? 'RING'
                      : btn.type === ButtonType.SHOUT
                        ? btn.dialCode ?? ''
                        : btn.type === ButtonType.NONE
                          ? ''
                          : ''
                }
                callback={btn.type !== ButtonType.NONE && (btn.shortName || btn.target) ? testFunc : undefined}
                className={`${btn.target} ${btn.type} vscs-button gg-button ${
                  btn.type !== ButtonType.NONE && (btn.shortName || btn.target)
                    ? 'cursor-pointer'
                    : 'cursor-not-allowed'
                }`}
                multiLineData={generateGGMultiLineData(currentSlice[i])}
              />
            ))
          ) : (
            // Default G/G 1 screen (page 1)
            buttons.map((btn, i) => (
              <VscsButtonComponent
                key={i}
                config={btn}
                typeString={
                  btn.type === ButtonType.OVERRIDE
                    ? 'OVR'
                    : btn.type === ButtonType.RING
                      ? 'RING'
                      : btn.type === ButtonType.SHOUT
                        ? btn.dialCode ?? ''
                        : btn.type === ButtonType.NONE
                          ? ''
                          : ''
                }
                callback={btn.type !== ButtonType.NONE && (btn.shortName || btn.target) ? testFunc : undefined}
                className={`${btn.target} ${btn.type} vscs-button gg-button ${
                  btn.type !== ButtonType.NONE && (btn.shortName || btn.target)
                    ? 'cursor-pointer'
                    : 'cursor-not-allowed'
                }`}
                multiLineData={generateGGMultiLineData(currentSlice[i])}
              />
            ))
          )}
          {/* Static buttons row - only show the 4 small buttons on G/G screens */}
          {!screenMode.startsWith('AG') && screenMode !== 'UTIL' && (
            <div className="vscs-empty col-start-1 col-end-7">
              <div className="flex gap-x-3 px-5">
                <div className="bg-stone-500 w-1/4 h-20"></div>
                <div className="bg-stone-500 w-1/4 h-20"></div>
                <div className="bg-stone-500 w-1/4 h-20"></div>
                <div className="bg-stone-500 w-1/4 h-20"></div>
              </div>
            </div>
          )}
          {/* CALL ANS button - only show on G/G screens */}
          {!screenMode.startsWith('AG') && screenMode !== 'UTIL' && (
            <VscsStaticButton onClick={() => callAnsBtn()}>
              CALL ANS
            </VscsStaticButton>
          )}

          {/* Large grey area - hide when in UTIL mode since it's included in UTIL component */}
          {screenMode !== 'UTIL' && (
            <div className="bg-stone-500 vscs-empty col-start-1 col-end-5 w-[335px] h-[80px] mt-2"></div>
          )}
          {/* R/T button section - hide in UTIL mode since it's in overlay, show on other pages */}
          {screenMode !== 'UTIL' && (
            <div className="col-span-2 relative">
              {/* R/T Indicator positioned above the static button using absolute positioning */}
              <div className="absolute -top-3 left-0 right-0 text-black bg-zinc-50 text-center w-[165px] h-5">
                <div className="text-center text-lg leading-tight">
                  {rtEnabled ? 'R/T ON' : 'R/T OFF'}
                </div>
              </div>
              <div 
                className="vscs-static-button w-[80px] h-20 bg-cyan-400 cursor-pointer mt-2"
                onClick={() => setRtEnabled(!rtEnabled)}
              >
              </div>
            </div>
          )}

          {/* HOLD button - only show on G/G screens */}
          {!screenMode.startsWith('AG') && screenMode !== 'UTIL' && (
            <VscsStaticButton onClick={() => props.holdBtn()}>
              HOLD
            </VscsStaticButton>
          )}
          <div className="grid col-span-9 grid-cols-subgrid text-center -mt-3">
            <div className={`text-black bg-zinc-50 text-center px-0.0 py-0.0 ml-0.0 mr-[13px] h-4 ${screenMode === 'UTIL' ? 'transform  -translate-y-[109px] translate-x-2' : ''}`}>
              <div className="text-center text-lg leading-tight">
                {screenMode === 'AG1' ? 'A/G 1' :
                 screenMode === 'AG2' ? 'A/G 2' : 
                 screenMode === 'AG_STATUS' ? 'A/G STATUS' :
                 screenMode === 'UTIL' ? 'UTIL' :
                 screenMode === 'GG2' ? 'G/G 2' :
                 'G/G 1'}
              </div>
            </div>
            <div className={`text-black bg-zinc-50 text-center px-0.0 py-0.0 ml-0.0 mr-[13px] h-4 ${screenMode === 'UTIL' ? 'transform -translate-y-[109px] translate-x-2' : ''}`}>
              <div className="text-center text-lg leading-tight">{func}</div>
            </div>
            <div className="col-span-7 h-4"></div>

            {/* SCRN ALT button - hide in UTIL mode since it's overlaid */}
            {screenMode !== 'UTIL' ? (
              <VscsStaticButton 
                onClick={() => scrnAltBtn()}
                className={isAltScreen ? 'scrn-alt-active' : ''}
              >
                SCRN ALT
              </VscsStaticButton>
            ) : (
              <div></div>
            )}
            
            {/* Conditional bottom row based on screen selection mode */}
            {isAltScreen && screenMode !== 'UTIL' ? (
              // Screen selection mode - replace normal buttons with screen options (violet background)
              // Skip for UTIL mode since screen selection is in overlay position
              <>
                <VscsStaticButton 
                  className="screen-select"
                  onClick={() => selectScreen('AG1')}
                >
                  A/G 1
                </VscsStaticButton>
                <VscsStaticButton 
                  className="screen-select"
                  onClick={() => selectScreen('AG2')}
                >
                  A/G 2
                </VscsStaticButton>
                <VscsStaticButton 
                  className="screen-select"
                  onClick={() => selectScreen('AG_STATUS')}
                >
                  A/G STATUS
                </VscsStaticButton>
                <VscsStaticButton 
                  className="screen-select"
                  onClick={() => selectScreen('GG1')}
                >
                  G/G 1
                </VscsStaticButton>
                <VscsStaticButton 
                  className="screen-select"
                  onClick={() => selectScreen('GG2')}
                >
                  G/G 2
                </VscsStaticButton>
                <VscsStaticButton 
                  className="screen-select"
                  onClick={() => selectScreen('UTIL')}
                >
                  UTIL
                </VscsStaticButton>
              </>
            ) : (
              // Normal button row - different buttons for A/G vs G/G vs UTIL screens
              <>
                {screenMode.startsWith('AG') ? (
                  // A/G page function buttons
                  <>
                    <VscsStaticButton onClick={() => funcAltBtn()}>
                      FUNC ALT
                    </VscsStaticButton>
                    <VscsStaticButton 
                      onClick={() => (screenMode === 'AG1' || screenMode === 'AG2') ? swapPages() : undefined}
                      disabled={!(screenMode === 'AG1' || screenMode === 'AG2')}
                    >
                      A/G ALT
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => {/* TODO: Implement AUTO VOICE ROUTE */}}>
                      AUTO VOICE ROUTE
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => {/* TODO: Implement MAIN STBY */}}>
                      MAIN STBY
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => {/* TODO: Implement BUEC */}}>
                      BUEC
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => {/* TODO: Implement XCPL */}}>
                      XCPL
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => {/* TODO: Implement REM MUTE */}}>
                      REM MUTE
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => {/* TODO: Implement FTS MON */}}>
                      FTS MON
                    </VscsStaticButton>
                  </>
                ) : screenMode === 'UTIL' ? (
                  // UTIL page function buttons are in overlay, so keep function row empty
                  <></>
                ) : (
                  // G/G page function buttons (original)
                  <>
                    <VscsStaticButton onClick={() => funcAltBtn()}>
                      FUNC ALT
                    </VscsStaticButton>
                    <VscsStaticButton 
                      onClick={() => (screenMode === 'GG1' || screenMode === 'GG2') ? swapPages() : undefined}
                      disabled={!(screenMode === 'GG1' || screenMode === 'GG2')}
                    >
                      G/G ALT
                    </VscsStaticButton>
                    <VscsStaticButton disabled={true}>
                      PSN REL
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => props.toggleGg()}>
                      <div>
                        <div className="flex items-center justify-center">G/G</div>
                        <div className="h-6">
                          {props.ggLoud ? (
                            <SpeakerSvgComponent />
                          ) : (
                            <HeadphoneSvgComponent />
                          )}
                        </div>
                      </div>
                    </VscsStaticButton>
                    <VscsStaticButton onClick={() => props.toggleOver()}>
                      <div>
                        <div className="flex items-center justify-center">OVR</div>
                        <div className="h-6">
                          {props.overrideLoud ? (
                            <SpeakerSvgComponent />
                          ) : (
                            <HeadphoneSvgComponent />
                          )}
                        </div>
                      </div>
                    </VscsStaticButton>
                    <VscsStaticButton disabled={true}>
                      {func === 'PRI' ? 'CALL FWD' : 'HOLLER ON/OFF'}
                    </VscsStaticButton>
                    <VscsStaticButton 
                      className="col-start-8 col-end-10"
                      width="165px"
                      onClick={() => props.releaseBtn()}
                    >
                      RLS
                    </VscsStaticButton>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
