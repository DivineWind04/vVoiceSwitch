"use client";

import { useCoreStore } from "~/model";
import { useCoreStore as useEtvsCoreStore } from "../../../../etvs-src/model";

export default function LineTooltipToggleIcon() {
  const showLineTooltips = useCoreStore((s: any) => s.showLineTooltips);
  const setShowLineTooltips = useCoreStore((s: any) => s.setShowLineTooltips);
  const setEtvsShowLineTooltips = useEtvsCoreStore((s: any) => s.setShowLineTooltips);

  const handleToggle = () => {
    const next = !showLineTooltips;
    setShowLineTooltips(next);
    try {
      setEtvsShowLineTooltips(next);
    } catch {
      // ignore ETVS sync errors if wrapper/store is not active
    }
  };

  return (
    <button
      onClick={handleToggle}
      title={showLineTooltips ? "Disable line info tooltips" : "Enable line info tooltips"}
      style={{
        position: "fixed",
        bottom: 16,
        right: 64,
        zIndex: 9999,
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: showLineTooltips ? "#234b23" : "#27272a",
        border: `1px solid ${showLineTooltips ? "#4d8f4d" : "#52525b"}`,
        color: showLineTooltips ? "#7fff7f" : "#a1a1aa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background 0.15s",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        fontFamily: "monospace",
        fontSize: 12,
        fontWeight: 700,
      }}
      aria-label={showLineTooltips ? "Line info on" : "Line info off"}
    >
      i
    </button>
  );
}
