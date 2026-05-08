'use client';
import { useEffect } from 'react';
import VscsComponent from '../_components/vatlines/vscs';
import { Configuration, ButtonType } from '../_components/vatlines/types';
import { useCoreStore } from '~/model';
import { loadAllFacilities } from '~/lib/facilityLoader';

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

  useEffect(() => {
    // Always use the full merged data so findDialCodeTable can traverse
    // ancestor facilities (e.g. NCT.dialCodeTable for SJC_TWR)
    loadAllFacilities().then(({ merged }) => {
      setPosData(merged);
    }).catch(() => {
      // Fallback to ZOA only
      fetch('/zoa_position.json')
        .then(r => r.json())
        .then(data => setPosData(data));
    });
  }, [setPosData]);
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