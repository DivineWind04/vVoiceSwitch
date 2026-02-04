// NOTE: This wrapper should only be used via the main UI switch in src/app/page.tsx
// RDVS 3080 Interface - Industrial-Retro ATC aesthetic (800x600 display)
import React, { useState, useMemo } from 'react';
import { useCoreStore } from '../model';
import '../app/_components/vatlines/styles.css';

// Layout: 5x8 station selector grid (left) + 1x8 line control panels (right)
// Row 8 is function keys (HOLD, REL, etc.)
const GRID_COLS = 5;
const GRID_ROWS = 8;
const BUTTONS_PER_PAGE = 40; // 5 cols x 8 rows

// Button dimensions for SVG (scaled for 800x600)
const BTN_WIDTH = 78;
const BTN_HEIGHT = 54;

// Line panel dimensions
const LINE_PANEL_WIDTH = 370;
const LINE_PANEL_HEIGHT = 54;

// Color Palette per specification
const COLORS = {
  RED: '#FF0000',      // Override buttons
  BLUE: '#0000FF',     // Call/Intercom buttons
  GREY: '#666666',     // Function keys
  CYAN: '#00FFFF',     // Text/Lines
  GREEN: '#00FF00',    // Selection/Active
  BLACK: '#000000',    // Background
  WHITE: '#FFFFFF',    // Text
  DARK_GREY: '#333333' // Empty cells
};

