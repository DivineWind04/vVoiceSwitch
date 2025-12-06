"use client";
import "../styles/globals.css";
import Link from "next/link";
import Image from "next/image";
import AirGroundPage from "./_components/air_ground/AirGroundPage";
import GroundGroundPage from "./_components/ground_ground/GroundGroundPage";
import AreaThree from "./_components/special_func/AreaThree";
import StatusArea from "./_components/status/StatusArea";
import AreaFour from "./_components/special_func/AreaFour";
import SettingModal from './_components/special_func/SettingModal';
import { useState, useEffect } from "react";
import axios from "axios";
import { useCoreStore } from '../model';

export default function HomePage() {
  const [isGG3Active, setIsGG3Active] = useState(false);
  const [currentGGPage, setCurrentGGPage] = useState(1);
  const [settingModal, setSettingModal] = useState(false);
  const setPosData = require('../model').useCoreStore((s: any) => s.setPositionData);
  const callsign = useCoreStore((s: any) => s.callsign);
  const [filteredPosition, setFilteredPosition] = useState<any>(null);

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
      setPosData(prod);
    }).catch(() => {
      // Optionally handle error
    });
  }, [setPosData, callsign]);

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
