"use client";
// Example usage: you can use filteredPosition in your UI below
import React, { useState } from "react";
import SettingModal from "../_components/vatlines/SettingModal";
import AreaFour from "../_components/special_func/AreaFour";
import AreaThree from "../_components/special_func/AreaThree";
import AirGroundPage from "../_components/air_ground/AirGroundPage";
import GroundGroundPage from "../_components/ground_ground/GroundGroundPage";
import GroundGroundPage3 from "../_components/ground_ground/GroundGroundPage3";
import StatusArea from "../_components/status/StatusArea";
import { useCoreStore } from "../../model";

export default function IVSRPage() {
	const [settingModal, setSettingModal] = useState(false);
	const [currentGGPage, setCurrentGGPage] = useState(1);
	const [showKeypad, setShowKeypad] = useState(false);
	const [dialLineInfo, setDialLineInfo] = useState<{ trunkName: string; lineType: number } | null>(null);
	const brightness = useCoreStore((s) => s.brightness);
	
	// Get selected position from store
	const selectedPositions = useCoreStore((s: any) => s.selectedPositions);
	const positionData = useCoreStore((s: any) => s.positionData);
	
	// Toggle keypad (for IA and KEYPAD buttons)
	const toggleKeypad = () => {
		setShowKeypad(!showKeypad);
		if (showKeypad) {
			setDialLineInfo(null); // Clear dial line info when closing
		}
	};

	// Open keypad for a dial line
	const openKeypadForDialLine = (trunkName: string, lineType: number) => {
		setDialLineInfo({ trunkName, lineType });
		setShowKeypad(true);
	};

	// Close keypad
	const closeKeypad = () => {
		setShowKeypad(false);
		setDialLineInfo(null);
	};
	
	// Get the filtered position - use selectedPositions first, fallback to positionData
	const filteredPosition = selectedPositions && selectedPositions.length > 0
		? selectedPositions[0]
		: positionData?.positions && positionData.positions.length > 0
			? positionData.positions[0]
			: { pos: "FD/CD" };
	return (
		<main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
			<SettingModal open={settingModal} setModal={setSettingModal} position={filteredPosition} />
			<div className="flex h-screen items-center justify-center">
				<div className="mt-2 box-border rounded-lg border-60 border-gray-500 shadow-2xl">
					<div style={{ filter: `brightness(${brightness / 100})` }}>
						<div className="mt-2">
							<AreaFour />
							<div className="flex">
								{/* Left side */}
								<div className="flex flex-col">
									{currentGGPage === 3 ? (
										/* When G/G page 3 is selected, show G/G page 3 grid, then A/G buttons below */
										<>
											<GroundGroundPage3 />
											<AirGroundPage hideRows={true} />
										</>
									) : (
										/* Otherwise show normal A/G page */
										<AirGroundPage />
									)}
								</div>
								{/* Right side - Show G/G page 2 when page 3 is selected, otherwise show current page */}
								<GroundGroundPage 
									currentPage={currentGGPage === 3 ? 2 : currentGGPage} 
									onPageChange={setCurrentGGPage}
									showKeypad={showKeypad}
									dialLineInfo={dialLineInfo}
									onCloseKeypad={closeKeypad}
									onOpenKeypadForDialLine={openKeypadForDialLine}
								/>
								<AreaThree 
									setSettingModal={setSettingModal} 
									onToggleKeypad={toggleKeypad}
									keypadActive={showKeypad}
								/>
							</div>
						</div>
						<div style={{ cursor: 'pointer' }} title="Open settings" onClick={() => setSettingModal(true)}>
							<StatusArea position={filteredPosition?.pos || 'FD/CD'} />
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}
