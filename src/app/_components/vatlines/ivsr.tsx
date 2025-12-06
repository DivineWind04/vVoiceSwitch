"use client";

import React from "react";
import StatusArea from "../status/StatusArea";
import GroundGroundPage from "../ground_ground/GroundGroundPage";
import AirGroundPage from "../air_ground/AirGroundPage";
import * as SpecialFunc from "../special_func/DisplayField";

export default function IVSRPanel() {
  return (
    <div style={{ background: 'black', color: 'white', padding: '20px' }}>
      <h2>IVSR Interface</h2>
  <StatusArea position="IVSR" />
      <GroundGroundPage />
      <AirGroundPage />
      {/* Add more IVSR components as needed */}
    </div>
  );
}
