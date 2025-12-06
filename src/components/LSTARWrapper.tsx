// LSTAR Wrapper Component
import React, { useEffect, useState } from 'react';
import { useCoreStore } from '../model';
import LstarButtonComponent from '../app/_components/vatlines/lstar_button';
import { getLstarButtonPattern } from './lstarButtonPatterns';

export default function LSTARWrapper() {
  // Get state from store
  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  const positionData = useCoreStore((s: any) => s.positionData);
  const selectedPositions = useCoreStore((s: any) => s.selectedPositions);
  const gg_status = useCoreStore((s: any) => s.gg_status);
  const ag_status = useCoreStore((s: any) => s.ag_status);
  
  // Local state for radio controls (no longer needed for TX/RX since we use WebSocket data directly)
  const [selectedFrequency, setSelectedFrequency] = useState<string | null>(null);

  // Get current position data for LSTAR
  const currentPosition = selectedPositions && selectedPositions.length > 0 ? selectedPositions[0] : null;
  
  // Sample button configurations based on the reference image
  const lstarButtons = [
    // Top row - GW ROLES section
    { id: 'gw-roles', name: 'GW ROLES', variant: 'standard', width: 240, height: 80, type: 'GW_ROLES' },
    
    // Priority buttons (now square)
    { id: 'prio', name: 'PRIO', variant: 'priority', width: 90, height: 80, type: 'PRIORITY' },
    { id: 'util', name: 'UTIL', variant: 'standard', width: 90, height: 80, type: 'UTILITY' },
    { id: 'CHIME', name: 'CHIME\nON', variant: 'standard', width: 90, height: 80, type: 'CHIME' },
    { id: 'ops2', name: 'OPS\nTWO', variant: 'standard', width: 90, height: 80, type: 'OPS_TWO' },
    { id: 'team', name: 'TEAM\nPICKUP', variant: 'standard', width: 90, height: 80, type: 'TEAM_PICKUP' },
    { id: 'role', name: 'ROLE\nSELECT', variant: 'standard', width: 90, height: 80, type: 'ROLE_SELECT' },
    
    // Left side - Air-Ground section
    { id: 'ag', name: 'AG', variant: 'standard', width: 60, height: 30, type: 'AG' },
    
    // Note: Frequency buttons are now populated from WebSocket ag_status data
    
    // System status and controls
    { id: 'gg1', name: 'G/G 1', variant: 'system', width: 90, height: 60, type: 'GG_1' },
    { id: 'system-status', name: 'System\nStatus', variant: 'system', width: 90, height: 60, type: 'SYSTEM_STATUS' },
    { id: 'radio-off', name: 'Radio\nOFF', variant: 'system', width: 90, height: 40, type: 'RADIO_OFF' },
    
    // Bottom controls
    { id: 'mic-mute', name: 'MIC\nMUTE', variant: 'standard', width: 90, height: 40, type: 'MIC_MUTE' },
    { id: 'ls-off', name: 'LS\nOFF', variant: 'standard', width: 90, height: 40, type: 'LS_OFF' },
  ];

  // Button click handler
  const handleButtonClick = (target: string, type: string) => {
    console.log('LSTAR button clicked:', target, type);
    
    // Send WebSocket message similar to other UIs
    if (sendMsg) {
      sendMsg({
        type: 'lstar_button',
        target: target,
        buttonType: type,
        position: currentPosition?.cs || ''
      });
    }
  };

  // TX button click handler - send WebSocket message like VSCS
  const handleTxClick = (frequencyId: string) => {
    if (sendMsg && frequencyId) {
      // Find the AG data for this frequency
      const agData = ag_status.find((ag: any) => ag.freq && ag.freq.toString() === frequencyId);
      if (agData) {
        console.log('LSTAR TX clicked:', { freq: frequencyId, currentTx: agData.t, newTx: !agData.t });
        sendMsg({ type: 'tx', cmd1: frequencyId, dbl1: !agData.t });
      }
    }
  };

  // RX button click handler - send WebSocket message like VSCS  
  const handleRxClick = (frequencyId: string) => {
    if (sendMsg && frequencyId) {
      // Find the AG data for this frequency
      const agData = ag_status.find((ag: any) => ag.freq && ag.freq.toString() === frequencyId);
      if (agData) {
        console.log('LSTAR RX clicked:', { freq: frequencyId, currentRx: agData.r, newRx: !agData.r });
        sendMsg({ type: 'rx', cmd1: frequencyId, dbl1: !agData.r });
      }
    }
  };

  return (
    <div 
      className="w-full h-screen bg-gray-900 flex items-center justify-center"
      style={{
        fontFamily: 'Arial, sans-serif',
        backgroundImage: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
      }}
    >
      {/* Fixed-sized LSTAR container */}
      <div 
        className="bg-black border-4 border-gray-950 rounded-lg relative"
        style={{
          width: '1100px',
          height: '730px',
          padding: '20px'
        }}
      >
        
        {/* Top Section - GW ROLES and control buttons */}
        <div className="flex gap-4 mb-2 items-start">
          {/* GW ROLES header - left side */}
          <div>
            <LstarButtonComponent
              config={{
                id: 'gw-roles',
                name: 'GW ROLES',
                shortName: 'GW ROLES',
                target: 'gw-roles',
                type: 'GW_ROLES',
                width: 380,
                height: 80
              }}
              buttonPattern={getLstarButtonPattern('GW_ROLES')}
              variant="standard"
              callback={handleButtonClick}
            />
          </div>
          
          {/* Control buttons grid - right side, single row */}
          <div className="flex -ml-3 gap-0.5">
            <LstarButtonComponent
              config={{
                id: 'prio',
                name: 'PRIO',
                shortName: 'PRIO',
                target: 'prio',
                type: 'PRIORITY',
                width: 90,
                height: 80
              }}
              buttonPattern={getLstarButtonPattern('PRIORITY')}
              variant="priority"
              callback={handleButtonClick}
            />
            <LstarButtonComponent
              config={{
                id: 'util',
                name: 'UTIL',
                shortName: 'UTIL',
                target: 'util',
                type: 'UTILITY',
                width: 90,
                height: 80
              }}
              variant="standard"
              callback={handleButtonClick}
            />
            <LstarButtonComponent
              config={{
                id: 'CHIME',
                name: 'CHIME\nON',
                shortName: 'CHIME ON',
                target: 'CHIME',
                type: 'CHIME',
                width: 90,
                height: 80
              }}
              variant="standard"
              callback={handleButtonClick}
            />
            <LstarButtonComponent
              config={{
                id: 'ops2',
                name: 'OPS\nTWO',
                shortName: 'OPS TWO',
                target: 'ops2',
                type: 'OPS_TWO',
                width: 90,
                height: 80
              }}
              variant="standard"
              callback={handleButtonClick}
            />
            <LstarButtonComponent
              config={{
                id: 'team',
                name: 'TEAM\nPICKUP',
                shortName: 'TEAM PICKUP',
                target: 'team',
                type: 'TEAM_PICKUP',
                width: 90,
                height: 80
              }}
              variant="standard"
              callback={handleButtonClick}
            />
            <LstarButtonComponent
              config={{
                id: 'role',
                name: 'ROLE\nSELECT',
                shortName: 'ROLE SELECT',
                target: 'role',
                type: 'ROLE_SELECT',
                width: 90,
                height: 80
              }}
              variant="standard"
              callback={handleButtonClick}
            />
          </div>
          
          {/* Triangle button - top right */}
          <div className="flex items-center justify-center">
            <LstarButtonComponent
              config={{
                id: 'triangle-top',
                name: '',
                shortName: '',
                target: 'triangle-top',
                type: 'TRIANGLE',
                width: 80,
                height: 60
              }}
              variant="triangle"
              callback={handleButtonClick}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex gap-6">
          
          {/* Left Column - AG and Frequency Controls */}
          <div className="flex flex-col gap-2" style={{
            minWidth: '300px',
            maxWidth: '300px',
            zoom: 1,
            transform: 'scale(1)',
            transformOrigin: 'top left'
          }}>
            {/* AG Section */}
            <div className="mb-1">
              <LstarButtonComponent
                config={{
                  id: 'ag',
                  name: 'AG',
                  shortName: 'AG',
                  target: 'ag',
                  type: 'AG',
                  width: 90,
                  height: 80
                }}
                buttonPattern={getLstarButtonPattern('GG_1', 'active')}
                variant="standard"
                callback={handleButtonClick}
              />
            </div>

            {/* Frequency Buttons - populated from WebSocket ag_status */}
            <div className="flex flex-col gap-0" style={{
              minWidth: '275px',
              maxWidth: '275px', 
              zoom: 1,
              transform: 'scale(1)',
              transformOrigin: 'top left'
            }}>
              {/* First 6 frequencies from ag_status stacked vertically */}
              {ag_status.slice(0, 6).map((agData: any, idx: number) => {
                if (!agData || !agData.freq) {
                  // Empty slot
                  return (
                    <div key={`empty-${idx}`} style={{ marginBottom: '1px' }}>
                      <LstarButtonComponent
                        config={{
                          id: `freq-empty-${idx}`,
                          name: '-------',
                          frequency: '-------',
                          shortName: '-------',
                          target: '',
                          type: 'FREQUENCY',
                          width: 275,
                          height: idx < 3 ? 40 : 60
                        }}
                        buttonPattern={getLstarButtonPattern('FREQUENCY')}
                        variant={idx < 3 ? "frequency" : "frequency-simple"}
                        txActive={false}
                        rxActive={false}
                        onTxClick={() => {}}
                        onRxClick={() => {}}
                        callback={handleButtonClick}
                      />
                    </div>
                  );
                }
                
                // Format frequency for display
                const freq = (agData.freq / 1000000).toFixed(3);
                
                return (
                  <div key={agData.freq} style={{ marginBottom: '1px' }}>
                    <LstarButtonComponent
                      config={{
                        id: `freq-${agData.freq}`,
                        name: freq,
                        frequency: freq,
                        shortName: freq,
                        target: agData.freq.toString(),
                        type: 'FREQUENCY',
                        width: 275,
                        height: idx < 3 ? 40 : 60 // First 3 are shorter, last 3 are taller
                      }}
                      buttonPattern={getLstarButtonPattern('FREQUENCY')}
                      variant={idx < 3 ? "frequency" : "frequency-simple"}
                      txActive={!!agData.t} // Use WebSocket TX state
                      rxActive={!!agData.r} // Use WebSocket RX state
                      onTxClick={() => handleTxClick(agData.freq.toString())}
                      onRxClick={() => handleRxClick(agData.freq.toString())}
                      callback={handleButtonClick}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column - System Status */}
          <div className="flex ml-16 flex-col gap-2">
            {/* Top row with G/G1 and System Status side by side */}
            <div className="flex gap-0.5">
              <LstarButtonComponent
                config={{
                  id: 'gg1',
                  name: 'G/G 1',
                  shortName: 'G/G 1',
                  target: 'gg1',
                  type: 'GG_1',
                  width: 90,
                  height: 80
                }}
                buttonPattern={getLstarButtonPattern('GG_1', 'active')}
                variant="system"
                systemStatus="active"
                callback={handleButtonClick}
              />
              <LstarButtonComponent
                config={{
                  id: 'system-status',
                  name: 'System\nStatus',
                  shortName: 'System Status',
                  target: 'system-status',
                  type: 'SYSTEM_STATUS',
                  width: 90,
                  height: 80
                }}
                buttonPattern={getLstarButtonPattern('SYSTEM_STATUS', 'active')}
                variant="system"
                systemStatus="active"
                callback={handleButtonClick}
              />
            </div>
            <LstarButtonComponent
              config={{
                id: 'radio-off',
                name: 'Radio\nOFF',
                shortName: 'Radio OFF',
                target: 'radio-off',
                type: 'RADIO_OFF',
                width: 90,
                height: 80
              }}
              buttonPattern={getLstarButtonPattern('RADIO_OFF')}
              variant="system"
              systemStatus="inactive"
              callback={handleButtonClick}
            />
          </div>
        </div>
        
        {/* Bottom Bar - absolutely positioned at bottom of container */}
        <div className="absolute bottom-4 left-4 flex gap-2 items-end">
          {/* Bottom Controls */}
          <div className="flex ml-1 gap-0.5">
            <LstarButtonComponent
              config={{
                id: 'mic',
                name: 'MIC',
                shortName: 'MIC',
                target: 'mic',
                type: 'MIC',
                width: 90,
                height: 80,
                bgColor: '#526262'
              }}
              variant="standard"
              callback={handleButtonClick}
            />
            <LstarButtonComponent
              config={{
                id: 'ls',
                name: 'LS',
                shortName: 'LS',
                target: 'ls',
                type: 'LS',
                width: 90,
                height: 80,
                bgColor: '#526262'
              }}
              variant="standard"
              callback={handleButtonClick}
            />
            <LstarButtonComponent
              config={{
                id: 'site-group',
                name: 'SITE\\nGROUP',
                shortName: 'SITE GROUP',
                target: 'site-group',
                type: 'SITE_GROUP',
                width: 90,
                height: 80,
                bgColor: '#526262'
              }}
              variant="standard"
              callback={handleButtonClick}
            />
          </div>
          
          {/* Triangle and long bar */}
          <LstarButtonComponent
            config={{
              id: 'triangle-bottom',
              name: '',
              shortName: '',
              target: 'triangle-bottom',
              type: 'TRIANGLE_BOTTOM',
              width: 150,
              height: 150
            }}
            variant="triangle"
            callback={handleButtonClick}
          />
          <LstarButtonComponent
            config={{
              id: 'bottom-bar',
              name: '',
              label: '',
              shortName: '',
              target: 'bottom-bar',
              type: 'BOTTOM_BAR',
              width: 360,
              height: 80
            }}
            variant="long-bar"
            callback={handleButtonClick}
          />
          <LstarButtonComponent
            config={{
              id: 'end-call',
              name: 'End\\nCall',
              shortName: 'End Call',
              target: 'end-call',
              type: 'END_CALL',
              width: 90,
              height: 80,
              bgColor: '#bac4bd'
            }}
            variant="standard"
            callback={handleButtonClick}
          />
        </div>
      </div>
    </div>
  );
}