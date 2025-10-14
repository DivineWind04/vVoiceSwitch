import { useEffect, useMemo } from 'react';
import { useCoreStore } from '~/model';
import VscsButtonComponent from './vscs_button';
import HeadphoneSvgComponent from './headphone_svg';
import SpeakerSvgComponent from './speaker_svg';
import { ButtonType } from './App';

interface VscsAGProps {
  page: number; // 1 for A/G 1, 2 for A/G 2
  sendMsg: (data: any) => void;
}

export default function VscsAG({ page, sendMsg }: VscsAGProps) {
  const ag_status = useCoreStore((s: any) => s.ag_status);
  const ptt = useCoreStore((s: any) => s.ptt);
  const positionData = useCoreStore((s: any) => s.positionData);
  
  const ITEMS_PER_PAGE = 12; // 4x3 grid
  
  // Helper function to get radio sites for a frequency
  const getRadioSitesForFreq = (freq: number): string[] => {
    if (!positionData || !freq) return [];
    
    // Search through positions to find matching frequency
    const searchPositions = (positions: any[]): string[] => {
      for (const position of positions) {
        if (position.freq === freq && position.rn) {
          // Split by comma and trim whitespace
          return position.rn.split(',').map((site: string) => site.trim());
        }
      }
      return [];
    };
    
    // Handle both array and single object formats
    if (Array.isArray(positionData)) {
      return searchPositions(positionData);
    } else if (positionData.positions) {
      return searchPositions(positionData.positions);
    }
    
    return [];
  };
  
  // First, expand ALL A/G frequencies to buttons (including radio site expansion)
  const allExpandedButtons = useMemo(() => {
    const expandedButtons: any[] = [];
    
    // Expand all frequencies with their radio sites
    ag_status.forEach((data: any, index: number) => {
      if (!data) {
        // Skip empty data
        return;
      } else {
        // Get radio sites for this frequency
        const radioSites = getRadioSitesForFreq(parseInt(data.freq));
        const formattedFreq = data.freq ? (parseInt(data.freq) / 1000000).toFixed(3) : '';
        
        if (radioSites.length <= 1) {
          // Single or no radio site - create one button
          expandedButtons.push({
            shortName: formattedFreq,
            longName: data.call_name || '',
            target: data.freq || '',
            type: ButtonType.RING,
            radioSiteIndex: 0,
            originalData: data,
            radioSite: radioSites[0] || 'ZOA'
          });
        } else {
          // Multiple radio sites - create separate buttons for each
          radioSites.forEach((radioSite: string, siteIndex: number) => {
            expandedButtons.push({
              shortName: formattedFreq,
              longName: data.call_name || '',
              target: data.freq || '',
              type: ButtonType.RING,
              radioSiteIndex: siteIndex,
              originalData: data,
              radioSite: radioSite
            });
          });
        }
      }
    });

    return expandedButtons;
  }, [ag_status]);

  // Then slice the expanded buttons for the specific page with overflow logic
  const currentSlice = useMemo(() => {
    // Implement overflow logic at the button level (after radio site expansion)
    if (page === 1) {
      // Page 1: show first ITEMS_PER_PAGE buttons
      const slice = allExpandedButtons.slice(0, ITEMS_PER_PAGE);
      // Pad with empty slots if needed
      if (slice.length < ITEMS_PER_PAGE) {
        return [...slice, ...new Array(ITEMS_PER_PAGE - slice.length).fill({
          shortName: '',
          longName: '',
          target: '',
          type: ButtonType.NONE,
          radioSiteIndex: 0,
          originalData: null
        })];
      }
      return slice;
    } else if (page === 2) {
      // Page 2: show overflow buttons (buttons beyond ITEMS_PER_PAGE)
      const slice = allExpandedButtons.slice(ITEMS_PER_PAGE);
      // Limit to ITEMS_PER_PAGE buttons and pad if needed
      const limitedSlice = slice.slice(0, ITEMS_PER_PAGE);
      if (limitedSlice.length < ITEMS_PER_PAGE) {
        return [...limitedSlice, ...new Array(ITEMS_PER_PAGE - limitedSlice.length).fill({
          shortName: '',
          longName: '',
          target: '',
          type: ButtonType.NONE,
          radioSiteIndex: 0,
          originalData: null
        })];
      }
      return limitedSlice;
    } else {
      // For other pages, return empty array padded to ITEMS_PER_PAGE
      return new Array(ITEMS_PER_PAGE).fill({
        shortName: '',
        longName: '',
        target: '',
        type: ButtonType.NONE,
        radioSiteIndex: 0,
        originalData: null
      });
    }
  }, [allExpandedButtons, page]);

  // Convert button data to grid format, handling guard frequency placement
  const buttons = useMemo(() => {
    // Separate Guard frequencies from regular frequencies
    const guardFreqs = currentSlice.filter(btn => 
      btn.type !== ButtonType.NONE && 
      (parseInt(btn.target) === 121500000 || parseInt(btn.target) === 243000000)
    );
    
    const regularFreqs = currentSlice.filter(btn => 
      btn.type === ButtonType.NONE || 
      (parseInt(btn.target) !== 121500000 && parseInt(btn.target) !== 243000000)
    );

    // Create a 4x3 grid (12 positions total) arranged column-wise
    const grid: any[] = new Array(ITEMS_PER_PAGE).fill(null);
    
    // Fill column-wise starting from top-left, filling vertically per column
    // Column 1: 0,3,6,9 | Column 2: 1,4,7,10 | Column 3: 2,5,8,11
    const columnOrder = [0, 3, 6, 9, 1, 4, 7, 10, 2, 5, 8, 11];
    
    // Place Guard frequencies in the last column (rightmost column, top to bottom)
    const guardPositions = [2, 5, 8, 11]; // Top-right, second-right, third-right, bottom-right
    let guardIndex = 0;
    
    for (const guardFreq of guardFreqs) {
      if (guardIndex < guardPositions.length) {
        const position = guardPositions[guardIndex];
        if (position !== undefined) {
          grid[position] = guardFreq;
        }
        guardIndex++;
      }
    }
    
    // Place regular frequencies in remaining positions, filling column-wise
    let regularIndex = 0;
    for (const pos of columnOrder) {
      if (grid[pos] === null && regularIndex < regularFreqs.length) {
        grid[pos] = regularFreqs[regularIndex];
        regularIndex++;
      }
    }
    
    // Fill any remaining positions with empty buttons
    for (let i = 0; i < ITEMS_PER_PAGE; i++) {
      if (grid[i] === null) {
        grid[i] = {
          shortName: '',
          longName: '',
          target: '',
          type: ButtonType.NONE,
          radioSiteIndex: 0,
          originalData: null
        };
      }
    }
    
    return grid;
  }, [currentSlice, page]);

  // Helper function to get A/G visual state
  const getAGState = (data: any) => {
    if (!data) return 'ag-unassigned';
    if (data.busy || data.status === 'busy') return 'ag-busy';
    if (data.talking) return 'ag-monitoring';
    if (data.r || data.t) return 'ag-active'; // Active if either RX or TX selected
    // When all buttons are off (no RX, no TX), return to unselected state (white background)
    return 'state-unselected';
  };

  // Handle sub-button clicks for TX, RX, and Headset
  const handleAGSubButtonClick = (freq: string, type: 'tx' | 'rx' | 'hs') => {
    if (!freq) return;
    
    // Find the button data from currentSlice - look in originalData
    const buttonObj = currentSlice.find((btn: any) => 
      btn && btn.originalData && (btn.originalData.freq === freq)
    );
    
    if (!buttonObj || !buttonObj.originalData) return;
    
    const buttonData = buttonObj.originalData;
    
    // Don't allow interaction with busy frequencies
    if (buttonData.busy || buttonData.status === 'busy') {
      console.log('Cannot interact with busy frequency:', freq);
      return;
    }
    
    // Send appropriate message based on button type and current state
    switch (type) {
      case 'tx':
        // Toggle TX selection (on/off)
        sendMsg({ type: 'tx', cmd1: '' + freq, dbl1: !buttonData.t });
        break;
      case 'rx':
        // RCVR behaves like radio button - if on, turn off and go back to unselected
        // If off, turn on
        sendMsg({ type: 'rx', cmd1: '' + freq, dbl1: !buttonData.r });
        break;
      case 'hs':
        // Toggle headset selection
        sendMsg({ type: 'set_hs', cmd1: '' + freq, dbl1: !buttonData.h });
        break;
    }
  };

  // Handle clicking on unselected frequency button - activates only RCVR
  const handleUnselectedFrequencyClick = (freq: string) => {
    if (!freq) return;
    
    // Find the button data from currentSlice - look in originalData
    const buttonObj = currentSlice.find((btn: any) => 
      btn && btn.originalData && (btn.originalData.freq === freq)
    );
    
    if (!buttonObj || !buttonObj.originalData) return;
    
    const buttonData = buttonObj.originalData;
    
    // Don't allow interaction with busy frequencies
    if (buttonData.busy || buttonData.status === 'busy') {
      console.log('Cannot interact with busy frequency:', freq);
      return;
    }
    
    // Turn on only RCVR when clicking unselected frequency (XMTR stays off)
    console.log('Activating frequency:', freq, 'turning on RCVR only');
    
    // Turn on RCVR only - user will manually turn on XMTR if needed
    sendMsg({ type: 'rx', cmd1: '' + freq, dbl1: true });
  };

  // Handle dynamic button states for A/G frequencies
  useEffect(() => {
    // For the new 3-button layout, we don't need to manipulate CSS classes
    // The state is handled directly in the React component via button data
    
    // We can keep this for any future dynamic styling needs
    // Currently the button states are managed by React state in the JSX
    
  }, [currentSlice, ag_status, buttons]);

  return (
    <div className="grid grid-cols-3 gap-y-2 gap-x-[17px]" style={{gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))'}}>
      {buttons.map((btn: any, i: number) => (
        <div key={i} className="ag-frequency-container">
          {btn.type !== ButtonType.NONE && (btn.originalData?.r || btn.originalData?.t) ? (
            // Assigned A/G frequency with active XMTR or RCVR - show frequency above buttons
            <>
              {/* Frequency header above the buttons */}
              <div className={`ag-freq-header ${
                (parseInt(btn.target) === 121500000 || parseInt(btn.target) === 243000000) ? 'guard-frequency' : ''
              }`}>
                {btn.shortName}
              </div>
              
              {/* Three sub-buttons container */}
              <div className={`ag-frequency-button ${getAGState(btn.originalData)}`}>
                <div className="ag-sub-buttons">
                  {/* XMTR ON/OFF button (left) */}
                  <button
                    className={`vscs-static-button ag-sub-button vscs-button ${
                      btn.originalData?.t ? (
                        ptt ? 'state-ptt-confirm' : 'active'
                      ) : ''
                    }`}
                    onClick={() => handleAGSubButtonClick(btn.target, 'tx')}
                  >
                    <div className="ag-sub-content">
                      <div className="ag-sub-text-container">
                        <span className="ag-sub-text">XMTR</span>
                        <span className="ag-sub-text">{btn.originalData?.t ? 'ON' : 'OFF'}</span>
                      </div>
                    </div>
                  </button>
                  
                  {/* Radio site button (center) with toggleable headphone/speaker icon - only active when RCVR is on */}
                  <button
                    className={`vscs-static-button ag-sub-button vscs-button ${!btn.originalData?.r ? 'disabled' : 'active'}`}
                    onClick={() => btn.originalData?.r ? handleAGSubButtonClick(btn.target, 'hs') : undefined}
                    disabled={!btn.originalData?.r}
                  >
                    <div className="ag-sub-content">
                      <span className="ag-sub-text">{btn.radioSite}</span>
                      <div className="ag-sub-icon">
                        {btn.originalData?.h ? <img src="/VSCSHeadsetIcon.bmp" alt="Headset" style={{ width: '40px', height: '30px' }} /> : <img src="/VSCSSpeakerIcon.bmp" alt="Speaker" style={{ width: '40px', height: '30px' }} />}
                      </div>
                    </div>
                  </button>
                  
                  {/* RCVR ON/OFF button (right) */}
                  <button
                    className={`vscs-static-button ag-sub-button vscs-button ${
                      btn.originalData?.talking ? 'state-squelch-active' : 
                      btn.originalData?.r ? 'active' : ''
                    }`}
                    onClick={() => handleAGSubButtonClick(btn.target, 'rx')}
                  >
                    <div className="ag-sub-content">
                      <div className="ag-sub-text-container">
                        <span className="ag-sub-text">RCVR</span>
                        <span className="ag-sub-text">{btn.originalData?.r ? 'ON' : 'OFF'}</span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </>
          ) : (
            // Unassigned button OR assigned frequency with both XMTR and RCVR off - show as unselected button without header
            <div className="ag-frequency-button" style={{ height: '78px' }}>
              <VscsButtonComponent
                config={btn.type !== ButtonType.NONE ? {
                  ...btn,
                  shortName: btn.shortName || 'UNSEL', // Show frequency on top line
                  longName: btn.radioSite || btn.longName || btn.shortName || 'UNSEL' // Show radio site on bottom line
                } : btn}
                typeString=""
                callback={btn.type !== ButtonType.NONE ? () => handleUnselectedFrequencyClick(btn.target) : undefined}
                className={`${btn.target} ${btn.type} vscs-button ag-button ${
                  btn.type !== ButtonType.NONE ? 'state-unselected cursor-pointer' : 'unassigned cursor-not-allowed'
                }${
                  // Add guard frequency styling for unselected guard frequencies (121.5 MHz, 243.0 MHz)
                  btn.type !== ButtonType.NONE && 
                  (parseInt(btn.target) === 121500000 || parseInt(btn.target) === 243000000) 
                    ? ' guard-frequency-unselected' : ''
                }${
                  // Add transmitting styling for unselected buttons with talking/PTT data (exclude guard frequencies)
                  btn.type !== ButtonType.NONE && btn.originalData && 
                  !(parseInt(btn.target) === 121500000 || parseInt(btn.target) === 243000000) ? (
                    btn.originalData.talking ? ' transmitting-flutter' : 
                    (btn.originalData.t || ptt) ? ' transmitting' : ''
                  ) : ''
                }`}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}