
"use client";

import { useState, useEffect } from 'react';
import { useCoreStore } from '../model';
import VscsComponent from '../app/_components/vatlines/vscs';
import ETVSWrapper from '../components/ETVSWrapper';
import STVSWrapper from '../components/STVSWrapper';
import IVSRPage from './ivsr/page';
import RDVSWrapper from '../components/RDVSWrapper';
import LSTARWrapper from '../components/LSTARWrapper';
import SettingModal from '../pages/setting';
import { Alert } from 'antd';

export default function Page() {
  const [settingModal, setSettingModal] = useState(false);
  const [uiLoaded, setUiLoaded] = useState(false);
  const currentUI = useCoreStore(s => s.currentUI);
  const selectedPositions = useCoreStore(s => s.selectedPositions);
  const connected = useCoreStore(s => s.connected);
  const setPositionData = useCoreStore(s => s.setPositionData);
  const positionData = useCoreStore(s => s.positionData);
  const callsign = useCoreStore(s => s.callsign);
  const afv_version = useCoreStore(s => s.afv_version);
  const [versionAlert, setVersionAlert] = useState<any>(null);

  // Load JSON data and version info on component mount
  useEffect(() => {
    // Load position data - store the FULL JSON structure for settings modal
    const loadPositionData = async () => {
      try {
        const response = await fetch('/zoa_position.json');
        const data = await response.json();
        console.log('Loaded position data:', data);
        // Store the complete data structure, not filtered
        setPositionData(data);
      } catch (error) {
        console.error('Failed to load position data:', error);
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

  // Track when UI should be considered "loaded"
  useEffect(() => {
    if (connected && selectedPositions && selectedPositions.length > 0 && currentUI) {
      // Add a small delay to ensure UI components have time to mount
      const timer = setTimeout(() => {
        setUiLoaded(true);
      }, 500); // Half second delay for UI to initialize
      
      return () => clearTimeout(timer);
    } else {
      setUiLoaded(false);
    }
  }, [connected, selectedPositions, currentUI]);

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
    switch (currentUI) {
      case 'etvs':
        return <ETVSWrapper />;
      case 'stvs':
        return <STVSWrapper />;
      case 'ivsr':
        return <IVSRPage />;
      case 'rdvs':
        return <RDVSWrapper />;
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
      
      {!connected ? (
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
            <p className="text-lg text-zinc-300 mb-6">
              {!selectedPositions || selectedPositions.length === 0 
                ? "Please select a position to continue"
                : "Loading interface..."
              }
            </p>
            {(!selectedPositions || selectedPositions.length === 0) && (
              <button 
                onClick={() => setSettingModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Settings
              </button>
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
    </div>
  );
}