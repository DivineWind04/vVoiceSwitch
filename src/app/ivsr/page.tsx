"use client";
// Example usage: you can use filteredPosition in your UI below
import React, { useState } from "react";
import SettingModal from "../_components/vatlines/SettingModal";
import AreaFour from "../_components/special_func/AreaFour";
import AreaThree from "../_components/special_func/AreaThree";
import AirGroundPage from "../_components/air_ground/AirGroundPage";
import GroundGroundPage from "../_components/ground_ground/GroundGroundPage";
import StatusArea from "../_components/status/StatusArea";

export default function IVSRPage() {
	const [settingModal, setSettingModal] = useState(false);
	// TODO: Replace with real filteredPosition logic
	const filteredPosition = { pos: "FD/CD" };
	return (
		<main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
			<SettingModal open={settingModal} setModal={setSettingModal} position={filteredPosition} />
			<div className="flex h-screen items-center justify-center">
				<div className="mt-2 box-border rounded-lg border-60 border-gray-500 shadow-2xl">
					<div className="mt-2">
						<AreaFour />
						<div className="flex">
							<AirGroundPage />
							<GroundGroundPage />
							<AreaThree setSettingModal={setSettingModal} />
						</div>
					</div>
					<div style={{ cursor: 'pointer' }} title="Open settings" onClick={() => setSettingModal(true)}>
						<StatusArea position={filteredPosition?.pos || 'FD/CD'} />
					</div>
				</div>
			</div>
		</main>
	);
}
