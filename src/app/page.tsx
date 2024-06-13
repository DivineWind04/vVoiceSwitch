import Link from "next/link";
import AirGroundPage from "./components/air_ground/AirGroundPage";
import GroundGroundPage from "./components/ground_ground/GroundGroundPage";
import AreaThree from "./components/special_func/AreaThree";
import StatusArea from "./components/status/StatusArea";
import AreaFour from "./components/special_func/AreaFour";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <div className="flex items-center justify-center h-screen">
        <div className="border-60 border-gray-500 rounded-lg box-border shadow-2xl">
          <AreaFour />
          <div className="flex">
            <AirGroundPage />
            <GroundGroundPage />
            <AreaThree />
          </div>
          <StatusArea position="LOCAL EAST" />
        </div>
      </div>
    </main>
  );
}
