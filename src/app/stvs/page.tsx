"use client";

import React, { useState, useEffect } from "react";
import StvsBase from "./StvsBase";
import axios from "axios";
import { useCoreStore } from "~/model";
import { loadAllFacilities } from "~/lib/facilityLoader";

export default function StvsPage() {
  const setPosData = useCoreStore((s: any) => s.setPositionData);

  useEffect(() => {
    // Always use the full merged data so findDialCodeTable can traverse
    // ancestor facilities (e.g. NCT.dialCodeTable for SJC_TWR)
    loadAllFacilities().then(({ merged }) => {
      setPosData(merged);
    }).catch(() => {
      // Fallback to ZOA only
      axios.get('/zoa_position.json').then(r => {
        setPosData(r.data);
      });
    });
  }, [setPosData]);

  return <StvsBase />;
}
