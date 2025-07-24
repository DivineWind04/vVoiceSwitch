import Link from "next/link";
import Image from "next/image";
import AirGroundPage from "./_components/air_ground/AirGroundPage";
import GroundGroundPage from "./_components/ground_ground/GroundGroundPage";
import AreaThree from "./_components/special_func/AreaThree";
import StatusArea from "./_components/status/StatusArea";
import AreaFour from "./_components/special_func/AreaFour";
import WebSocketStatus from "./_components/status/WebSocketStatus";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <div className="flex h-screen items-center justify-center">
        <div className="mt-2 box-border rounded-lg border-60 border-gray-500 shadow-2xl">
          <div className="mt-2">
            <AreaFour />
            <div className="flex">
              <AirGroundPage />
              <GroundGroundPage />
              <AreaThree />
            </div>
          </div>
          <StatusArea position="FD/CD" />
          <WebSocketStatus />
        </div>
      </div>
    </main>
  );
}