export default function RDVSWrapper() {
  const [currentPage, setCurrentPage] = useState(1);
  const [ovrActive, setOvrActive] = useState(false);

  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  const selectedPositions = useCoreStore((s: any) => s.selectedPositions);
  const gg_status = useCoreStore((s: any) => s.gg_status);
  const ag_status = useCoreStore((s: any) => s.ag_status);
  const ptt = useCoreStore((s: any) => s.ptt);

  const currentPosition = selectedPositions?.[0] || null;

  // Build line buttons from position data
  const lineButtons = useMemo(() => {
    const btns: any[] = [];
    if (currentPosition?.lines) {
      currentPosition.lines.forEach((line: any) => {
        const lineType = Array.isArray(line) ? line[1] : line.type;
        const call_id = Array.isArray(line) ? line[0] : (line.id || '');
        const label = Array.isArray(line) && line[2] ? String(line[2]) : '';
        const parts = label.split(',');
        const line1 = parts[0]?.trim() || '';
        const line2 = parts[1]?.trim() || '';

        let typeLetter = '';
        if (lineType === 0) typeLetter = 'O';
        else if (lineType === 1) typeLetter = 'C';
        else if (lineType === 2) typeLetter = 'A';

        let statusObj: any = {};
        if (gg_status) {
          statusObj = gg_status.find((s: any) =>
            s?.call === call_id || String(s?.call).endsWith(call_id)
          ) || {};
        }

        const callStatus = statusObj.status || 'off';
        let indicatorState = 'off';
        if (lineType === 0) {
          if (callStatus === 'ok' || callStatus === 'active') indicatorState = 'on';
          else if (callStatus === 'busy') indicatorState = 'flutter';
        } else if (lineType === 1) {
          if (callStatus === 'chime') indicatorState = 'flashing';
          else if (callStatus === 'ok') indicatorState = 'flutter';
        } else if (lineType === 2) {
          if (callStatus === 'ok' || callStatus === 'online') indicatorState = 'flutter';
        }

        btns.push({
          call_id,
          lineType,
          typeLetter,
          line1,
          line2,
          indicatorState,
          statusObj
        });
      });
    }
    return btns;
  }, [currentPosition, gg_status]);

  const maxPage = Math.max(1, Math.ceil(lineButtons.length / BUTTONS_PER_PAGE));
  const pageStartIdx = (currentPage - 1) * BUTTONS_PER_PAGE;
  const pageButtons = lineButtons.slice(pageStartIdx, pageStartIdx + BUTTONS_PER_PAGE);

  const setPage = (p: number) => {
    if (p < 1) setCurrentPage(1);
    else if (p > maxPage) setCurrentPage(maxPage);
    else setCurrentPage(p);
  };

  const formatFreq = (freq: number) => freq ? (freq / 1_000_000).toFixed(3) : '';

  const handleLineClick = (btn: any) => {
    const { call_id, lineType, statusObj } = btn;
    const status = statusObj?.status || 'off';

    if (lineType === 0) {
      if (status === 'off' || status === 'idle' || !status) sendMsg({ type: 'call', cmd1: call_id, dbl1: 0 });
      else if (status === 'ok') sendMsg({ type: 'stop', cmd1: call_id, dbl1: 0 });
    } else if (lineType === 1) {
      if (status === 'off' || status === 'idle' || !status) sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 });
      else sendMsg({ type: 'stop', cmd1: call_id, dbl1: 2 });
    } else if (lineType === 2) {
      if (status === 'off' || status === 'idle' || !status) sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 });
      else sendMsg({ type: 'stop', cmd1: call_id, dbl1: 1 });
    }
  };

  // Get button color based on line type
  const getButtonColor = (lineType: number | undefined, typeLetter: string) => {
    if (typeLetter === 'O' || lineType === 0) return COLORS.RED;   // Override = Red
    if (typeLetter === 'C' || lineType === 1) return COLORS.BLUE;  // Call/Intercom = Blue
    if (typeLetter === 'A' || lineType === 2) return COLORS.BLUE;  // Alert/Shout = Blue
    if (lineType === 3) return COLORS.GREY;                         // Dial = Grey
    return COLORS.BLACK;                                            // Empty
  };

  // Render a station selector button using SVG (scaled for 800x600)
  const renderStationButton = (rowIdx: number, colIdx: number) => {
    const btnIdx = rowIdx * GRID_COLS + colIdx;
    const btn = pageButtons[btnIdx];
    const w = BTN_WIDTH;
    const h = BTN_HEIGHT;

    // Row 7 (index) is function keys
    if (rowIdx === 7) {
      const labels = ['HOLD', 'REL', 'HL', 'OHL', 'RHL'];
      const label = labels[colIdx] || '';
      return (
        <svg
          key={`ctrl-${rowIdx}-${colIdx}`}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={{ cursor: 'pointer' }}
          onClick={() => console.log(`${label} pressed`)}
        >
          <rect x="0" y="0" width={w} height={h} fill={COLORS.GREY} stroke={COLORS.BLACK} strokeWidth="1" />
          <text
            x={w / 2}
            y={h / 2 - 4}
            textAnchor="middle"
            fill={COLORS.WHITE}
            fontSize="14"
            fontFamily="Consolas, monospace"
            fontWeight="100"
          >
            {label}
          </text>
          {/* Indicator box */}
          <rect x={(w - 14) / 2} y={h - 18} width="14" height="14" fill="none" stroke={COLORS.CYAN} strokeWidth="1" />
        </svg>
      );
    }

    if (!btn) {
      return (
        <svg
          key={`empty-${rowIdx}-${colIdx}`}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
        >
          <rect x="0" y="0" width={w} height={h} fill={COLORS.BLACK} stroke={COLORS.BLACK} strokeWidth="1" />
        </svg>
      );
    }

    const { typeLetter, line1, line2, indicatorState, lineType } = btn;
    const bgColor = getButtonColor(lineType, typeLetter);
    const indicatorFill = indicatorState !== 'off' ? COLORS.GREEN : COLORS.BLACK;

    return (
      <svg
        key={`btn-${rowIdx}-${colIdx}`}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ cursor: 'pointer' }}
        onClick={() => handleLineClick(btn)}
      >
        <rect x="0" y="0" width={w} height={h} fill={bgColor} stroke={COLORS.BLACK} strokeWidth="1" />
        {/* Top Line: Facility ID */}
        <text
          x={w / 2}
          y={16}
          textAnchor="middle"
          fill={COLORS.WHITE}
          fontSize="14"
          fontFamily="Consolas, monospace"
          fontWeight="bold"
        >
          {line1}
        </text>
        {/* Middle Line: Sector/Position ID */}
        {line2 && (
          <text
            x={w / 2}
            y={30}
            textAnchor="middle"
            fill={COLORS.WHITE}
            fontSize="14"
            fontFamily="Consolas, monospace"
            fontWeight="bold"
          >
            {line2}
          </text>
        )}
        {/* Bottom: Indicator box with type letter - 3px gap from bottom, centered text */}
        <rect x={(w - 16) / 2} y={h - 21} width="16" height="16" fill={indicatorFill} stroke={COLORS.WHITE} strokeWidth="1" />
        <text
          x={w / 2}
          y={h - 21 + 8}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={COLORS.WHITE}
          fontSize="10"
          fontFamily="Consolas, monospace"
          fontWeight="100"
        >
          {typeLetter}
        </text>
      </svg>
    );
  };

  // Render line control panel (right side) - scaled for 800x600
  const renderLineControlPanel = (rowIdx: number) => {
    const ag = ag_status?.[rowIdx] || {};
    const freq = ag.freq || 0;
    const isRx = !!ag.r;
    const isTx = !!ag.t;
    const isHs = !!ag.h;
    const isLs = !!ag.l;

    return (
      <svg
        key={`line-${rowIdx}`}
        width={LINE_PANEL_WIDTH}
        height={LINE_PANEL_HEIGHT}
        viewBox={`0 0 ${LINE_PANEL_WIDTH} ${LINE_PANEL_HEIGHT}`}
        style={{ display: 'block' }}
      >
        {/* Background */}
        <rect x="0" y="0" width={LINE_PANEL_WIDTH} height={LINE_PANEL_HEIGHT} fill={COLORS.BLACK} stroke={COLORS.RED} strokeWidth="1" />

        {/* 5 equal columns: 370px / 5 = 74px each. Dividers at 74, 148, 222, 296 */}

        {/* Column 1: HS/LS Section (0-74) - indicators span from top of HS text to bottom of LS text */}
        <line x1="74" y1="0" x2="74" y2={LINE_PANEL_HEIGHT} stroke={COLORS.RED} strokeWidth="1" />
        <text x="8" y="20" fill={isHs ? COLORS.GREEN : COLORS.CYAN} fontSize="16" fontFamily="Consolas, monospace" fontWeight="100">HS</text>
        <text x="8" y="40" fill={isLs ? COLORS.GREEN : COLORS.CYAN} fontSize="16" fontFamily="Consolas, monospace" fontWeight="100">LS</text>
        {/* HS indicator box - top half, no bottom border */}
        <line x1="40" y1="8" x2="56" y2="8" stroke={COLORS.GREEN} strokeWidth="1" />
        <line x1="40" y1="8" x2="40" y2="27" stroke={COLORS.GREEN} strokeWidth="1" />
        <line x1="56" y1="8" x2="56" y2="27" stroke={COLORS.GREEN} strokeWidth="1" />
        <rect x="41" y="9" width="14" height="18" fill={isHs ? COLORS.GREEN : 'none'} stroke="none" />
        {/* LS indicator box - bottom half, no top border */}
        <line x1="40" y1="27" x2="40" y2="46" stroke={COLORS.GREEN} strokeWidth="1" />
        <line x1="56" y1="27" x2="56" y2="46" stroke={COLORS.GREEN} strokeWidth="1" />
        <line x1="40" y1="46" x2="56" y2="46" stroke={COLORS.GREEN} strokeWidth="1" />
        <rect x="41" y="27" width="14" height="18" fill={isLs ? COLORS.GREEN : 'none'} stroke="none" />

        {/* Column 2: RX Section (74-148) - 30px wide indicator */}
        <line x1="148" y1="0" x2="148" y2={LINE_PANEL_HEIGHT} stroke={COLORS.RED} strokeWidth="1" />
        <text x="82" y="18" fill={COLORS.CYAN} fontSize="16" fontFamily="Consolas, monospace" fontWeight="100">RX</text>
        <rect x="104" y="6" width="30" height="15" fill={isRx ? COLORS.GREEN : 'none'} stroke={COLORS.GREEN} strokeWidth="1" />
        <text x="82" y="42" fill={COLORS.CYAN} fontSize="16" fontFamily="Consolas, monospace" fontWeight="100">{formatFreq(freq)}</text>

        {/* Column 3: M/S Section (148-222) - green background with black M text */}
        <line x1="222" y1="0" x2="222" y2={LINE_PANEL_HEIGHT} stroke={COLORS.RED} strokeWidth="1" />
        <text x="156" y="18" fill={COLORS.CYAN} fontSize="16" fontFamily="Consolas, monospace" fontWeight="100">M/S</text>
        <rect x="186" y="6" width="15" height="15" fill={COLORS.GREEN} stroke={COLORS.GREEN} strokeWidth="1" />
        <text x="193" y="18" textAnchor="middle" fill={COLORS.BLACK} fontSize="15" fontFamily="Consolas, monospace" fontWeight="100">M</text>

        {/* Column 4: TX Section (222-296) - 30px wide indicator, radial selector 7px below (3+4=7) */}
        <line x1="296" y1="0" x2="296" y2={LINE_PANEL_HEIGHT} stroke={COLORS.RED} strokeWidth="1" />
        <text x="230" y="18" fill={COLORS.CYAN} fontSize="16" fontFamily="Consolas, monospace" fontWeight="100">TX</text>
        <rect x="252" y="6" width="30" height="15" fill={isTx ? COLORS.GREEN : 'none'} stroke={COLORS.GREEN} strokeWidth="1" />
        {/* TX radial selector - centered with indicator (252 + 15 = 267), 7px spacing below indicator (6+15+7=28, center at 28+6=34) */}
        <circle cx="267" cy="34" r="6" fill={COLORS.BLACK} stroke={COLORS.RED} strokeWidth="1" />

        {/* Column 5: Secondary M/S Section (296-370) - green background with black M text */}
        <text x="304" y="18" fill={COLORS.CYAN} fontSize="16" fontFamily="Consolas, monospace" fontWeight="100">M/S</text>
        <rect x="334" y="6" width="15" height="15" fill={COLORS.GREEN} stroke={COLORS.GREEN} strokeWidth="1" />
        <text x="341" y="18" textAnchor="middle" fill={COLORS.BLACK} fontSize="15" fontFamily="Consolas, monospace" fontWeight="100">M</text>
      </svg>
    );
  };

  // Chamfered tab with aggressive angled cuts on top-left and top-right corners, 3px padding
  // Active page = grey border/text, inactive = white border/text, always black background
  const renderPageTab = (pageNum: number, isActive: boolean) => {
    const w = 80;
    const h = 22; // 3px top + ~16px text + 3px bottom
    const chamfer = 12; // More aggressive corner cutoff
    const tabColor = isActive ? COLORS.GREY : COLORS.WHITE;

    return (
      <svg
        key={`tab-${pageNum}`}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ cursor: 'pointer' }}
        onClick={() => setPage(pageNum)}
      >
        <polygon
          points={`
            ${chamfer},0
            ${w - chamfer},0
            ${w},${chamfer}
            ${w},${h}
            0,${h}
            0,${chamfer}
          `}
          fill={COLORS.BLACK}
          stroke={tabColor}
          strokeWidth="1"
        />
        <text
          x={w / 2}
          y={h / 2 + 4}
          textAnchor="middle"
          fill={tabColor}
          fontSize="13"
          fontFamily="Consolas, monospace"
          fontWeight="100"
        >
          PAGE {pageNum}
        </text>
      </svg>
    );
  };

  // Hexagonal arrow for pagination (scaled for 800x600)
  const renderHexArrow = (direction: 'prev' | 'next') => {
    const w = 65;
    const h = 24;
    const isPrev = direction === 'prev';

    return (
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ cursor: 'pointer' }}
        onClick={() => setPage(currentPage + (isPrev ? -1 : 1))}
      >
        {isPrev ? (
          <polygon
            points={`0,${h/2} 12,0 ${w},0 ${w},${h} 12,${h}`}
            fill="none"
            stroke={COLORS.WHITE}
            strokeWidth="1"
          />
        ) : (
          <polygon
            points={`0,0 ${w-12},0 ${w},${h/2} ${w-12},${h} 0,${h}`}
            fill="none"
            stroke={COLORS.WHITE}
            strokeWidth="1"
          />
        )}
        <text
          x={w / 2}
          y={h / 2 + 4}
          textAnchor="middle"
          fill={COLORS.WHITE}
          fontSize="13"
          fontFamily="Consolas, monospace"
          fontWeight="100"
        >
          {isPrev ? 'PREV' : 'NEXT'}
        </text>
      </svg>
    );
  };

  return (
    <div
      style={{
        backgroundColor: COLORS.BLACK,
        padding: '20px',
        display: 'inline-block'
      }}
    >
      <div
        style={{
          width: '800px',
          height: '600px',
          backgroundColor: COLORS.BLACK,
          color: COLORS.WHITE,
          fontFamily: 'Consolas, monospace',
          fontWeight: 100,
          fontSize: '14px',
          userSelect: 'none',
          display: 'flex',
          flexDirection: 'column',
          textTransform: 'uppercase',
        }}
      >
      {/* Header Module */}
      <div
        style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          borderBottom: `1px solid ${COLORS.BLACK}`
        }}
      >
        {/* Brightness Control - larger circles and +2pt font */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg width="56" height="44" viewBox="0 0 56 44">
              <text x="28" y="12" textAnchor="middle" fill={COLORS.WHITE} fontSize="13" fontFamily="Consolas, monospace" fontWeight="100">BRIGHT</text>
              <circle cx="28" cy="30" r="12" fill={COLORS.BLACK} stroke={COLORS.WHITE} strokeWidth="2" />
            </svg>
          </div>
          <svg width="36" height="20" viewBox="0 0 36 20">
            <text x="18" y="14" textAnchor="middle" fill={COLORS.CYAN} fontSize="14" fontFamily="Consolas, monospace" fontWeight="100">47%</text>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg width="40" height="44" viewBox="0 0 40 44">
              <text x="20" y="12" textAnchor="middle" fill={COLORS.WHITE} fontSize="13" fontFamily="Consolas, monospace" fontWeight="100">DIM</text>
              <circle cx="20" cy="30" r="12" fill={COLORS.BLACK} stroke={COLORS.WHITE} strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Pagination Control */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg width="80" height="16" viewBox="0 0 80 16">
            <text x="40" y="12" textAnchor="middle" fill={COLORS.WHITE} fontSize="12" fontFamily="Consolas, monospace" fontWeight="100">PAGE {currentPage}</text>
          </svg>
          <div style={{ display: 'flex', gap: '4px' }}>
            {renderHexArrow('prev')}
            {renderHexArrow('next')}
          </div>
          <svg width="50" height="16" viewBox="0 0 50 16">
            <text x="25" y="12" textAnchor="middle" fill={COLORS.WHITE} fontSize="12" fontFamily="Consolas, monospace" fontWeight="100">OF {maxPage}</text>
          </svg>
        </div>

        {/* Status Indicators: IA, OVR, CA */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <svg width="26" height="36" viewBox="0 0 26 36">
            <text x="13" y="12" textAnchor="middle" fill={COLORS.WHITE} fontSize="11" fontFamily="Consolas, monospace" fontWeight="100">IA</text>
            <rect x="4" y="16" width="18" height="18" fill="none" stroke={COLORS.WHITE} strokeWidth="1" />
          </svg>
          <svg width="30" height="36" viewBox="0 0 30 36">
            <text x="15" y="12" textAnchor="middle" fill={COLORS.WHITE} fontSize="11" fontFamily="Consolas, monospace" fontWeight="100">OVR</text>
            <rect x="6" y="16" width="18" height="18" fill={ovrActive ? COLORS.GREEN : 'none'} stroke={COLORS.GREEN} strokeWidth="1" />
          </svg>
          <svg width="26" height="36" viewBox="0 0 26 36">
            <text x="13" y="12" textAnchor="middle" fill={COLORS.WHITE} fontSize="11" fontFamily="Consolas, monospace" fontWeight="100">CA</text>
            <rect x="4" y="16" width="18" height="18" fill="none" stroke={COLORS.WHITE} strokeWidth="1" />
          </svg>
        </div>

        {/* Readout Display */}
        <svg width="120" height="40" viewBox="0 0 120 40">
          <rect x="0" y="0" width="120" height="40" fill={COLORS.BLACK} stroke={COLORS.WHITE} strokeWidth="1" />
        </svg>
      </div>

      {/* Main Communication Matrix - 5x8 grid + 8 line panels */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {/* Left Column: Station Selector (5x8 grid) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_COLS}, ${BTN_WIDTH}px)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, ${BTN_HEIGHT}px)`,
            gap: '6px',
            backgroundColor: COLORS.BLACK,
          }}
        >
          {Array.from({ length: GRID_ROWS }).map((_, rowIdx) =>
            Array.from({ length: GRID_COLS }).map((_, colIdx) =>
              renderStationButton(rowIdx, colIdx)
            )
          )}
        </div>

        {/* Right Column: Line Control Panels (1x8) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {Array.from({ length: GRID_ROWS }).map((_, rowIdx) =>
            renderLineControlPanel(rowIdx)
          )}
        </div>
      </div>

      {/* Footer Module */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: '0 12px 6px 12px'
        }}
      >
        {/* Page Tabs */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
          {Array.from({ length: Math.min(maxPage, 3) }).map((_, idx) =>
            renderPageTab(idx + 1, currentPage === idx + 1)
          )}
        </div>

        {/* Master Audio Status - global HS/LS radial selectors with black backgrounds */}
        <div style={{ display: 'flex', gap: '12px', paddingBottom: '4px' }}>
          <svg width="56" height="22" viewBox="0 0 56 22">
            <rect x="0" y="2" width="30" height="18" fill="none" stroke={COLORS.GREEN} strokeWidth="1" />
            <text x="15" y="15" textAnchor="middle" fill={COLORS.WHITE} fontSize="12" fontFamily="Consolas, monospace" fontWeight="100">HS</text>
            <circle cx="46" cy="11" r="6" fill={COLORS.BLACK} stroke={COLORS.RED} strokeWidth="1" />
          </svg>
          <svg width="56" height="22" viewBox="0 0 56 22">
            <rect x="0" y="2" width="30" height="18" fill="none" stroke={COLORS.GREEN} strokeWidth="1" />
            <text x="15" y="15" textAnchor="middle" fill={COLORS.WHITE} fontSize="12" fontFamily="Consolas, monospace" fontWeight="100">LS</text>
            <circle cx="46" cy="11" r="6" fill={COLORS.BLACK} stroke={COLORS.RED} strokeWidth="1" />
          </svg>
        </div>
      </div>
      </div>
    </div>
  );
}
