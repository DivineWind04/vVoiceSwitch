import Link from "next/link";
import AirGroundPage from "./components/air_ground/air_ground_page";
import GroundGroundPage from "./components/ground_ground/ground_ground_page";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <div className="flex items-center justify-center h-screen">
        <div className="flex border-30 border-gray-500 rounded-lg box-border shadow-2xl">
          <AirGroundPage />
          <GroundGroundPage />
        </div>
      </div>
    </main>
  );
}
