"use client";
import "../styles/globals.css";
import Link from "next/link";
import Image from "next/image";
import AirGroundPage from "./_components/air_ground/AirGroundPage";
import GroundGroundPage from "./_components/ground_ground/GroundGroundPage";
import AreaThree from "./_components/special_func/AreaThree";
import StatusArea from "./_components/status/StatusArea";
import AreaFour from "./_components/special_func/AreaFour";
import SettingModal from '../../src/pages/setting';
import { useState, useEffect } from "react";
import axios from "axios";
import { useCoreStore } from '../model';
import { isReliefCallsign } from '../../src/lib/facilityLoader';

// VATSIM controllers feed URL (proxied through API to avoid CORS)
const VATSIM_CONTROLLERS_URL = '/api/vatsim/controllers';

export default function HomePage() {
  const [isGG3Active, setIsGG3Active] = useState(false);
  const [currentGGPage, setCurrentGGPage] = useState(1);
  const [settingModal, setSettingModal] = useState(false);
  const setPosData = require('../model').useCoreStore((s: any) => s.setPositionData);
  const updateSelectedPositions = useCoreStore((s: any) => s.updateSelectedPositions);
  const callsign = useCoreStore((s: any) => s.callsign);
  const cid = useCoreStore((s: any) => s.cid);
  const [filteredPosition, setFilteredPosition] = useState<any>(null);

  useEffect(() => {
    // Collect all positions matching this callsign from the facility tree
    function findAllPositions(stp: any): any[] {
      const results: any[] = [];
      if (!stp) return results;
      if (Array.isArray(stp.positions)) {
        for (const e of stp.positions) {
          if (e.cs === callsign || isReliefCallsign(callsign, e.cs)) {
            results.push({ facility: stp, position: e });
          }
        }
      }
      if (Array.isArray(stp.childFacilities)) {
        for (const k of stp.childFacilities) {
          results.push(...findAllPositions(k));
        }
      }
      return results;
    }

    // Find the facility that contains the matching position
    function findFacility(stp: any): any {
      if (!stp) return null;
      if (Array.isArray(stp.positions)) {
        for (const e of stp.positions) {
          if (e.cs === callsign || isReliefCallsign(callsign, e.cs)) return stp;
        }
      }
      if (Array.isArray(stp.childFacilities)) {
        for (const k of stp.childFacilities) {
          const f = findFacility(k);
          if (f) return f;
        }
      }
      return null;
    }

    if (!callsign) return;

    axios.get('/zoa_position.json').then(async (r) => {
      const facility = findFacility(r.data);
      setPosData(facility);

      // Find all positions matching this callsign
      const matches = findAllPositions(r.data);
      
      if (matches.length === 0) return;
      
      if (matches.length === 1) {
        // Only one match — use it directly
        updateSelectedPositions([matches[0].position]);
        return;
      }
      
      // Multiple positions share this callsign — disambiguate via VATSIM feed
      try {
        const feedRes = await axios.get(VATSIM_CONTROLLERS_URL);
        const feed = feedRes.data;
        if (feed?.controllers) {
          const cidStr = String(cid);
          const controller = feed.controllers.find((c: any) => c.vatsimData?.cid === cidStr);
          if (controller) {
            const primaryPos = controller.positions?.find((p: any) => p.isPrimary);
            const positionName = primaryPos?.positionName;
            if (positionName) {
              // Match VATSIM positionName against the "pos" field in config
              const disambiguated = matches.find((m: any) => m.position.pos === positionName);
              if (disambiguated) {
                updateSelectedPositions([disambiguated.position]);
                return;
              }
            }
            // Try frequency-based disambiguation
            const freq = controller.vatsimData?.primaryFrequency;
            if (freq) {
              const byFreq = matches.find((m: any) => m.position.freq === freq);
              if (byFreq) {
                updateSelectedPositions([byFreq.position]);
                return;
              }
            }
          }
        }
      } catch {
        // VATSIM feed unavailable, fall through to first match
      }
      
      // Fallback: use first match
      updateSelectedPositions([matches[0].position]);
    }).catch(() => {
      // Optionally handle error
    });
  }, [setPosData, updateSelectedPositions, callsign, cid]);

  const handleGG3Toggle = (isActive: boolean, page: number) => {
    setIsGG3Active(isActive);
    setCurrentGGPage(page);
  };

  const handleExitGG3 = () => {
    setIsGG3Active(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
  <SettingModal open={settingModal} setModal={setSettingModal} />
      <div className="flex h-screen items-center justify-center">
        <div className="mt-2 box-border rounded-lg border-60 border-amber-100 shadow-2xl">
          <div className="mt-2">
            <AreaFour />
            <div className="flex">
              <AirGroundPage isGG3Active={isGG3Active} currentGGPage={currentGGPage} onExitGG3={handleExitGG3} />
              <GroundGroundPage onGG3Toggle={handleGG3Toggle} />
              <AreaThree setSettingModal={setSettingModal} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
