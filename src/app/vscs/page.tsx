'use client';
import { useEffect } from 'react';
import VscsComponent from '../_components/vatlines/vscs';
import { Configuration, ButtonType } from '../_components/vatlines/types';
import { useCoreStore } from '~/model';
import { loadAllFacilities, findPositionByCallsign } from '~/lib/facilityLoader';

// Mock configuration based on example-config.json structure
const mockConfiguration: Configuration = {
  id: 'mock-config',
  name: 'Mock VSCS Configuration',
  layouts: [
    {
      order: 0,
      button: {
        shortName: 'LC1',
        longName: 'Local Control 1',
        target: 'LC1',
  type: ButtonType.RING,
        dialCode: '5001'
      }
    },
    {
      order: 1,
      button: {
        shortName: 'LC2',
        longName: 'Local Control 2',
        target: 'LC2',
  type: ButtonType.OVERRIDE,
        dialCode: '5002'
      }
    },
    // Add more buttons as needed...
  ]
};

export default function VscsPage() {
  const setPosData = useCoreStore((s: any) => s.setPositionData);
  const callsign = useCoreStore((s: any) => s.callsign);

  useEffect(() => {
    // Load all facilities and find the one containing the current position
    loadAllFacilities().then(({ merged }) => {
      if (callsign) {
        const result = findPositionByCallsign(merged, callsign);
        if (result?.facility) {
          setPosData(result.facility);
          return;
        }
      }
      // Fallback to full merged data
      setPosData(merged);
    }).catch(() => {
      // Fallback to ZOA only
      fetch('/zoa_position.json')
        .then(r => r.json())
        .then(data => setPosData(data));
    });
  }, [setPosData, callsign]);
  return (
    <div className="min-h-screen bg-zinc-700 p-4">
      <VscsComponent
        activeLandlines={[]}
        incomingLandlines={[]}
        outgoingLandlines={[]}
        heldLandlines={[]}
        config={mockConfiguration}
        buttonPress={() => {}}
        holdBtn={() => {}}
        toggleGg={() => {}}
        ggLoud={false}
        toggleOver={() => {}}
        overrideLoud={false}
        releaseBtn={() => {}}
        settingsEdit={() => {}}
        volume={{
          volume: 50,
          setVolume: () => {},
        }}
        playError={() => {}}
        metadata={{
          position: 'VSCS Demo',
          sector: 'DEMO',
          facilityId: 'TEST',
        }}
      />
    </div>
  );
}