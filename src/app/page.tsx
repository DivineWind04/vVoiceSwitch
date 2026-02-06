
"use client";

import { useState, useEffect, useRef } from 'react';
import { useCoreStore } from '../model';
import VscsComponent from '../app/_components/vatlines/vscs';
import ETVSWrapper from '../components/ETVSWrapper';
import STVSWrapper from '../components/STVSWrapper';
import IVSRPage from './ivsr/page';
import RDVSWrapper from '../components/RDVSWrapper';
import LSTARWrapper from '../components/LSTARWrapper';
import SettingModal from '../pages/setting';
import { Alert } from 'antd';
import { loadAllFacilities, SUPPORTED_FACILITIES } from '../lib/facilityLoader';
import { autoDetectPosition } from '../lib/vatsimController';
import TestBenchIcon from '../testbench/TestBenchIcon';

export default function Page() {
  const [settingModal, setSettingModal] = useState(false);
  const [uiLoaded, setUiLoaded] = useState(false);
  const [loadedFacilities, setLoadedFacilities] = useState<string[]>([]);
  const [autoDetectStatus, setAutoDetectStatus] = useState<'idle' | 'detecting' | 'success' | 'failed'>('idle');
  const [autoDetectError, setAutoDetectError] = useState<string | null>(null);
  const autoDetectAttempted = useRef<string | null>(null); // Track "cid:callsign" we've attempted
  
  const currentUI = useCoreStore(s => s.currentUI);
  const selectedPositions = useCoreStore(s => s.selectedPositions);
  const connected = useCoreStore(s => s.connected);
  const setPositionData = useCoreStore(s => s.setPositionData);
  const positionData = useCoreStore(s => s.positionData);
  const callsign = useCoreStore(s => s.callsign);
  const cid = useCoreStore(s => s.cid);
  const afv_version = useCoreStore(s => s.afv_version);
  const updateSelectedPositions = useCoreStore(s => s.updateSelectedPositions);
  const setCurrentUI = useCoreStore(s => s.setCurrentUI);
  const [versionAlert, setVersionAlert] = useState<any>(null);
  const [isLocalhost, setIsLocalhost] = useState(false);

  // Detect localhost for test bench access
  useEffect(() => {
    const hostname = window.location.hostname;
    setIsLocalhost(
      hostname === 'localhost' || hostname === '127.0.0.1' ||
      hostname === '[::1]' || hostname === '0.0.0.0'
    );
  }, []);

  // Load JSON data and version info on component mount
  useEffect(() => {
    // Load position data from ALL facilities
    const loadPositionData = async () => {
      try {
        const { merged, loaded, failed } = await loadAllFacilities();
        console.log('Loaded facilities:', loaded);
        if (failed.length > 0) {
          console.warn('Failed to load:', failed);
        }
        setLoadedFacilities(loaded);
        setPositionData(merged);
      } catch (error) {
        console.error('Failed to load position data:', error);
        // Fallback to ZOA only if multi-load fails
        try {
          const response = await fetch('/zoa_position.json');
          const data = await response.json();
          setPositionData(data);
          setLoadedFacilities(['ZOA']);
        } catch (fallbackError) {
          console.error('Fallback load also failed:', fallbackError);
        }
      }
    };

    // Load version info
    const loadVersionInfo = async () => {
      try {
        console.log('Loading version info, current afv_version:', afv_version);
        const response = await fetch('/html_app/afv_poc/patch/version.json');
        const version_data = await response.json();
        console.log('Loaded version data:', version_data);
        const latest_version = parseFloat(version_data.latest_version);
        const current_version = parseFloat(afv_version || '1.0.0'); // Default to 1.0.0 if no version
        const lowest_allowable_version = parseFloat(version_data.lowest_allowable_version);
        console.log('Version comparison:', { latest_version, current_version, lowest_allowable_version });
        
        if (current_version < lowest_allowable_version) {
          version_data.must_upgrade = true;
        }
        const shouldShowAlert = latest_version > current_version;
        console.log('Should show alert:', shouldShowAlert);
        setVersionAlert(shouldShowAlert ? version_data : null);
      } catch (error) {
        console.error('Failed to load version info:', error);
      }
    };

    // Always load the data to ensure it's available
    loadPositionData();
    loadVersionInfo(); // Always run version check
  }, [setPositionData, afv_version]);

  // Auto-detect position from VATSIM when connected with CID/callsign
  useEffect(() => {
    // Create a key from CID and callsign to track what we've attempted
    const attemptKey = `${cid}:${callsign}`;
    
    // Don't run if already detecting
    if (autoDetectStatus === 'detecting') return;
    
    // Wait for all required data
    if (!connected) return;
    if (!cid || cid === 0) return;
    if (!callsign) return;
    if (!positionData || !positionData.id) return;
    
    // Only attempt auto-detection once per CID+callsign combination
    if (autoDetectAttempted.current === attemptKey) return;
    
    const performAutoDetect = async () => {
      autoDetectAttempted.current = attemptKey;
      setAutoDetectStatus('detecting');
      setAutoDetectError(null);
      
      try {
        const result = await autoDetectPosition(cid, callsign, positionData);
        
        if (result && result.position) {
          updateSelectedPositions([result.position]);
          setCurrentUI(result.ui);
          setAutoDetectStatus('success');
        } else if (result && !result.position && result.controller) {
          setCurrentUI(result.ui);
          setAutoDetectStatus('failed');
          setAutoDetectError('Position not found in local configuration. Please select manually.');
        } else {
          setAutoDetectStatus('failed');
          setAutoDetectError('Could not find your position in VATSIM data. Please select manually.');
        }
      } catch (error) {
        console.error('[AutoDetect] Error:', error);
        setAutoDetectStatus('failed');
        setAutoDetectError('Error detecting position. Please select manually.');
      }
    };
    
    performAutoDetect();
  }, [connected, cid, callsign, positionData, updateSelectedPositions, setCurrentUI, autoDetectStatus]);

  // Function to retry auto-detection
  const retryAutoDetect = async () => {
    if (!connected || !cid || cid === 0 || !callsign || !positionData) return;
    
    setAutoDetectStatus('detecting');
    setAutoDetectError(null);
    
    try {
      const result = await autoDetectPosition(cid, callsign, positionData);
      
      if (result && result.position) {
        updateSelectedPositions([result.position]);
        setCurrentUI(result.ui);
        setAutoDetectStatus('success');
      } else if (result && !result.position && result.controller) {
        setCurrentUI(result.ui);
        setAutoDetectStatus('failed');
        setAutoDetectError('Position not found in local configuration. Please select manually.');
      } else {
        setAutoDetectStatus('failed');
        setAutoDetectError('Could not find your position in VATSIM data. Please select manually.');
      }
    } catch (error) {
      console.error('[AutoDetect] Error:', error);
      setAutoDetectStatus('failed');
      setAutoDetectError('Error detecting position. Please select manually.');
    }
  };

  // Track when UI should be considered "loaded"
  useEffect(() => {
    if ((connected || isLocalhost) && selectedPositions && selectedPositions.length > 0 && currentUI) {
      // Add a small delay to ensure UI components have time to mount
      const timer = setTimeout(() => {
        setUiLoaded(true);
      }, 500); // Half second delay for UI to initialize

      return () => clearTimeout(timer);
    } else {
      setUiLoaded(false);
    }
  }, [connected, isLocalhost, selectedPositions, currentUI]);

  // VSCS Zustand state mapping
  const activeLandlines = useCoreStore(s => s.activeLandlines || []);
  const incomingLandlines = useCoreStore(s => s.incomingLandlines || []);
  const outgoingLandlines = useCoreStore(s => s.outgoingLandlines || []);
  const heldLandlines = useCoreStore(s => s.heldLandlines || []);
  const config = useCoreStore(s => s.currentConfig || {});
  const buttonPress = useCoreStore(s => s.buttonPress || (() => {}));
  const holdBtn = useCoreStore(s => s.holdBtn || (() => {}));
  const releaseBtn = useCoreStore(s => s.releaseBtn || (() => {}));
  const toggleGg = useCoreStore(s => s.toggleGg || (() => {}));
  const toggleOver = useCoreStore(s => s.toggleOver || (() => {}));
  const ggLoud = useCoreStore(s => s.ggLoud || false);
  const overrideLoud = useCoreStore(s => s.overrideLoud || false);
  const settingsEdit = useCoreStore(s => s.settingsEdit || (() => {}));
  const volume = useCoreStore(s => s.volume || { volume: 50, setVolume: () => {} });
  const playError = useCoreStore(s => s.playError || (() => {}));
  const metadata = useCoreStore(s => s.metadata || { position: '', sector: '', facilityId: '' });

  const renderUI = () => {
    // Handle custom RDVS layouts (any string starting with 'rdvs-')
    if (currentUI?.startsWith('rdvs-') || currentUI === 'rdvs') {
      const variant = currentUI === 'rdvs' ? 'default' : currentUI;
      return <RDVSWrapper variant={variant} />;
    }

    switch (currentUI) {
      case 'etvs':
        return <ETVSWrapper />;
      case 'stvs':
        return <STVSWrapper />;
      case 'ivsr':
        return <IVSRPage />;
      case 'lstar':
        return <LSTARWrapper />;
      case 'vscs':
      default:
        return (
          <VscsComponent
            activeLandlines={activeLandlines}
            incomingLandlines={incomingLandlines}
            outgoingLandlines={outgoingLandlines}
            heldLandlines={heldLandlines}
            config={config}
            buttonPress={buttonPress}
            holdBtn={holdBtn}
            releaseBtn={releaseBtn}
            toggleGg={toggleGg}
            toggleOver={toggleOver}
            ggLoud={ggLoud}
            overrideLoud={overrideLoud}
            settingsEdit={settingsEdit}
            volume={volume}
            playError={playError}
            metadata={metadata}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-zinc-700 p-4">
      {/* Version Alert */}
      {versionAlert && (
        <Alert 
          type={versionAlert?.must_upgrade ? "error" : "warning"} 
          style={{ marginBottom: 10 }} 
          closable={!versionAlert?.must_upgrade}
          onClose={() => setVersionAlert(null)} 
          showIcon 
          message={
            <>
              Latest AFV version {versionAlert.latest_version} is available.
              {afv_version ? ` Your current version is: ${afv_version}.` : null}
              {versionAlert?.must_upgrade ? ` Lowest usable version is ${versionAlert.lowest_allowable_version}, you must at least update to that version.` : ""}
              <br />
              Download Link: <a href={versionAlert.link?.windows} target='_blank'>[Windows]</a> <a href={versionAlert.link?.macos} target='_blank'>[macOS]</a>
            </>
          } 
        />
      )}
      
      {!connected && !isLocalhost ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center text-white">
            <h2 className="text-2xl font-bold mb-4">AFV Client</h2>
            <p className="text-lg text-zinc-300">Not Connected</p>
          </div>
        </div>
      ) : !selectedPositions || selectedPositions.length === 0 || !uiLoaded ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center text-white">
            <h2 className="text-2xl font-bold mb-4">Welcome to AFV Client</h2>
            
            {/* Auto-detection status */}
            {autoDetectStatus === 'detecting' && (
              <div className="mb-6">
                <div className="animate-spin inline-block w-6 h-6 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                <span className="text-zinc-300">Detecting your position from VATSIM...</span>
              </div>
            )}
            
            {autoDetectStatus === 'failed' && autoDetectError && (
              <div className="mb-6">
                <p className="text-yellow-400 mb-2">{autoDetectError}</p>
              </div>
            )}
            
            <p className="text-lg text-zinc-300 mb-6">
              {autoDetectStatus === 'detecting' 
                ? "Looking up your position..."
                : (!selectedPositions || selectedPositions.length === 0 
                  ? "Please select a position to continue"
                  : "Loading interface..."
                )
              }
            </p>
            
            {/* Show CID/callsign info if available */}
            {cid !== 0 && (
              <p className="text-sm text-zinc-400 mb-4">
                Connected as: CID {cid}{callsign ? ` (${callsign})` : ''}
              </p>
            )}
            
            {(!selectedPositions || selectedPositions.length === 0) && autoDetectStatus !== 'detecting' && (
              <div className="flex gap-4 justify-center">
                {/* Retry auto-detect button (only show if we have CID) */}
                {cid !== 0 && autoDetectStatus === 'failed' && (
                  <button 
                    onClick={retryAutoDetect}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Retry Auto-Detect
                  </button>
                )}
                
                <button 
                  onClick={() => setSettingModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Select Position Manually
                </button>
              </div>
            )}
          </div>
        </div>
      ) : versionAlert?.must_upgrade ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center text-white">
            <h2 className="text-2xl font-bold mb-4">Update Required</h2>
            <p className="text-lg text-zinc-300">Please update your AFV client to continue.</p>
          </div>
        </div>
      ) : (
        renderUI()
      )}
      <SettingModal open={settingModal} setModal={setSettingModal} />
      <TestBenchIcon />
    </div>
  );
}