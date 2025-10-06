'use client';
import { useEffect } from 'react';
import axios from 'axios';
import VscsComponent from '../_components/vatlines/vscs';
import { Configuration } from '../_components/vatlines/App';
import { useCoreStore } from '~/model';

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
        type: 'RING' as any,
        dialCode: '5001'
      }
    },
    {
      order: 1,
      button: {
        shortName: 'LC2',
        longName: 'Local Control 2',
        target: 'LC2',
        type: 'OVERRIDE' as any,
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
    function find(stp: any, found: boolean): any {
      if (!stp) return null;
      if (Array.isArray(stp.positions)) {
        for (const e of stp.positions) {
          if (e.cs === callsign) {
            return stp;
          }
        }
      }
      if (Array.isArray(stp.childFacilities)) {
        for (const k of stp.childFacilities) {
          const f = find(k, found);
          if (f) return f;
        }
      }
      return null;
    }
    
    axios.get('/zoa_position.json').then(r => {
      const prod = find(r.data, false);
      setPosData(prod || r.data); // Use the full data if find doesn't return anything
    }).catch(() => {
      // Optionally handle error
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