"use client";

import React, { useState, useEffect } from "react";
import StvsBase from "./StvsBase";
import axios from "axios";
import { useCoreStore } from "~/model";
import { loadAllFacilities, findPositionByCallsign } from "~/lib/facilityLoader";

export default function StvsPage() {
  const setPosData = useCoreStore((s: any) => s.setPositionData);
  const callsign = useCoreStore((s: any) => s.callsign);

  useEffect(() => {
    // Load all facilities and find the one containing the current position
    loadAllFacilities().then(({ merged }) => {
      if (callsign) {
        const result = findPositionByCallsign(merged, callsign);
        if (result?.facility) {
          setPosData(result.facility);
          return;
        }
      }
      // Fallback to full merged data
      setPosData(merged);
    }).catch(() => {
      // Fallback to ZOA only
      axios.get('/zoa_position.json').then(r => {
        setPosData(r.data);
      });
    });
  }, [setPosData, callsign]);

  return <StvsBase />;
}
