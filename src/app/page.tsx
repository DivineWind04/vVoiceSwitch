"use client";

import Link from "next/link";
import Image from "next/image";
import AirGroundPage from "./_components/air_ground/AirGroundPage";
import GroundGroundPage from "./_components/ground_ground/GroundGroundPage";
import AreaThree from "./_components/special_func/AreaThree";
import StatusArea from "./_components/status/StatusArea";
import AreaFour from "./_components/special_func/AreaFour";
import { useState } from "react";

export default function HomePage() {
  const [isGG3Active, setIsGG3Active] = useState(false);
  const [currentGGPage, setCurrentGGPage] = useState(1);

  const handleGG3Toggle = (isActive: boolean, page: number) => {
    setIsGG3Active(isActive);
    setCurrentGGPage(page);
  };

  const handleExitGG3 = () => {
    setIsGG3Active(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <div className="flex h-screen items-center justify-center">
        <div className="mt-2 box-border rounded-lg border-60 border-amber-100 shadow-2xl">
          <div className="mt-2">
            <AreaFour />
            <div className="flex">
              <AirGroundPage isGG3Active={isGG3Active} currentGGPage={currentGGPage} onExitGG3={handleExitGG3} />
              <GroundGroundPage onGG3Toggle={handleGG3Toggle} />
              <AreaThree />
            </div>
          </div>
          {/* <StatusArea position="FD/CD" /> */}
        </div>
      </div>
    </main>
  );
}
