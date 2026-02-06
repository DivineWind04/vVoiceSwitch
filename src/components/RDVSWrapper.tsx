// NOTE: This wrapper should only be used via the main UI switch in src/app/page.tsx
// RDVS 3080 Interface - Industrial-Retro ATC aesthetic (800x600 display)
//
// CUSTOM LAYOUT SYSTEM:
// Format: rdvs-{header}-{q1}{q2}{q3}{q4}-{footer}-{funckeys}
//
// Header options:
//   A = default (bright/dim, pagination, IA/OVR/CA, readout)
//   B = alternate (status rect, IA/OVR/CA, keypad, pagination, dim/bright)
//
// Quadrant types (single letter each, 4 letters total for q1q2q3q4):
//   S = station (all station selector buttons)
//   F = frequency (line control panels, 4 per quadrant or 8 if stacked)
//   M = mixed (station buttons with function keys)
//   NOTE: Q2 must always be F (frequency) - other values will be auto-corrected
//
// Footer options:
//   A = default (page tabs left, HS/LS selectors right)
//   B = centered (page tabs centered, no HS/LS - use when HS/LS is in a quadrant)
//
// Function keys (comma-separated list for mixed quadrants):
//   Format: {quadrant}:{b1}={key},{b2}={key},...
//   Example: Q3:16=HOLD,17=REL,18=HL,19=RECON,20=FWD
//   Special keys: HOLD, REL, HL, RECON, FWD, OHL, RHL, RB, HS_LS
//
// Examples:
//   rdvs-A-SFMF-A-Q3:16=HOLD,17=REL,18=HL,19=RECON,20=FWD  (default layout)
//   rdvs-A-SFSM-A-Q4:16=HOLD,17=REL,18=HL,19=RECON,20=FWD  (rdvs-1 layout)
//   rdvs-B-SFSM-B-Q4:4=RECON,5=FWD,9=HL,10=RB,18=HS_LS,19=HOLD,20=REL  (rdvs-2 layout)
//
// Legacy variants still supported: 'default', 'rdvs-1', 'rdvs-2'

import React, { useState, useMemo, useEffect } from 'react';
import { useCoreStore, findRdvsColorPattern } from '../model';
import '../app/_components/vatlines/styles.css';
import type { RDVSColorPattern, ColorSetDef, ButtonColorAssignments, FillDesign } from '../types/ted_pattern_types';

// TED Pattern Configuration imports
import type {
  TEDPatternConfig,
  TEDCellConfig,
  TEDValidationError,
  ParsedTEDLayout,
  ParsedPage,
  ParsedCell,
  FooterKeyword,
  FooterSection,
  FooterSectionType,
} from '../types/ted_pattern_types';

import { FOOTER_LAYOUTS } from '../types/ted_pattern_types';

// ============================================================
// SVG FILL PATTERN DEFINITIONS
// ============================================================

/**
 * Generate a unique pattern ID based on fill design and color
 * This ensures patterns with different colors don't conflict
 */
const getPatternId = (fillDesign: FillDesign, color: string): string => {
  const colorSafe = color.replace('#', '');
  return `fill-${fillDesign}-${colorSafe}`;
};

/**
 * SVG Pattern Definitions component
 * Renders <defs> with all fill patterns for a given border color
 */
const FillPatternDefs: React.FC<{ color: string }> = ({ color }) => (
  <defs>
    {/* Interleaved pattern - diagonal stripes (45-degree hatching) */}
    {/* Thin lines with wider black spacing */}
    <pattern
      id={getPatternId('interleaved', color)}
      patternUnits="userSpaceOnUse"
      width="8"
      height="8"
      patternTransform="rotate(45)"
    >
      {/* Thin stripe with more black spacing */}
      <rect x="0" y="0" width="2" height="8" fill={color} />
    </pattern>

    {/* Dots pattern - sparse dots */}
    <pattern
      id={getPatternId('dots', color)}
      patternUnits="userSpaceOnUse"
      width="8"
      height="8"
    >
      <circle cx="4" cy="4" r="1" fill={color} />
    </pattern>

    {/* Close dots pattern - dense dots */}
    <pattern
      id={getPatternId('closeDots', color)}
      patternUnits="userSpaceOnUse"
      width="4"
      height="4"
    >
      <circle cx="2" cy="2" r="1" fill={color} />
    </pattern>
  </defs>
);

/**
 * Get the SVG fill value for a given fill design and color
 * Returns either a solid color, 'none', or a pattern URL
 */
const getFillValue = (fillDesign: FillDesign, backgroundColor: string, borderColor: string): string => {
  switch (fillDesign) {
    case 'solid':
      return backgroundColor;
    case 'empty':
      return 'none';
    case 'interleaved':
    case 'dots':
    case 'closeDots':
      return `url(#${getPatternId(fillDesign, borderColor)})`;
    default:
      return backgroundColor;
  }
};
import {
  parseTEDPattern,
  validateTEDPattern,
  getPageByNumber,
  findLineById,
  findRadioById,
} from '../utils/tedPatternParser';

// Layout configuration types
type QuadrantType = 'S' | 'F' | 'M'; // Station, Frequency, Mixed
type HeaderType = 'A' | 'B';
type FooterType = 'A' | 'B';

interface LayoutConfig {
  header: HeaderType;
  quadrants: [QuadrantType, QuadrantType, QuadrantType, QuadrantType]; // Q1, Q2, Q3, Q4
  footer: FooterType;
  funcKeys: Record<string, Record<number, string>>; // { Q3: { 16: 'HOLD', ... }, Q4: { ... } }
}

// Parse custom layout string into config
function parseLayoutString(variant: string): LayoutConfig | null {
  // Check for legacy variants first
  if (variant === 'default') {
    return {
      header: 'A',
      quadrants: ['S', 'F', 'M', 'F'],
      footer: 'A',
      funcKeys: { Q3: { 16: 'HOLD', 17: 'REL', 18: 'HL', 19: 'RECON', 20: 'FWD' } }
    };
  }
  if (variant === 'rdvs-1') {
    return {
      header: 'A',
      quadrants: ['S', 'F', 'S', 'M'],
      footer: 'A',
      funcKeys: { Q4: { 16: 'HOLD', 17: 'REL', 18: 'HL', 19: 'RECON', 20: 'FWD' } }
    };
  }
  if (variant === 'rdvs-2') {
    return {
      header: 'B',
      quadrants: ['S', 'F', 'S', 'M'],
      footer: 'B',
      funcKeys: { Q4: { 4: 'RECON', 5: 'FWD', 9: 'HL', 10: 'RB', 18: 'HS_LS', 19: 'HOLD', 20: 'REL' } }
    };
  }

  // Parse custom format: rdvs-{header}-{q1q2q3q4}-{footer}-{funckeys}
  if (!variant.startsWith('rdvs-')) return null;

  const parts = variant.substring(5).split('-');
  if (parts.length < 3) return null;

  const headerPart = parts[0];
  const quadrantPart = parts[1];
  const footerPart = parts[2];

  if (!headerPart || !quadrantPart || !footerPart) return null;

  const header = headerPart.toUpperCase() as HeaderType;
  if (header !== 'A' && header !== 'B') return null;

  const quadrantStr = quadrantPart.toUpperCase();
  if (quadrantStr.length !== 4) return null;
  const quadrants = quadrantStr.split('') as [QuadrantType, QuadrantType, QuadrantType, QuadrantType];
  for (const q of quadrants) {
    if (q !== 'S' && q !== 'F' && q !== 'M') return null;
  }

  // Q2 must always be frequency (F) - enforce this constraint
  if (quadrants[1] !== 'F') {
    console.warn(`Warning: Q2 must be frequency (F), got '${quadrants[1]}'. Auto-correcting to F.`);
    quadrants[1] = 'F';
  }

  const footer = footerPart.toUpperCase() as FooterType;
  if (footer !== 'A' && footer !== 'B') return null;

  // Parse function keys (optional, remaining parts joined back together)
  const funcKeys: Record<string, Record<number, string>> = {};
  if (parts.length > 3) {
    const funcKeyStr = parts.slice(3).join('-'); // Rejoin in case there were dashes in keys
    const quadrantDefs = funcKeyStr.split(/(?=Q[1-4]:)/); // Split on Q1:, Q2:, etc.

    for (const def of quadrantDefs) {
      if (!def.trim()) continue;
      const match = def.match(/^Q([1-4]):(.+)$/);
      if (match && match[1] && match[2]) {
        const qName = `Q${match[1]}`;
        const keyDefs = match[2].split(',');
        funcKeys[qName] = {};
        for (const keyDef of keyDefs) {
          const [btnNum, keyName] = keyDef.split('=');
          if (btnNum && keyName) {
            funcKeys[qName][parseInt(btnNum, 10)] = keyName.trim().toUpperCase();
          }
        }
      }
    }
  }

  // Validate: Remove function keys from frequency quadrants (F type can't have function keys)
  const quadrantNames = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
  for (let i = 0; i < 4; i++) {
    const qName = quadrantNames[i];
    const qType = quadrants[i];
    if (qName && qType === 'F' && funcKeys[qName]) {
      console.warn(`Warning: Function keys defined for frequency quadrant ${qName} will be ignored`);
      delete funcKeys[qName];
    }
  }

  return { header, quadrants, footer, funcKeys };
}

// Layout: 10x10 unified grid with separate sliver area for page tabs
// Row 0: Header modules
// Rows 1-8: Communication matrix (4 quadrants in 2x2 arrangement)
// Row 9: Footer row
// Sliver: Page tabs (positioned outside grid, along border)
// Q1 = cols 0-4, rows 1-4 | Q2 = cols 5-9, rows 1-4
// Q3 = cols 0-4, rows 5-8 | Q4 = cols 5-9, rows 5-8
const GRID_COLS = 10;
const GRID_ROWS = 10; // Header + 8 matrix rows + footer
const BUTTONS_PER_PAGE = 80; // Communication matrix: 10 cols x 8 rows

// Sliver height for page tabs (positioned outside main grid)
const SLIVER_HEIGHT = 28;

// Container dimensions - 800x600 base + sliver height
const CONTAINER_WIDTH = 800;
const BASE_HEIGHT = 600;
const CONTAINER_HEIGHT = BASE_HEIGHT + SLIVER_HEIGHT; // Extended to fit sliver
const PADDING = 10; // 10px padding on all sides
const GAP = 6;

// Calculate available space for the 10x10 grid (sliver is separate)
const AVAILABLE_WIDTH = CONTAINER_WIDTH - (PADDING * 2); // 780px
const AVAILABLE_HEIGHT = BASE_HEIGHT - (PADDING * 2); // 580px (original grid space)

// Cell dimensions for unified 10x10 grid (10 cols with 9 gaps, 10 rows with 9 gaps)
const CELL_WIDTH = Math.floor((AVAILABLE_WIDTH - 9 * GAP) / 10); // ~72px
const CELL_HEIGHT = Math.floor((AVAILABLE_HEIGHT - 9 * GAP) / 10); // ~52px

// Default handedness - fallback when no TED pattern is configured
// Actual handedness is derived from parsedTEDLayout.display (LEFT, RIGHT, NONE)
const DEFAULT_handedness: 'left' | 'right' = 'left';

// Sliver position: 'bottom' (default) or 'top' - determines where page tabs appear
type SliverPosition = 'bottom' | 'top';
const DEFAULT_SLIVER_POSITION: SliverPosition = 'bottom';

// Legacy compatibility aliases
const BTN_WIDTH = CELL_WIDTH;
const BTN_HEIGHT = CELL_HEIGHT;
const LINE_PANEL_HEIGHT = CELL_HEIGHT;

// Color Palette per specification
const COLORS = {
  RED: '#FF0000',      // Override buttons
  BLUE: '#0000FF',     // Call/Intercom buttons
  GREY: '#606666',     // Function keys (utility)
  CYAN: '#00FFFF',     // Text/Lines
  GREEN: '#00FF00',    // Selection/Active
  BLACK: '#000000',    // Background
  WHITE: '#FFFFFF',    // Text
  DARK_GREY: '#333333', // Empty cells
  YELLOW: '#FFFF00',   // Alert/Interphone lines (type 2)
  // Default color set colors (ZAB dark pattern as system default)
  NORMAL_BORDER: '#89111D', // Color Set 1 - Normal DA/Radio border
  INTERPHONE_BG: '#26449B', // Color Set 2 - Interphone/Significant DA background & border
  UTILITY_BG: '#606666',    // Color Set 3 - Utility background
};

// Quadrant helpers
// Button numbering within a quadrant: B1-B5 = row 1, B6-B10 = row 2, B11-B15 = row 3, B16-B20 = row 4
const getQuadrantButtonNum = (quadrantRow: number, quadrantCol: number): number => {
  return quadrantRow * 5 + quadrantCol + 1; // 1-indexed
};

// Check which quadrant a position belongs to
const getQuadrant = (rowIdx: number, colIdx: number): 'Q1' | 'Q2' | 'Q3' | 'Q4' => {
  if (rowIdx < 4 && colIdx < 5) return 'Q1';
  if (rowIdx < 4 && colIdx >= 5) return 'Q2';
  if (rowIdx >= 4 && colIdx < 5) return 'Q3';
  return 'Q4';
};

// Get row/col within the quadrant (0-indexed)
const getQuadrantPosition = (rowIdx: number, colIdx: number): { qRow: number; qCol: number } => {
  const qRow = rowIdx % 4;
  const qCol = colIdx % 5;
  return { qRow, qCol };
};

interface RDVSWrapperProps {
  variant?: string; // 'default', 'rdvs-1', 'rdvs-2', or custom format like 'rdvs-A-SFMF-A-Q3:16=HOLD,...'
}

export default function RDVSWrapper({ variant = 'default' }: RDVSWrapperProps) {
  // Parse the layout configuration
  const layoutConfig = useMemo(() => {
    const config = parseLayoutString(variant);
    if (!config) {
      console.warn(`Invalid RDVS layout string: ${variant}, falling back to default`);
      return parseLayoutString('default')!;
    }
    return config;
  }, [variant]);
  const [currentPage, setCurrentPage] = useState(1);
  // OVR state pulled from store (tracks incoming override calls)
  const isBeingOverridden = useCoreStore((s: any) => s.isBeingOverridden);
  const overrideCallStatus = useCoreStore((s: any) => s.overrideCallStatus || 'off');

  // Keypad state - visibility, dial buffer, and IA mode
  const [keypadActive, setKeypadActive] = useState(false);
  const [dialBuffer, setDialBuffer] = useState('');
  const [iaMode, setIaMode] = useState(false); // true = IA keypad mode (SF tones), false = normal DTMF

  // Selected partial radio state - when a PARTIAL is clicked, its radioId is stored here
  // This causes: 1) white border around selected PARTIAL, 2) POPUP_RADIO shows this radio's data
  const [selectedPartialRadioId, setSelectedPartialRadioId] = useState<string | null>(null);

  // Activity Display state - two lines, 16 chars each
  const [activityLine1, setActivityLine1] = useState('');
  const [activityLine2, setActivityLine2] = useState('');
  const [showReadyMessage, setShowReadyMessage] = useState(true);

  // Show "READY" message for 2 seconds on initial load
  // Line 1 is the top/default line
  useEffect(() => {
    setActivityLine1('READY');
    setActivityLine2('');
    setShowReadyMessage(true);

    const timer = setTimeout(() => {
      setShowReadyMessage(false);
      setActivityLine1('');
      setActivityLine2('');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const sendMsg = useCoreStore((s: any) => s.sendMessageNow);
  const selectedPositions = useCoreStore((s: any) => s.selectedPositions);
  const gg_status = useCoreStore((s: any) => s.gg_status);
  const ag_status = useCoreStore((s: any) => s.ag_status);
  const ptt = useCoreStore((s: any) => s.ptt);
  const positionData = useCoreStore((s: any) => s.positionData);
  const holdBtn = useCoreStore((s: any) => s.holdBtn);
  const releaseBtn = useCoreStore((s: any) => s.releaseBtn);
  const setActiveDialLine = useCoreStore((s: any) => s.setActiveDialLine);
  const sendDialCall = useCoreStore((s: any) => s.sendDialCall);

  const currentPosition = selectedPositions?.[0] || null;

  // Get RDVS color pattern from facility config
  const rdvsColorPattern = useMemo(() => {
    if (!currentPosition?.cs || !positionData) return null;
    return findRdvsColorPattern(positionData, currentPosition.cs);
  }, [currentPosition?.cs, positionData]);

  // Helper to get color set by button type
  const getColorSet = (buttonType: keyof ButtonColorAssignments): ColorSetDef | null => {
    if (!rdvsColorPattern) return null;
    const setNumber = rdvsColorPattern.buttonAssignments[buttonType];
    return rdvsColorPattern.colorSets[setNumber] || null;
  };

  // Parse TED pattern config if present
  const parsedTEDLayout = useMemo(() => {
    const tedPattern = currentPosition?.tedPattern as TEDPatternConfig | undefined;
    if (!tedPattern) return null;
    return parseTEDPattern(tedPattern, currentPosition || {});
  }, [currentPosition]);

  // Check for TED config errors
  const tedConfigErrors = parsedTEDLayout?.errors || [];
  const hasTEDConfig = parsedTEDLayout !== null && tedConfigErrors.length === 0;

  // Determine handedness from TED pattern display config (LEFT = activity on left, RIGHT/NONE = activity on right)
  const handedness: 'left' | 'right' = parsedTEDLayout?.display === 'LEFT' ? 'left' :
    parsedTEDLayout?.display === 'RIGHT' || parsedTEDLayout?.display === 'NONE' ? 'right' : DEFAULT_handedness;

  // Build line buttons from position data
  const lineButtons = useMemo(() => {
    const btns: any[] = [];
    if (currentPosition?.lines) {
      currentPosition.lines.forEach((line: any) => {
        const lineType = Array.isArray(line) ? line[1] : line.type;
        const call_id = String(Array.isArray(line) ? line[0] : (line.id || ''));
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
            s?.call === call_id || s?.call?.endsWith('_' + call_id)
          ) || {};
        }

        const callStatus = statusObj.status || 'off';
        const callPrefix = statusObj?.call?.substring(0, 2);
        let indicatorState = 'off';

        // Per TI 6650.58 Table 2-5:
        // Off = idle | Steady-On = connection made | Flashing = incoming 1/sec 50/50
        // Winking = HOLD 1/sec 95/5 | Flutter = active at calling party 12/sec 80/20
        if (callStatus === 'hold') {
          indicatorState = 'winking';
        } else if (callStatus === 'busy') {
          indicatorState = 'on';
        } else if (lineType === 0) {
          if (callStatus === 'ok' || callStatus === 'active') {
            indicatorState = callPrefix === 'OV' ? 'flutter-green' : 'flutter';
          } else if (callStatus === 'chime' || callStatus === 'online') {
            indicatorState = 'flutter';
          }
        } else if (lineType === 1) {
          if (callStatus === 'chime' || callStatus === 'ringing') {
            indicatorState = 'flashing';
          } else if (callStatus === 'ok' || callStatus === 'active') {
            indicatorState = 'flutter';
          } else if (callStatus === 'online') {
            indicatorState = 'on';
          }
        } else if (lineType === 2) {
          if (callStatus === 'chime' || callStatus === 'ringing') {
            indicatorState = 'flashing';
          } else if (callStatus === 'ok' || callStatus === 'active') {
            indicatorState = 'flutter';
          } else if (callStatus === 'online') {
            indicatorState = 'on';
          }
        } else if (lineType === 3) {
          if (callStatus === 'ok' || callStatus === 'active') {
            indicatorState = 'flutter';
          } else if (callStatus === 'ringing') {
            indicatorState = 'flashing';
          }
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

  // Calculate max page based on TED pattern config or legacy line buttons
  const maxPage = useMemo(() => {
    if (hasTEDConfig && parsedTEDLayout) {
      // Use number of pages from TED pattern config
      return Math.max(1, parsedTEDLayout.pages.length);
    }
    // Legacy: based on line buttons
    return Math.max(1, Math.ceil(lineButtons.length / BUTTONS_PER_PAGE));
  }, [hasTEDConfig, parsedTEDLayout, lineButtons.length]);

  const pageStartIdx = (currentPage - 1) * BUTTONS_PER_PAGE;
  const pageButtons = lineButtons.slice(pageStartIdx, pageStartIdx + BUTTONS_PER_PAGE);

  // DA overflow: buttons from OTHER pages that have active indicators (not 'off')
  const overflowButtons = useMemo(() => {
    return lineButtons.filter((btn: any, idx: number) => {
      const isOnCurrentPage = idx >= pageStartIdx && idx < pageStartIdx + BUTTONS_PER_PAGE;
      return !isOnCurrentPage && btn.indicatorState !== 'off';
    });
  }, [lineButtons, pageStartIdx]);

  const setPage = (p: number) => {
    if (p < 1) setCurrentPage(1);
    else if (p > maxPage) setCurrentPage(maxPage);
    else setCurrentPage(p);
  };

  const formatFreq = (freq: number) => freq ? (freq / 1_000_000).toFixed(3) : '';

  // DA button click handler - per TI 6650.58 call handling spec
  // Matches state transitions from GroundGroundPage.tsx
  const handleLineClick = (btn: any) => {
    const { call_id, lineType, statusObj } = btn;
    const status = statusObj?.status || 'off';
    const callPrefix = statusObj?.call?.substring(0, 2);

    // Block clicks for non-actionable states
    if (['busy', 'pending', 'terminate', 'overridden'].includes(status)) return;

    // Per TI 6650.58 2.4.4.1(b): pressing DA on a held line picks up the call
    if (status === 'hold') {
      sendMsg({ type: 'call', cmd1: call_id, dbl1: lineType === 0 ? 0 : 2 });
      return;
    }

    if (lineType === 0) {
      // Override Intercom (2.4.3.1.5): off→flutter (immediate connection), ok→off (terminate)
      if (!status || status === 'off' || status === 'idle') {
        sendMsg({ type: 'call', cmd1: call_id, dbl1: 0 });
      } else if (status === 'ok' || status === 'active') {
        sendMsg({ type: 'stop', cmd1: call_id, dbl1: 0 });
      }
    } else if (lineType === 1) {
      // Ringback/Intercom (2.4.3.1.2): off→steady-on (ringback), chime→flutter (answer), ok→off (terminate)
      if (!status || status === 'off' || status === 'idle') {
        sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 });
      } else if (status === 'chime' || status === 'ringing' || status === 'online') {
        // Answer incoming call
        sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 });
      } else if (status === 'ok' || status === 'active') {
        sendMsg({ type: 'stop', cmd1: call_id, dbl1: callPrefix === 'SO' ? 1 : 2 });
      }
    } else if (lineType === 2) {
      // Interphone/Voice trunk (2.4.3.2): off→flutter (initiate), steady-on→flutter (join conference), flutter→off (terminate)
      if (!status || status === 'off' || status === 'idle') {
        sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 });
      } else if (status === 'chime' || status === 'ringing' || status === 'online') {
        // Answer or join conference
        sendMsg({ type: 'call', cmd1: call_id, dbl1: 2 });
      } else if (status === 'ok' || status === 'active') {
        sendMsg({ type: 'stop', cmd1: call_id, dbl1: callPrefix === 'SO' ? 1 : 2 });
      }
    } else if (lineType === 3) {
      // PBX/CO Trunk Dial (2.4.3.2.3): press → open keypad for dialing
      const trunkName = btn.line1 || '';
      setActiveDialLine({ trunkName, lineType: 3 });
      setKeypadActive(true);
      setIaMode(false);
      setDialBuffer('');
    }
  };

  // Get colors for a DA button based on line type
  // Returns { text, background, border, fillDesign } colors from color pattern or defaults
  const getDAButtonColors = (lineType: number | undefined): { text: string; background: string; border: string; fillDesign: FillDesign } => {
    // Type 0 = Override (intercomOverride), Type 1 = Call/Ringback (intercomRingback), Type 2 = Alert/Interphone (interphone), Type 3 = Dial (dialDigit)
    let buttonType: keyof ButtonColorAssignments = 'intercomRingback';
    if (lineType === 0) buttonType = 'intercomOverride';
    else if (lineType === 1) buttonType = 'intercomRingback';
    else if (lineType === 2) buttonType = 'interphone';
    else if (lineType === 3) buttonType = 'dialDigit';

    const colorSet = getColorSet(buttonType);
    if (colorSet) {
      return {
        text: colorSet.textColor,
        background: colorSet.backgroundColor,
        border: colorSet.borderColor,
        fillDesign: colorSet.fillDesign,
      };
    }

    // Fallback to system default colors (ZAB dark pattern) if no color pattern configured
    // Color Set 1: Normal DA (intercomOverride, intercomRingback) - cyan text, black bg, dark red border
    // Color Set 2: Significant DA (Interphone) - white text, blue bg, blue border
    // Color Set 3: Utility (dial) - white text, grey bg, grey border
    if (lineType === 0) return { text: COLORS.CYAN, background: COLORS.BLACK, border: COLORS.NORMAL_BORDER, fillDesign: 'solid' };       // Override = Color Set 1
    if (lineType === 1) return { text: COLORS.CYAN, background: COLORS.BLACK, border: COLORS.NORMAL_BORDER, fillDesign: 'solid' };       // Call/Intercom = Color Set 1
    if (lineType === 2) return { text: COLORS.WHITE, background: COLORS.INTERPHONE_BG, border: COLORS.INTERPHONE_BG, fillDesign: 'solid' }; // Interphone = Color Set 2
    if (lineType === 3) return { text: COLORS.WHITE, background: COLORS.UTILITY_BG, border: COLORS.UTILITY_BG, fillDesign: 'solid' };    // Dial = Color Set 3
    return { text: COLORS.WHITE, background: COLORS.BLACK, border: COLORS.BLACK, fillDesign: 'solid' };                                   // Empty
  };

  // Get colors for function buttons (special function)
  const getFunctionButtonColors = (): { text: string; background: string; border: string; fillDesign: FillDesign } => {
    const colorSet = getColorSet('specialFunction');
    if (colorSet) {
      return {
        text: colorSet.textColor,
        background: colorSet.backgroundColor,
        border: colorSet.borderColor,
        fillDesign: colorSet.fillDesign,
      };
    }
    // Fallback to system default - Color Set 3 (Utility)
    return { text: COLORS.CYAN, background: COLORS.UTILITY_BG, border: COLORS.BLACK, fillDesign: 'solid' };
  };

  // Detect emergency radio frequencies (121.5 MHz and 243.0 MHz)
  // These are international distress frequencies - detection based on frequency containing 1215 or 2430
  const isEmergencyFrequency = (freq: number): boolean => {
    if (!freq) return false;
    // Convert to string and check for emergency frequency patterns
    // 121.5 MHz = 121500000 Hz (contains "1215")
    // 243.0 MHz = 243000000 Hz (contains "2430")
    const freqStr = String(freq);
    return freqStr.includes('1215') || freqStr.includes('2430');
  };

  // Get colors for radio buttons
  const getRadioButtonColors = (isEmergency: boolean = false): { text: string; background: string; border: string; fillDesign: FillDesign } => {
    const buttonType = isEmergency ? 'emergencyRadio' : 'normalRadio';
    const colorSet = getColorSet(buttonType);
    if (colorSet) {
      return {
        text: colorSet.textColor,
        background: colorSet.backgroundColor,
        border: colorSet.borderColor,
        fillDesign: colorSet.fillDesign,
      };
    }
    // Fallback to system default colors
    // Normal radio = Color Set 1, Emergency radio = Color Set 4
    return isEmergency
      ? { text: COLORS.CYAN, background: COLORS.BLACK, border: COLORS.NORMAL_BORDER, fillDesign: 'interleaved' }  // Emergency = Color Set 4
      : { text: COLORS.CYAN, background: COLORS.BLACK, border: COLORS.NORMAL_BORDER, fillDesign: 'solid' };       // Normal = Color Set 1
  };

  // Legacy function for backwards compatibility
  const getButtonColor = (lineType: number | undefined, typeLetter: string) => {
    const colors = getDAButtonColors(lineType);
    return colors.border; // Return border color for legacy usage
  };

  // Check if a position is in a frequency quadrant (displayed as line panels instead of buttons)
  const isFrequencyQuadrant = (rowIdx: number, colIdx: number): boolean => {
    const quadrant = getQuadrant(rowIdx, colIdx);
    const quadrantIndex = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 }[quadrant];
    return layoutConfig.quadrants[quadrantIndex] === 'F';
  };

  // Check if a quadrant is mixed type (has function keys)
  const isMixedQuadrant = (quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4'): boolean => {
    const quadrantIndex = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 }[quadrant];
    return layoutConfig.quadrants[quadrantIndex] === 'M';
  };

  // Get function key label for a position (if it's a function key)
  const getFunctionKeyLabel = (rowIdx: number, colIdx: number): string | null => {
    const quadrant = getQuadrant(rowIdx, colIdx);
    const { qRow, qCol } = getQuadrantPosition(rowIdx, colIdx);
    const btnNum = getQuadrantButtonNum(qRow, qCol);

    // Check if this quadrant has function keys defined
    const quadrantFuncKeys = layoutConfig.funcKeys[quadrant];
    if (quadrantFuncKeys && quadrantFuncKeys[btnNum]) {
      return quadrantFuncKeys[btnNum];
    }

    return null;
  };

  // Function key click handler - dispatches to backend store functions
  const handleFunctionKey = (label: string) => {
    switch (label) {
      case 'HOLD': holdBtn(); break;
      case 'REL': releaseBtn(); break;
      case 'RECON': {
        // Reconnect: find first held call and re-connect
        const heldCall = gg_status?.find((s: any) => s.status === 'hold');
        if (heldCall) {
          const heldId = heldCall.call?.replace(/^(?:gg_\d+_|OV_|SO_)/, '') || '';
          if (heldId) sendMsg({ type: 'call', cmd1: heldId, dbl1: 2 });
        }
        break;
      }
      case 'FWD':
        // Forward: open keypad in IA-like mode for forwarding code entry
        setIaMode(true);
        setKeypadActive(true);
        setDialBuffer('FWD');
        break;
      case 'RB':
        // Ring-back: initiate ring-back call
        sendMsg({ type: 'call', cmd1: '891', dbl1: 2 });
        break;
      case 'HS_LS': {
        // Toggle HS/LS for currently selected radio
        if (selectedPartialRadioId) {
          const radio = currentPosition?.radios?.find((r: any) => r.id === selectedPartialRadioId);
          const agEntry = ag_status?.find((a: any) => a.freq === radio?.freq);
          if (agEntry) sendMsg({ type: 'set_hs', cmd1: '' + agEntry.freq, dbl1: !agEntry.h });
        }
        break;
      }
      case 'HL': holdBtn(); break;  // Hold & Link → best-effort: same as HOLD
      case 'OHL': holdBtn(); break; // Outgoing Hold Link → best-effort: same as HOLD
      case 'RHL': {
        // Reconnect Hold Link → best-effort: reconnect held call
        const heldCall = gg_status?.find((s: any) => s.status === 'hold');
        if (heldCall) {
          const heldId = heldCall.call?.substring(3) || '';
          if (heldId) sendMsg({ type: 'call', cmd1: heldId, dbl1: 2 });
        }
        break;
      }
      default:
        console.warn(`Function key ${label} not implemented`);
    }
  };

  // Render a function key button
  const renderFunctionButton = (label: string, rowIdx: number, colIdx: number) => {
    const w = BTN_WIDTH;
    const h = BTN_HEIGHT;
    const funcColors = getFunctionButtonColors();
    const fillValue = getFillValue(funcColors.fillDesign, funcColors.background, funcColors.border);

    // Special HS/LS stacked button for rdvs-2
    // Rect is 30px wide starting at x=4, so ends at x=34. Circle r=6, center at 34 + 12 (gap) + 6 (radius) = 52
    if (label === 'HS_LS') {
      const circleX = 52; // 30px rect + 4px start + 12px gap + 6px radius = 52px center for circle
      return (
        <svg
          key={`func-${rowIdx}-${colIdx}`}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={{ cursor: 'pointer' }}
          onClick={() => handleFunctionKey('HS_LS')}
        >
          <FillPatternDefs color={funcColors.border} />
          <rect x="0" y="0" width={w} height={h} fill={fillValue} stroke={funcColors.border} strokeWidth="4" />
          {/* HS row */}
          <rect x="4" y="4" width="30" height="18" fill="none" stroke={COLORS.GREEN} strokeWidth="1" />
          <text x="19" y="17" textAnchor="middle" fill={funcColors.text} fontSize="11" fontFamily="RDVSimulated, monospace" fontWeight="100">HS</text>
          <circle cx={circleX} cy="13" r="6" fill={COLORS.BLACK} stroke={COLORS.RED} strokeWidth="1" />
          {/* LS row */}
          <rect x="4" y={h - 22} width="30" height="18" fill="none" stroke={COLORS.GREEN} strokeWidth="1" />
          <text x="19" y={h - 9} textAnchor="middle" fill={funcColors.text} fontSize="11" fontFamily="RDVSimulated, monospace" fontWeight="100">LS</text>
          <circle cx={circleX} cy={h - 13} r="6" fill={COLORS.BLACK} stroke={COLORS.RED} strokeWidth="1" />
        </svg>
      );
    }

    // Same indicator positioning as DA buttons
    const indicatorSize = 16;
    const indicatorMargin = 3; // 1px padding from bottom edge
    const indicatorY = h - indicatorSize - indicatorMargin;

    // Single line text at Y=22 (same as single-line DA buttons)
    const textY = 22;

    return (
      <svg
        key={`func-${rowIdx}-${colIdx}`}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ cursor: 'pointer' }}
        onClick={() => handleFunctionKey(label)}
      >
        <FillPatternDefs color={funcColors.border} />
        <rect x="0" y="0" width={w} height={h} fill={fillValue} stroke={funcColors.border} strokeWidth="4" />
        <text
          x={w / 2}
          y={textY}
          textAnchor="middle"
          fill={funcColors.text}
          fontSize={16}
          fontFamily="RDVSimulated, monospace"
          fontWeight="100"
        >
          {label}
        </text>
        <rect x={(w - indicatorSize) / 2} y={indicatorY} width={indicatorSize} height={indicatorSize} fill={COLORS.BLACK} stroke={funcColors.text} strokeWidth="1" />
      </svg>
    );
  };

  // Count station button positions before this position (for indexing into pageButtons)
  const getStationButtonIndex = (rowIdx: number, colIdx: number): number => {
    let idx = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (r === rowIdx && c === colIdx) return idx;
        // Skip frequency quadrants
        if (isFrequencyQuadrant(r, c)) continue;
        // Skip function keys
        if (getFunctionKeyLabel(r, c)) continue;
        idx++;
      }
    }
    return idx;
  };

  // SVG SMIL indicator renderer - returns <rect> with optional <animate> for flashing/winking/flutter
  // Per TI 6650.58 Table 2-5 timing specifications
  const renderIndicator = (state: string, x: number, y: number, size: number, typeLetter?: string) => {
    const baseRect = { x, y, width: size, height: size, stroke: COLORS.CYAN, strokeWidth: 1 };
    const textX = x + size / 2;
    const textY = y + size / 2 + 4;
    const letterEl = typeLetter ? (
      <text x={textX} y={textY} textAnchor="middle" fill={COLORS.WHITE} fontSize={12} fontFamily="RDVSimulated, monospace" fontWeight="100">{typeLetter}</text>
    ) : null;

    switch (state) {
      case 'on': // Steady-On: solid green, no animation
        return <>{React.createElement('rect', { ...baseRect, fill: COLORS.GREEN })}{letterEl}</>;
      case 'flashing': // Incoming call: 1/sec, 50/50 on/off
        return <>
          {React.createElement('rect', { ...baseRect, fill: COLORS.GREEN },
            React.createElement('animate', { attributeName: 'fill', values: `${COLORS.GREEN};${COLORS.BLACK}`, dur: '1s', repeatCount: 'indefinite' })
          )}
          {letterEl}
        </>;
      case 'winking': // HOLD: 1/sec, 95/5 on/off
        return <>
          {React.createElement('rect', { ...baseRect, fill: COLORS.GREEN },
            React.createElement('animate', { attributeName: 'fill', values: `${COLORS.GREEN};${COLORS.GREEN};${COLORS.BLACK}`, keyTimes: '0;0.95;1', dur: '1s', repeatCount: 'indefinite' })
          )}
          {letterEl}
        </>;
      case 'flutter': // Active call: 12/sec (83ms), 80/20 on/off
        return <>
          {React.createElement('rect', { ...baseRect, fill: COLORS.GREEN },
            React.createElement('animate', { attributeName: 'fill', values: `${COLORS.GREEN};${COLORS.BLACK}`, keyTimes: '0;0.8', dur: '0.083s', repeatCount: 'indefinite' })
          )}
          {letterEl}
        </>;
      case 'flutter-green': // Override active: 12/sec green
        return <>
          {React.createElement('rect', { ...baseRect, fill: '#93ca63' },
            React.createElement('animate', { attributeName: 'fill', values: '#93ca63;#000000', keyTimes: '0;0.8', dur: '0.083s', repeatCount: 'indefinite' })
          )}
          {letterEl}
        </>;
      default: // Off: black fill
        return <>{React.createElement('rect', { ...baseRect, fill: COLORS.BLACK })}{letterEl}</>;
    }
  };

  // Render a station selector button using SVG (scaled for 800x600)
  const renderStationButton = (rowIdx: number, colIdx: number) => {
    const w = BTN_WIDTH;
    const h = BTN_HEIGHT;

    // Skip frequency quadrant positions (they're rendered as line panels)
    if (isFrequencyQuadrant(rowIdx, colIdx)) {
      return null;
    }

    // Check if this is a function key position
    const funcLabel = getFunctionKeyLabel(rowIdx, colIdx);
    if (funcLabel) {
      return renderFunctionButton(funcLabel, rowIdx, colIdx);
    }

    // Get the station button for this position
    const stationIdx = getStationButtonIndex(rowIdx, colIdx);
    const btn = pageButtons[stationIdx];

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

    // Get colors from color pattern (or fallback to legacy)
    const daColors = getDAButtonColors(lineType);
    const bgColor = daColors.background;
    const strokeColor = daColors.border;
    const textColor = daColors.text;
    const fillDesign = daColors.fillDesign;

    // Get the actual fill value based on fill design
    const fillValue = getFillValue(fillDesign, bgColor, strokeColor);

    // Format labels: line1 max 5 chars, line2 max 2 chars (centered)
    const displayLine1 = (line1 || '').substring(0, 5);
    const displayLine2 = (line2 || '').substring(0, 2);

    // Indicator rect at bottom of button (with small margin)
    const indicatorSize = 16;
    const indicatorMargin = 3; // 1px padding from bottom edge
    const indicatorY = h - indicatorSize - indicatorMargin;

    // Fixed Y positions for text (adjusted +2px after removing dominantBaseline)
    const hasLine2 = !!displayLine2;
    const line1Y = hasLine2 ? 15 : 22; // Single line: Y=22, Double line 1: Y=15
    const line2Y = 30; // Double line 2: Y=30

    return (
      <svg
        key={`btn-${rowIdx}-${colIdx}`}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ cursor: 'pointer' }}
        onClick={() => handleLineClick(btn)}
      >
        {/* Include pattern definitions for this button's border color */}
        <FillPatternDefs color={strokeColor} />
        <rect x="0" y="0" width={w} height={h} fill={fillValue} stroke={strokeColor} strokeWidth="4" />
        <text
          x={w / 2}
          y={line1Y}
          textAnchor="middle"
          fill={textColor}
          fontSize={16}
          fontFamily="RDVSimulated, monospace"
          fontWeight="100"
        >
          {displayLine1}
        </text>
        {displayLine2 && (
          <text
            x={w / 2}
            y={line2Y}
            textAnchor="middle"
            fill={textColor}
            fontSize={16}
            fontFamily="RDVSimulated, monospace"
            fontWeight="100"
          >
            {displayLine2}
          </text>
        )}
        {/* L/NL indicator box with SMIL animation per TI 6650.58 */}
        {renderIndicator(indicatorState, (w - indicatorSize) / 2, indicatorY, indicatorSize, typeLetter)}
      </svg>
    );
  };

  // Render line control panel (right side) - scaled for 800x600
  // Uses 5 equal-width cells matching station button width
  // Map radioId to ag_status entry by matching frequency
  const getRadioAgStatus = (radioId: string) => {
    const radio = currentPosition?.radios?.find((r: any) => r.id === radioId);
    if (!radio?.freq) return null;
    return ag_status?.find((a: any) => a.freq === radio.freq) || null;
  };

  const renderLineControlPanel = (rowIdx: number) => {
    const ag = ag_status?.[rowIdx] || {};
    const freq = ag.freq || 0;
    const isRx = !!ag.r;
    const isTx = !!ag.t;
    const isHs = !!ag.h;
    const isLs = !!ag.l;

    // Check if this is an emergency frequency (121.5 MHz or 243.0 MHz)
    const isEmergency = isEmergencyFrequency(freq);
    const radioColors = getRadioButtonColors(isEmergency);
    const radioFillValue = getFillValue(radioColors.fillDesign, radioColors.background, radioColors.border);

    // 5 cells fill the quadrant width (5 grid cells + 4 gaps) with no internal gaps
    // Quadrant width = 5 * CELL_WIDTH + 4 * GAP = 384px, divide by 5 cells with remainder distribution
    const quadrantWidth = 5 * CELL_WIDTH + 4 * GAP;
    const baseCellW = Math.floor(quadrantWidth / 5);
    const remainder = quadrantWidth - (baseCellW * 5);
    // First 'remainder' cells get 1 extra pixel each
    const cellW0 = baseCellW + (0 < remainder ? 1 : 0);
    const cellW1 = baseCellW + (1 < remainder ? 1 : 0);
    const cellW2 = baseCellW + (2 < remainder ? 1 : 0);
    const cellW3 = baseCellW + (3 < remainder ? 1 : 0);
    const cellW4 = baseCellW + (4 < remainder ? 1 : 0);
    const cellH = BTN_HEIGHT;

    return (
      <div
        key={`line-${rowIdx}`}
        style={{
          display: 'flex',
          gap: '0px',
          width: '100%',
        }}
      >
        {/* Cell 1: HS/LS Section - clickable to toggle headset/loudspeaker */}
        {/* First cell: outer border on left, top, bottom; right edge is internal divider */}
        <svg width={cellW0} height={cellH} viewBox={`0 0 ${cellW0} ${cellH}`} style={{ display: 'block', flexShrink: 0, cursor: 'pointer' }}
          onClick={() => freq && sendMsg({ type: 'set_hs', cmd1: '' + freq, dbl1: !isHs })}>
          <FillPatternDefs color={radioColors.border} />
          <rect x="0" y="0" width={cellW0} height={cellH} fill={radioFillValue} stroke="none" />
          {/* Outer borders: left, top, bottom */}
          <line x1="1" y1="0" x2="1" y2={cellH} stroke={radioColors.border} strokeWidth="2" />
          <line x1="0" y1="1" x2={cellW0} y2="1" stroke={radioColors.border} strokeWidth="2" />
          <line x1="0" y1={cellH - 1} x2={cellW0} y2={cellH - 1} stroke={radioColors.border} strokeWidth="2" />
          {/* Right divider */}
          <line x1={cellW0 - 1} y1="0" x2={cellW0 - 1} y2={cellH} stroke={radioColors.border} strokeWidth="2" />
          <text x="6" y="20" fill={isHs ? COLORS.GREEN : COLORS.WHITE} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">HS</text>
          <text x="6" y="40" fill={isLs ? COLORS.GREEN : COLORS.WHITE} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">LS</text>
          {/* HS indicator box - top half */}
          <line x1="38" y1="8" x2="54" y2="8" stroke={COLORS.GREEN} strokeWidth="1" />
          <line x1="38" y1="8" x2="38" y2="27" stroke={COLORS.GREEN} strokeWidth="1" />
          <line x1="54" y1="8" x2="54" y2="27" stroke={COLORS.GREEN} strokeWidth="1" />
          <rect x="39" y="9" width="14" height="17" fill={isHs ? COLORS.GREEN : 'none'} stroke="none" />
          {/* LS indicator box - bottom half */}
          <line x1="38" y1="27" x2="38" y2="46" stroke={COLORS.GREEN} strokeWidth="1" />
          <line x1="54" y1="27" x2="54" y2="46" stroke={COLORS.GREEN} strokeWidth="1" />
          <line x1="38" y1="46" x2="54" y2="46" stroke={COLORS.GREEN} strokeWidth="1" />
          <rect x="39" y="28" width="14" height="17" fill={isLs ? COLORS.GREEN : 'none'} stroke="none" />
        </svg>

        {/* Cell 2: RX Section - clickable to toggle RX selection */}
        {/* Middle cells: top, bottom borders; right divider */}
        <svg width={cellW1} height={cellH} viewBox={`0 0 ${cellW1} ${cellH}`} style={{ display: 'block', flexShrink: 0, cursor: 'pointer' }}
          onClick={() => freq && sendMsg({ type: 'rx', cmd1: '' + freq, dbl1: !isRx })}>
          <FillPatternDefs color={radioColors.border} />
          <rect x="0" y="0" width={cellW1} height={cellH} fill={radioFillValue} stroke="none" />
          <line x1="0" y1="1" x2={cellW1} y2="1" stroke={radioColors.border} strokeWidth="2" />
          <line x1="0" y1={cellH - 1} x2={cellW1} y2={cellH - 1} stroke={radioColors.border} strokeWidth="2" />
          <line x1={cellW1 - 1} y1="0" x2={cellW1 - 1} y2={cellH} stroke={radioColors.border} strokeWidth="2" />
          <text x="6" y="18" fill={COLORS.WHITE} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">RX</text>
          <rect x="30" y="6" width="30" height="15" fill={isRx ? COLORS.GREEN : 'none'} stroke={COLORS.GREEN} strokeWidth="1" />
          <text x="3" y="42" fill={COLORS.WHITE} fontSize="18" fontFamily="RDVSimulated, monospace" fontWeight="100">{(freq / 1_000_000).toFixed(2)}</text>
        </svg>

        {/* Cell 3: M/S Section - all radio panel text is white */}
        <svg width={cellW2} height={cellH} viewBox={`0 0 ${cellW2} ${cellH}`} style={{ display: 'block', flexShrink: 0 }}>
          <FillPatternDefs color={radioColors.border} />
          <rect x="0" y="0" width={cellW2} height={cellH} fill={radioFillValue} stroke="none" />
          <line x1="0" y1="1" x2={cellW2} y2="1" stroke={radioColors.border} strokeWidth="2" />
          <line x1="0" y1={cellH - 1} x2={cellW2} y2={cellH - 1} stroke={radioColors.border} strokeWidth="2" />
          <line x1={cellW2 - 1} y1="0" x2={cellW2 - 1} y2={cellH} stroke={radioColors.border} strokeWidth="2" />
          <text x="6" y="18" fill={COLORS.WHITE} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">M/S</text>
          <rect x="44" y="6" width="15" height="15" fill={COLORS.GREEN} stroke={COLORS.GREEN} strokeWidth="1" />
          <text x="51" y="18" textAnchor="middle" fill={COLORS.BLACK} fontSize="15" fontFamily="RDVSimulated, monospace" fontWeight="100">M</text>
        </svg>

        {/* Cell 4: TX Section - clickable to toggle TX selection */}
        <svg width={cellW3} height={cellH} viewBox={`0 0 ${cellW3} ${cellH}`} style={{ display: 'block', flexShrink: 0, cursor: 'pointer' }}
          onClick={() => freq && sendMsg({ type: 'tx', cmd1: '' + freq, dbl1: !isTx })}>
          <FillPatternDefs color={radioColors.border} />
          <rect x="0" y="0" width={cellW3} height={cellH} fill={radioFillValue} stroke="none" />
          <line x1="0" y1="1" x2={cellW3} y2="1" stroke={radioColors.border} strokeWidth="2" />
          <line x1="0" y1={cellH - 1} x2={cellW3} y2={cellH - 1} stroke={radioColors.border} strokeWidth="2" />
          <line x1={cellW3 - 1} y1="0" x2={cellW3 - 1} y2={cellH} stroke={radioColors.border} strokeWidth="2" />
          <text x="6" y="18" fill={COLORS.WHITE} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">TX</text>
          <rect x="30" y="6" width="30" height="15" fill={isTx ? COLORS.GREEN : 'none'} stroke={COLORS.GREEN} strokeWidth="1" />
          {/* TX radial selector */}
          <circle cx="45" cy="34" r="6" fill={COLORS.BLACK} stroke={radioColors.border} strokeWidth="1" />
        </svg>

        {/* Cell 5: Secondary M/S Section - all radio panel text is white */}
        {/* Last cell: top, bottom, right outer borders */}
        <svg width={cellW4} height={cellH} viewBox={`0 0 ${cellW4} ${cellH}`} style={{ display: 'block', flexShrink: 0 }}>
          <FillPatternDefs color={radioColors.border} />
          <rect x="0" y="0" width={cellW4} height={cellH} fill={radioFillValue} stroke="none" />
          <line x1="0" y1="1" x2={cellW4} y2="1" stroke={radioColors.border} strokeWidth="2" />
          <line x1="0" y1={cellH - 1} x2={cellW4} y2={cellH - 1} stroke={radioColors.border} strokeWidth="2" />
          <line x1={cellW4 - 1} y1="0" x2={cellW4 - 1} y2={cellH} stroke={radioColors.border} strokeWidth="2" />
          <text x="6" y="18" fill={COLORS.WHITE} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">M/S</text>
          <rect x="44" y="6" width="15" height="15" fill={COLORS.GREEN} stroke={COLORS.GREEN} strokeWidth="1" />
          <text x="51" y="18" textAnchor="middle" fill={COLORS.BLACK} fontSize="15" fontFamily="RDVSimulated, monospace" fontWeight="100">M</text>
        </svg>
      </div>
    );
  };

  // Render PARTIAL radio panel (radio selector module)
  // Layout based on FAA reference:
  // Row 1: Hs/HL (top-left), Rx indicator (middle), Tx (top-right) - font size 15
  // Row 2: Large frequency (bottom-left) - font size 21, truncated to 2 decimal places
  // PTT radial circle (bottom-right) - radius 6, stroke 2
  // Up to 3 partial radios fit across one quadrant row (col 1, 2, or 3)
  // isSelected: when true, white border is drawn around the panel (in gap space)
  // onClick: callback when the partial radio is clicked
  const renderPartialRadio = (
    radioId: string,
    width: number,
    height: number,
    isSelected: boolean = false,
    onClick?: () => void
  ) => {
    // Find radio data from position
    const radio = currentPosition?.radios?.find((r: any) => r.id === radioId);
    const freq = radio?.freq || 0;
    const hasFrequency = freq > 0;

    // Format frequency with only 2 decimal places (truncated)
    const formatFreqShort = (f: number) => f ? (f / 1_000_000).toFixed(2) : '';

    // Check if this is an emergency frequency
    const isEmergency = isEmergencyFrequency(freq);
    const radioColors = getRadioButtonColors(isEmergency);
    const radioFillValue = getFillValue(radioColors.fillDesign, radioColors.background, radioColors.border);

    // Map radioId to proper ag_status entry by matching frequency
    const radioStatus = getRadioAgStatus(radioId) || {};
    const isRx = !!radioStatus.r;
    const isTx = !!radioStatus.t;
    const isPtt = isTx; // PTT indicator matches TX state

    // Colors for top row labels:
    // - Hs label: always lime green (if frequency exists), dark gray for "HL" (no frequency)
    // - Rx/Tx: dark gray when inactive, lime green when active
    const inactiveColor = COLORS.GREY;
    const activeColor = COLORS.GREEN;

    // Top row label: "Hs" (always green) if frequency configured, "HL" (dark gray) if not
    const topLeftLabel = hasFrequency ? 'Hs' : 'HL';
    const topLeftColor = hasFrequency ? activeColor : inactiveColor;

    // Frequency color: uses configured text color from color pattern
    const frequencyColor = radioColors.text;

    // Calculate positions - top row centered vertically in upper half
    const padding = 6;
    const topRowY = 18; // For font size 15, baseline position
    const bottomRowY = height - 10; // For font size 21, baseline position

    // PTT circle - radius 6, stroke 2, centered vertically with bottom row text
    const pttRadius = 6;
    const pttX = width - padding - pttRadius;
    const pttCenterY = bottomRowY - 7; // Vertically centered with text baseline

    // Selection border offset - drawn in the gap space around the panel
    // Use negative offset to draw outside the main SVG bounds
    const selectionBorderWidth = 2;
    const selectionOffset = GAP / 2; // Half the gap for the selection border

    return (
      <div
        style={{
          position: 'relative',
          width: `${width}px`,
          height: `${height}px`,
          cursor: 'pointer',
        }}
        onClick={onClick}
      >
        {/* Selection border - white border in the gap space when selected */}
        {isSelected && (
          <div
            style={{
              position: 'absolute',
              top: `-${selectionOffset}px`,
              left: `-${selectionOffset}px`,
              width: `${width + selectionOffset * 2}px`,
              height: `${height + selectionOffset * 2}px`,
              border: `${selectionBorderWidth}px solid ${COLORS.WHITE}`,
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }}
          />
        )}
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ display: 'block', overflow: 'hidden' }}
        >
          <FillPatternDefs color={radioColors.border} />
          {/* Panel background - stroke is inset by 1px (strokeWidth/2) to prevent overflow */}
          <rect x="1" y="1" width={width - 2} height={height - 2} fill={radioFillValue} stroke={radioColors.border} strokeWidth="2" />

          {/* Row 1: Hs/HL (top-left), Rx (middle), Tx (top-right) - font size 15 */}
          {/* Hs label - always lime green when frequency exists, dark gray "HL" otherwise */}
          <text
            x={padding}
            y={topRowY}
            fill={topLeftColor}
            fontSize="15"
            fontFamily="RDVSimulated, monospace"
            fontWeight="100"
          >
            {topLeftLabel}
          </text>

          {/* Rx indicator - top middle, lime green when active */}
          <text
            x={width / 2}
            y={topRowY}
            textAnchor="middle"
            fill={isRx ? activeColor : inactiveColor}
            fontSize="15"
            fontFamily="RDVSimulated, monospace"
            fontWeight="100"
          >
            Rx
          </text>

          {/* Tx label - top right, lime green when active */}
          <text
            x={width - padding}
            y={topRowY}
            textAnchor="end"
            fill={isTx ? activeColor : inactiveColor}
            fontSize="15"
            fontFamily="RDVSimulated, monospace"
            fontWeight="100"
          >
            Tx
          </text>

          {/* Row 2: Large frequency (bottom-left) - font size 21, truncated to 2 decimals */}
          <text
            x={padding}
            y={bottomRowY}
            fill={frequencyColor}
            fontSize="21"
            fontFamily="RDVSimulated, monospace"
            fontWeight="100"
          >
            {formatFreqShort(freq)}
          </text>

          {/* PTT indicator - red radial circle, radius 6, stroke 2 */}
          {/* Centered vertically with frequency text, shows filled red when PTT is pressed */}
          <circle
            cx={pttX}
            cy={pttCenterY}
            r={pttRadius}
            fill={isPtt ? COLORS.RED : COLORS.BLACK}
            stroke={COLORS.RED}
            strokeWidth="2"
          />
        </svg>
      </div>
    );
  };

  // Render a TED pattern cell based on its type
  const renderTEDCell = (cell: ParsedCell, key: string) => {
    const { config, gridRow, gridCol, colSpan } = cell;
    const w = colSpan * CELL_WIDTH + (colSpan - 1) * GAP;
    const h = CELL_HEIGHT;

    switch (config.type) {
      case 'DA': {
        // Find line data by lineId
        const lineId = config.lineId || '';
        const lineData = findLineById(currentPosition || {}, lineId);
        if (!lineData) {
          // Render empty placeholder for missing line
          return (
            <svg key={key} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
              <rect x="0" y="0" width={w} height={h} fill={COLORS.BLACK} stroke={COLORS.RED} strokeWidth="1" />
              <text x={w / 2} y={h / 2} textAnchor="middle" fill={COLORS.RED} fontSize="10" fontFamily="RDVSimulated, monospace">
                ERR
              </text>
            </svg>
          );
        }

        // Build button data similar to lineButtons
        const { call_id, type: lineType, label } = lineData;

        // Handle label display: supports comma-separated or auto-wrap for 7+ chars
        // If comma-separated: first part on line 1, second on line 2
        // If no comma and >5 chars: first 5 on line 1, remaining (up to 2) on line 2
        let line1 = '';
        let line2 = '';
        if (label.includes(',')) {
          const parts = label.split(',');
          line1 = parts[0]?.trim() || '';
          line2 = parts[1]?.trim() || '';
        } else {
          // Auto-wrap: 5 chars max on line 1, remainder on line 2
          line1 = label.substring(0, 5).trim();
          line2 = label.length > 5 ? label.substring(5, 7).trim() : '';
        }

        let typeLetter = '';
        if (lineType === 0) typeLetter = 'O';
        else if (lineType === 1) typeLetter = 'C';
        else if (lineType === 2) typeLetter = 'A';

        // Find status
        const statusObj = gg_status?.find((s: any) =>
          s?.call === call_id || s?.call?.endsWith('_' + call_id)
        ) || {};

        const callStatus = statusObj.status || 'off';
        const callPrefix = statusObj?.call?.substring(0, 2);
        let indicatorState = 'off';
        if (callStatus === 'hold') {
          indicatorState = 'winking';
        } else if (callStatus === 'busy') {
          indicatorState = 'on';
        } else if (lineType === 0) {
          if (callStatus === 'ok' || callStatus === 'active') {
            indicatorState = callPrefix === 'OV' ? 'flutter-green' : 'flutter';
          } else if (callStatus === 'chime' || callStatus === 'online') {
            indicatorState = 'flutter';
          }
        } else if (lineType === 1) {
          if (callStatus === 'chime' || callStatus === 'ringing') {
            indicatorState = 'flashing';
          } else if (callStatus === 'ok' || callStatus === 'active') {
            indicatorState = 'flutter';
          } else if (callStatus === 'online') {
            indicatorState = 'on';
          }
        } else if (lineType === 2) {
          if (callStatus === 'chime' || callStatus === 'ringing') {
            indicatorState = 'flashing';
          } else if (callStatus === 'ok' || callStatus === 'active') {
            indicatorState = 'flutter';
          } else if (callStatus === 'online') {
            indicatorState = 'on';
          }
        } else if (lineType === 3) {
          if (callStatus === 'ok' || callStatus === 'active') {
            indicatorState = 'flutter';
          } else if (callStatus === 'ringing') {
            indicatorState = 'flashing';
          }
        }

        const btn = { call_id, lineType, typeLetter, line1, line2, indicatorState, statusObj };

        // Get colors from color pattern (or fallback to legacy)
        const daColors = getDAButtonColors(lineType);
        const bgColor = daColors.background;
        const strokeColor = daColors.border;
        const textColor = daColors.text;
        const fillDesign = daColors.fillDesign;
        const fillValue = getFillValue(fillDesign, bgColor, strokeColor);

        const displayLine1 = (line1 || '').substring(0, 5);
        const displayLine2 = (line2 || '').substring(0, 2);

        const indicatorSize = 16;
        const indicatorMargin = 3;
        const indicatorY = h - indicatorSize - indicatorMargin;
        const hasLine2 = !!displayLine2;
        const line1Y = hasLine2 ? 15 : 22;
        const line2Y = 30;

        return (
          <svg
            key={key}
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            style={{ cursor: 'pointer' }}
            onClick={() => handleLineClick(btn)}
          >
            <FillPatternDefs color={strokeColor} />
            <rect x="0" y="0" width={w} height={h} fill={fillValue} stroke={strokeColor} strokeWidth="4" />
            <text x={w / 2} y={line1Y} textAnchor="middle" fill={textColor} fontSize={16} fontFamily="RDVSimulated, monospace" fontWeight="100">
              {displayLine1}
            </text>
            {displayLine2 && (
              <text x={w / 2} y={line2Y} textAnchor="middle" fill={textColor} fontSize={16} fontFamily="RDVSimulated, monospace" fontWeight="100">
                {displayLine2}
              </text>
            )}
            {/* L/NL indicator box with SMIL animation per TI 6650.58 */}
            {renderIndicator(indicatorState, (w - indicatorSize) / 2, indicatorY, indicatorSize, typeLetter)}
          </svg>
        );
      }

      case 'RADIO': {
        // Find radio data by radioId
        const radioId = config.radioId || '';
        const radio = currentPosition?.radios?.find((r: any) => r.id === radioId);
        if (!radio) {
          return (
            <svg key={key} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
              <rect x="0" y="0" width={w} height={h} fill={COLORS.BLACK} stroke={COLORS.RED} strokeWidth="1" />
              <text x={w / 2} y={h / 2} textAnchor="middle" fill={COLORS.RED} fontSize="10" fontFamily="RDVSimulated, monospace">
                NO RADIO
              </text>
            </svg>
          );
        }

        // Render full line control panel for this radio - matching renderLineControlPanel styling
        const freq = radio.freq || 0;

        // Check if this is an emergency frequency
        const isEmergency = isEmergencyFrequency(freq);
        const radioColors = getRadioButtonColors(isEmergency);
        const radioFillValue = getFillValue(radioColors.fillDesign, radioColors.background, radioColors.border);

        const radioStatus = getRadioAgStatus(radioId) || {};
        const isRx = !!radioStatus.r;
        const isTx = !!radioStatus.t;
        const isHs = !!radioStatus.h;
        const isLs = !!radioStatus.l;

        // 5 cells fill the quadrant width (5 grid cells + 4 gaps) with no internal gaps
        // Quadrant width = 5 * CELL_WIDTH + 4 * GAP = 384px, divide by 5 cells with remainder distribution
        const quadrantWidth = 5 * CELL_WIDTH + 4 * GAP;
        const baseCellW = Math.floor(quadrantWidth / 5);
        const remainder = quadrantWidth - (baseCellW * 5);
        // First 'remainder' cells get 1 extra pixel each
        const cellW0 = baseCellW + (0 < remainder ? 1 : 0);
        const cellW1 = baseCellW + (1 < remainder ? 1 : 0);
        const cellW2 = baseCellW + (2 < remainder ? 1 : 0);
        const cellW3 = baseCellW + (3 < remainder ? 1 : 0);
        const cellW4 = baseCellW + (4 < remainder ? 1 : 0);
        const cellH = h;

        return (
          <div key={key} style={{ display: 'flex', gap: '0px', width: '100%' }}>
            {/* Cell 1: HS/LS Section - clickable to toggle headset/loudspeaker */}
            {/* First cell: outer border on left, top, bottom; right edge is internal divider */}
            <svg width={cellW0} height={cellH} viewBox={`0 0 ${cellW0} ${cellH}`} style={{ display: 'block', flexShrink: 0, cursor: 'pointer' }}
              onClick={() => freq && sendMsg({ type: 'set_hs', cmd1: '' + freq, dbl1: !isHs })}>
              <FillPatternDefs color={radioColors.border} />
              <rect x="0" y="0" width={cellW0} height={cellH} fill={radioFillValue} stroke="none" />
              {/* Outer borders: left, top, bottom */}
              <line x1="1" y1="0" x2="1" y2={cellH} stroke={radioColors.border} strokeWidth="2" />
              <line x1="0" y1="1" x2={cellW0} y2="1" stroke={radioColors.border} strokeWidth="2" />
              <line x1="0" y1={cellH - 1} x2={cellW0} y2={cellH - 1} stroke={radioColors.border} strokeWidth="2" />
              {/* Right divider */}
              <line x1={cellW0 - 1} y1="0" x2={cellW0 - 1} y2={cellH} stroke={radioColors.border} strokeWidth="2" />
              <text x="6" y="20" fill={isHs ? COLORS.GREEN : COLORS.WHITE} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">HS</text>
              <text x="6" y="40" fill={isLs ? COLORS.GREEN : COLORS.WHITE} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">LS</text>
              {/* HS indicator box - top half */}
              <line x1="38" y1="8" x2="54" y2="8" stroke={COLORS.GREEN} strokeWidth="1" />
              <line x1="38" y1="8" x2="38" y2="27" stroke={COLORS.GREEN} strokeWidth="1" />
              <line x1="54" y1="8" x2="54" y2="27" stroke={COLORS.GREEN} strokeWidth="1" />
              <rect x="39" y="9" width="14" height="17" fill={isHs ? COLORS.GREEN : 'none'} stroke="none" />
              {/* LS indicator box - bottom half */}
              <line x1="38" y1="27" x2="38" y2="46" stroke={COLORS.GREEN} strokeWidth="1" />
              <line x1="54" y1="27" x2="54" y2="46" stroke={COLORS.GREEN} strokeWidth="1" />
              <line x1="38" y1="46" x2="54" y2="46" stroke={COLORS.GREEN} strokeWidth="1" />
              <rect x="39" y="28" width="14" height="17" fill={isLs ? COLORS.GREEN : 'none'} stroke="none" />
            </svg>

            {/* Cell 2: RX Section - all radio panel text is white */}
            {/* Middle cells: top, bottom borders; right divider */}
            <svg width={cellW1} height={cellH} viewBox={`0 0 ${cellW1} ${cellH}`} style={{ display: 'block', flexShrink: 0, cursor: 'pointer' }}
              onClick={() => freq && sendMsg({ type: 'rx', cmd1: '' + freq, dbl1: !isRx })}>
              <FillPatternDefs color={radioColors.border} />
              <rect x="0" y="0" width={cellW1} height={cellH} fill={radioFillValue} stroke="none" />
              <line x1="0" y1="1" x2={cellW1} y2="1" stroke={radioColors.border} strokeWidth="2" />
              <line x1="0" y1={cellH - 1} x2={cellW1} y2={cellH - 1} stroke={radioColors.border} strokeWidth="2" />
              <line x1={cellW1 - 1} y1="0" x2={cellW1 - 1} y2={cellH} stroke={radioColors.border} strokeWidth="2" />
              <text x="6" y="18" fill={COLORS.WHITE} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">RX</text>
              <rect x="30" y="6" width="30" height="15" fill={isRx ? COLORS.GREEN : 'none'} stroke={COLORS.GREEN} strokeWidth="1" />
              <text x="3" y="42" fill={COLORS.WHITE} fontSize="18" fontFamily="RDVSimulated, monospace" fontWeight="100">{(freq / 1_000_000).toFixed(2)}</text>
            </svg>

            {/* Cell 3: M/S Section - all radio panel text is white */}
            <svg width={cellW2} height={cellH} viewBox={`0 0 ${cellW2} ${cellH}`} style={{ display: 'block', flexShrink: 0 }}>
              <FillPatternDefs color={radioColors.border} />
              <rect x="0" y="0" width={cellW2} height={cellH} fill={radioFillValue} stroke="none" />
              <line x1="0" y1="1" x2={cellW2} y2="1" stroke={radioColors.border} strokeWidth="2" />
              <line x1="0" y1={cellH - 1} x2={cellW2} y2={cellH - 1} stroke={radioColors.border} strokeWidth="2" />
              <line x1={cellW2 - 1} y1="0" x2={cellW2 - 1} y2={cellH} stroke={radioColors.border} strokeWidth="2" />
              <text x="6" y="18" fill={COLORS.WHITE} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">M/S</text>
              <rect x="44" y="6" width="15" height="15" fill={COLORS.GREEN} stroke={COLORS.GREEN} strokeWidth="1" />
              <text x="51" y="18" textAnchor="middle" fill={COLORS.BLACK} fontSize="15" fontFamily="RDVSimulated, monospace" fontWeight="100">M</text>
            </svg>

            {/* Cell 4: TX Section - all radio panel text is white */}
            <svg width={cellW3} height={cellH} viewBox={`0 0 ${cellW3} ${cellH}`} style={{ display: 'block', flexShrink: 0, cursor: 'pointer' }}
              onClick={() => freq && sendMsg({ type: 'tx', cmd1: '' + freq, dbl1: !isTx })}>
              <FillPatternDefs color={radioColors.border} />
              <rect x="0" y="0" width={cellW3} height={cellH} fill={radioFillValue} stroke="none" />
              <line x1="0" y1="1" x2={cellW3} y2="1" stroke={radioColors.border} strokeWidth="2" />
              <line x1="0" y1={cellH - 1} x2={cellW3} y2={cellH - 1} stroke={radioColors.border} strokeWidth="2" />
              <line x1={cellW3 - 1} y1="0" x2={cellW3 - 1} y2={cellH} stroke={radioColors.border} strokeWidth="2" />
              <text x="6" y="18" fill={COLORS.WHITE} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">TX</text>
              <rect x="30" y="6" width="30" height="15" fill={isTx ? COLORS.GREEN : 'none'} stroke={COLORS.GREEN} strokeWidth="1" />
              {/* TX radial PTT indicator - matches partial radio styling */}
              <circle cx="45" cy="34" r="6" fill={isTx ? COLORS.RED : COLORS.BLACK} stroke={COLORS.RED} strokeWidth="2" />
            </svg>

            {/* Cell 5: Secondary M/S Section - all radio panel text is white */}
            {/* Last cell: top, bottom, right outer borders */}
            <svg width={cellW4} height={cellH} viewBox={`0 0 ${cellW4} ${cellH}`} style={{ display: 'block', flexShrink: 0 }}>
              <FillPatternDefs color={radioColors.border} />
              <rect x="0" y="0" width={cellW4} height={cellH} fill={radioFillValue} stroke="none" />
              <line x1="0" y1="1" x2={cellW4} y2="1" stroke={radioColors.border} strokeWidth="2" />
              <line x1="0" y1={cellH - 1} x2={cellW4} y2={cellH - 1} stroke={radioColors.border} strokeWidth="2" />
              <line x1={cellW4 - 1} y1="0" x2={cellW4 - 1} y2={cellH} stroke={radioColors.border} strokeWidth="2" />
              <text x="6" y="18" fill={COLORS.WHITE} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">M/S</text>
              <rect x="44" y="6" width="15" height="15" fill={COLORS.GREEN} stroke={COLORS.GREEN} strokeWidth="1" />
              <text x="51" y="18" textAnchor="middle" fill={COLORS.BLACK} fontSize="15" fontFamily="RDVSimulated, monospace" fontWeight="100">M</text>
            </svg>
          </div>
        );
      }

      case 'PARTIAL': {
        const radioId = config.radioId || '';
        // PARTIAL radios: up to 3 fit across one quadrant row
        // Column in config is 1, 2, or 3 (position within the row of partials)
        // Calculate width as 1/3 of quadrant width minus gaps
        const quadrantWidth = 5 * CELL_WIDTH + 4 * GAP; // 5 cells with 4 gaps = 384px
        const partialGap = GAP; // Same gap as main grid
        const partialWidth = Math.floor((quadrantWidth - 2 * partialGap) / 3); // 3 panels with 2 gaps
        // Check if this partial radio is currently selected
        const isSelected = selectedPartialRadioId === radioId;
        // Toggle selection: clicking same radio deselects, clicking different selects
        const handleClick = () => {
          setSelectedPartialRadioId(isSelected ? null : radioId);
        };
        return renderPartialRadio(radioId, partialWidth, h, isSelected, handleClick);
      }

      case 'FUNC': {
        const funcType = config.funcType || 'HOLD';
        const funcColors = getFunctionButtonColors();
        const funcFillValue = getFillValue(funcColors.fillDesign, funcColors.background, funcColors.border);

        // Use same renderFunctionButton logic
        // HS_LS is the Radio Overflow indicator - no background or border
        if (funcType === 'HS_LS') {
          const circleX = w - 12;
          return (
            <svg key={key} width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ cursor: 'pointer' }}>
              {/* No background fill or border for HS_LS (Radio Overflow indicator) */}
              <rect x="4" y="4" width="30" height="18" fill="none" stroke={COLORS.GREEN} strokeWidth="1" />
              <text x="19" y="17" textAnchor="middle" fill={funcColors.text} fontSize="11" fontFamily="RDVSimulated, monospace" fontWeight="100">HS</text>
              <circle cx={circleX} cy="13" r="6" fill={COLORS.BLACK} stroke={COLORS.RED} strokeWidth="2" />
              <rect x="4" y={h - 22} width="30" height="18" fill="none" stroke={COLORS.GREEN} strokeWidth="1" />
              <text x="19" y={h - 9} textAnchor="middle" fill={funcColors.text} fontSize="11" fontFamily="RDVSimulated, monospace" fontWeight="100">LS</text>
              <circle cx={circleX} cy={h - 13} r="6" fill={COLORS.BLACK} stroke={COLORS.RED} strokeWidth="2" />
            </svg>
          );
        }

        const indicatorSize = 16;
        const indicatorMargin = 3;
        const indicatorY = h - indicatorSize - indicatorMargin;
        const textY = 22;

        return (
          <svg key={key} width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ cursor: 'pointer' }} onClick={() => handleFunctionKey(funcType)}>
            <FillPatternDefs color={funcColors.border} />
            <rect x="0" y="0" width={w} height={h} fill={funcFillValue} stroke={funcColors.border} strokeWidth="4" />
            <text x={w / 2} y={textY} textAnchor="middle" fill={funcColors.text} fontSize={16} fontFamily="RDVSimulated, monospace" fontWeight="100">
              {funcType}
            </text>
            <rect x={(w - indicatorSize) / 2} y={indicatorY} width={indicatorSize} height={indicatorSize} fill={COLORS.BLACK} stroke={funcColors.text} strokeWidth="1" />
          </svg>
        );
      }

      case 'NULL':
      default:
        return (
          <svg key={key} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            <rect x="0" y="0" width={w} height={h} fill={COLORS.BLACK} stroke={COLORS.BLACK} strokeWidth="1" />
          </svg>
        );
    }
  };

  // Render TED config validation errors in Activity Display area
  const renderConfigErrors = (errors: TEDValidationError[]) => {
    const w = 3 * CELL_WIDTH + 2 * GAP; // Activity display width (3 cols)
    const h = CELL_HEIGHT;

    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <rect x="0" y="0" width={w} height={h} fill={COLORS.BLACK} stroke={COLORS.RED} strokeWidth="4" />
        <text
          x={w / 2}
          y="14"
          textAnchor="middle"
          fill={COLORS.RED}
          fontSize="10"
          fontFamily="RDVSimulated, monospace"
          fontWeight="bold"
        >
          CONFIG ERROR
        </text>
        <text
          x={w / 2}
          y="28"
          textAnchor="middle"
          fill={COLORS.WHITE}
          fontSize="9"
          fontFamily="RDVSimulated, monospace"
          fontWeight="100"
        >
          {errors[0]?.message.substring(0, 30) || 'Unknown error'}
        </text>
        {errors.length > 1 && (
          <text
            x={w / 2}
            y="40"
            textAnchor="middle"
            fill={COLORS.GREY}
            fontSize="9"
            fontFamily="RDVSimulated, monospace"
            fontWeight="100"
          >
            +{errors.length - 1} more error{errors.length > 2 ? 's' : ''}
          </text>
        )}
      </svg>
    );
  };

  // Chamfered tab with angled cuts
  // Bottom sliver: cuts on TOP-left and TOP-right corners
  // Top sliver: cuts on BOTTOM-left and BOTTOM-right corners
  // Active page = grey border/text, inactive = white border/text, always black background
  const renderPageTab = (pageNum: number, isActive: boolean, position: 'top' | 'bottom') => {
    const w = 80;
    const h = 22; // 3px top + ~16px text + 3px bottom
    const chamfer = 12; // Aggressive corner cutoff
    const tabColor = isActive ? COLORS.GREY : COLORS.WHITE;

    // Polygon points differ based on sliver position:
    // - Bottom sliver: chamfers on TOP (cuts at top-left and top-right)
    // - Top sliver: chamfers on BOTTOM (cuts at bottom-left and bottom-right)
    const polygonPoints = position === 'bottom'
      ? `${chamfer},0 ${w - chamfer},0 ${w},${chamfer} ${w},${h} 0,${h} 0,${chamfer}`
      : `0,0 ${w},0 ${w},${h - chamfer} ${w - chamfer},${h} ${chamfer},${h} 0,${h - chamfer}`;

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
          points={polygonPoints}
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
          fontFamily="RDVSimulated, monospace"
          fontWeight="bold"
        >
          Page {pageNum}
        </text>
      </svg>
    );
  };

  // Arrow for pagination (continuous stem + arrowhead shape)
  const renderHexArrow = (direction: 'prev' | 'next') => {
    const w = 65;
    const h = 32;
    const isPrev = direction === 'prev';
    const midY = h / 2;
    const stemHalfHeight = 9; // stem thickness (half)
    const headSize = 14; // arrowhead size

    // Create a continuous arrow shape (no line between stem and head)
    // Points trace the outline: tip -> top of head -> top of stem -> bottom of stem -> bottom of head -> back to tip
    const prevPoints = `
      0,${midY}
      ${headSize},${midY - headSize}
      ${headSize},${midY - stemHalfHeight}
      ${w},${midY - stemHalfHeight}
      ${w},${midY + stemHalfHeight}
      ${headSize},${midY + stemHalfHeight}
      ${headSize},${midY + headSize}
    `;
    const nextPoints = `
      ${w},${midY}
      ${w - headSize},${midY - headSize}
      ${w - headSize},${midY - stemHalfHeight}
      0,${midY - stemHalfHeight}
      0,${midY + stemHalfHeight}
      ${w - headSize},${midY + stemHalfHeight}
      ${w - headSize},${midY + headSize}
    `;

    return (
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ cursor: 'pointer' }}
        onClick={() => setPage(currentPage + (isPrev ? -1 : 1))}
      >
        <polygon
          points={isPrev ? prevPoints : nextPoints}
          fill="none"
          stroke={COLORS.WHITE}
          strokeWidth="1"
        />
        <text
          x={w / 2}
          y={h / 2 + 4}
          textAnchor="middle"
          fill={COLORS.WHITE}
          fontSize="13"
          fontFamily="RDVSimulated, monospace"
          fontWeight="bold"
        >
          {isPrev ? 'Prev' : 'Next'}
        </text>
      </svg>
    );
  };

  // ============================================================
  // HEADER MODULE RENDERERS (Grid-based, spans multiple columns)
  // ============================================================

  // Activity Display: 3-column module with white outline
  // Two lines, 16 characters each (like an LCD display)
  // Line 1 = top line (default), Line 2 = bottom line
  const renderActivityDisplay = (width: number, height: number) => {
    // Parse and validate TED pattern if present
    const tedPattern = currentPosition?.tedPattern as TEDPatternConfig | undefined;
    let configErrors: TEDValidationError[] = [];

    if (tedPattern) {
      configErrors = validateTEDPattern(tedPattern, currentPosition || {});
    }

    // Determine what to display
    let displayLine1 = activityLine1;
    let displayLine2 = activityLine2;
    let isError = false;

    // Priority: Keypad dial buffer > Errors > Ready message > Normal activity
    if (keypadActive) {
      // When keypad is active, show dial buffer on line 1
      displayLine1 = dialBuffer || '_';
      displayLine2 = '';
    } else if (configErrors.length > 0 && !showReadyMessage) {
      isError = true;
      displayLine1 = 'CONFIG ERROR';
      // Truncate error message to 16 chars
      const errorMsg = configErrors[0]?.message || 'Unknown error';
      displayLine2 = errorMsg.substring(0, 16);
    }

    // Pad lines to exactly 16 characters (LCD-style display)
    displayLine1 = displayLine1.padEnd(16, ' ').substring(0, 16);
    displayLine2 = displayLine2.padEnd(16, ' ').substring(0, 16);

    // LCD-style layout: large text that fills the display
    const textPadding = 8;
    const fontSize = 22; // Large LCD-style font
    const line1Y = 22; // Top line Y position
    const line2Y = height - 6; // Bottom line Y position

    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Background */}
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill={COLORS.BLACK}
          stroke={isError ? COLORS.RED : COLORS.WHITE}
          strokeWidth="2"
        />
        {/* Line 1 (top) */}
        <text
          x={textPadding}
          y={line1Y}
          fill={COLORS.WHITE}
          fontSize={fontSize}
          fontFamily="RDVSimulated, monospace"
          fontWeight="100"
        >
          {displayLine1}
        </text>
        {/* Line 2 (bottom) */}
        <text
          x={textPadding}
          y={line2Y}
          fill={COLORS.WHITE}
          fontSize={fontSize}
          fontFamily="RDVSimulated, monospace"
          fontWeight="100"
        >
          {displayLine2}
        </text>
      </svg>
    );
  };

  // IA/OVR/CA Status Indicators: 2-column module, no outline
  // IA button is clickable - activates keypad in IA mode with "IA" in activity display
  const renderStatusIndicators = (width: number, height: number) => {
    // IA and CA boxes match Keypad size, OVR box is half that width
    const iaBoxWidth = 28; // Match Keypad rect width style
    const ovrBoxWidth = 10;
    const boxHeight = 26; // Match Keypad rect height
    const textY = 14; // Aligned with Keypad text
    const boxY = height - boxHeight - 4; // Aligned with Keypad rect position

    // Module spans 2 cells with a gap between them
    // IA centered in left cell, CA centered in right cell, OVR centered in module
    const cellWidth = (width - GAP) / 2; // Width of each cell

    // IA: centered in left cell
    const iaCenterX = cellWidth / 2;
    const iaX = iaCenterX - iaBoxWidth / 2;

    // OVR: centered in entire module
    const ovrCenterX = width / 2;
    const ovrX = ovrCenterX - ovrBoxWidth / 2;

    // CA: centered in right cell
    const caCenterX = cellWidth + GAP + cellWidth / 2;
    const caX = caCenterX - iaBoxWidth / 2;

    // Handle IA button click - toggles keypad in IA mode
    const handleIAClick = () => {
      if (keypadActive && iaMode) {
        // Already in IA mode, toggle off
        setKeypadActive(false);
        setIaMode(false);
        setDialBuffer('');
      } else {
        // Activate IA mode
        setIaMode(true);
        setKeypadActive(true);
        setDialBuffer('IA');
      }
    };

    // IA is active when keypad is active and in IA mode
    const iaActive = keypadActive && iaMode;

    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* IA - clickable to activate IA keypad mode */}
        <g style={{ cursor: 'pointer' }} onClick={handleIAClick}>
          {/* Invisible clickable area covering the entire IA region */}
          <rect x={iaX - 4} y={0} width={iaBoxWidth + 8} height={height} fill="transparent" />
          <text x={iaCenterX} y={textY} textAnchor="middle" fill={COLORS.WHITE} fontSize="13" fontFamily="RDVSimulated, monospace" fontWeight="bold">IA</text>
          <rect x={iaX} y={boxY} width={iaBoxWidth} height={boxHeight} fill={iaActive ? COLORS.WHITE : 'none'} stroke={COLORS.WHITE} strokeWidth="1" />
        </g>
        {/* OVR - steady green when active/ok, winking when hold, off otherwise */}
        <text x={ovrCenterX} y={textY} textAnchor="middle" fill={COLORS.WHITE} fontSize="13" fontFamily="RDVSimulated, monospace" fontWeight="bold">OVR</text>
        {overrideCallStatus === 'hold' ? (
          React.createElement('rect', { x: ovrX, y: boxY, width: ovrBoxWidth, height: boxHeight, fill: COLORS.GREEN, stroke: COLORS.GREEN, strokeWidth: '1' },
            React.createElement('animate', { attributeName: 'fill', values: `${COLORS.GREEN};${COLORS.GREEN};${COLORS.BLACK}`, keyTimes: '0;0.95;1', dur: '1s', repeatCount: 'indefinite' })
          )
        ) : (
          <rect x={ovrX} y={boxY} width={ovrBoxWidth} height={boxHeight} fill={isBeingOverridden ? COLORS.GREEN : 'none'} stroke={COLORS.GREEN} strokeWidth="1" />
        )}
        {/* CA */}
        <text x={caCenterX} y={textY} textAnchor="middle" fill={COLORS.WHITE} fontSize="13" fontFamily="RDVSimulated, monospace" fontWeight="bold">CA</text>
        <rect x={caX} y={boxY} width={iaBoxWidth} height={boxHeight} fill="none" stroke={COLORS.WHITE} strokeWidth="1" />
      </svg>
    );
  };

  // PAD (Keypad): 1-column module with title and centered 40px wide rect
  // Clicking toggles the keypad overlay in the quadrant below Activity Display
  // When activated via this button (not IA), it's in normal DTMF mode
  const renderPadModule = (width: number, height: number) => {
    const rectWidth = 40;
    const rectHeight = Math.min(26, height - 20);
    const rectX = (width - rectWidth) / 2; // Center the rect
    const rectY = height - rectHeight - 4;

    const handleKeypadToggle = () => {
      if (keypadActive) {
        // Closing keypad
        setKeypadActive(false);
        setIaMode(false);
      } else {
        // Opening keypad in normal DTMF mode (not IA)
        setKeypadActive(true);
        setIaMode(false);
        setDialBuffer('');
      }
    };

    // When active: white text and white outlined rect (no fill)
    // When inactive: grey text and grey outlined rect
    // Note: keypadActive includes both normal and IA mode
    const activeColor = COLORS.WHITE;
    const inactiveColor = COLORS.GREY;

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ cursor: 'pointer' }}
        onClick={handleKeypadToggle}
      >
        <text x={width / 2} y="14" textAnchor="middle" fill={keypadActive ? activeColor : inactiveColor} fontSize="13" fontFamily="RDVSimulated, monospace" fontWeight="bold">Keypad</text>
        <rect x={rectX} y={rectY} width={rectWidth} height={rectHeight} fill="none" stroke={keypadActive ? activeColor : inactiveColor} strokeWidth="1" />
      </svg>
    );
  };

  // Phone keypad layout - standard phone dialpad configuration (excluding Q and Z per user request)
  const KEYPAD_LAYOUT: { digit: string; letters: string }[][] = [
    [{ digit: '1', letters: '' }, { digit: '2', letters: 'ABC' }, { digit: '3', letters: 'DEF' }],
    [{ digit: '4', letters: 'GHI' }, { digit: '5', letters: 'JKL' }, { digit: '6', letters: 'MNO' }],
    [{ digit: '7', letters: 'PRS' }, { digit: '8', letters: 'TUV' }, { digit: '9', letters: 'WXY' }],
    [{ digit: '*', letters: '' }, { digit: '0', letters: '' }, { digit: '#', letters: '' }],
  ];

  // DTMF tone frequencies (Hz) - standard dual-tone frequencies
  const DTMF_FREQUENCIES: Record<string, [number, number]> = {
    '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
    '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
    '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
    '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
  };

  // Play DTMF tone using Web Audio API
  const playDTMFTone = (digit: string) => {
    if (typeof window === 'undefined') return;
    const freqs = DTMF_FREQUENCIES[digit];
    if (!freqs) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const [lowFreq, highFreq] = freqs;
      const duration = 0.15; // 150ms tone

      // Create oscillators for dual-tone
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      osc1.frequency.value = lowFreq;
      osc2.frequency.value = highFreq;
      osc1.type = 'sine';
      osc2.type = 'sine';

      gainNode.gain.value = 0.2; // Moderate volume

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioContext.destination);

      osc1.start();
      osc2.start();
      osc1.stop(audioContext.currentTime + duration);
      osc2.stop(audioContext.currentTime + duration);

      // Cleanup
      setTimeout(() => audioContext.close(), duration * 1000 + 100);
    } catch (e) {
      console.warn('Failed to play DTMF tone:', e);
    }
  };

  // Handle keypad submit (# key)
  const handleKeypadSubmit = () => {
    if (iaMode) {
      // IA call: strip 'IA' prefix and send the code
      const iaCode = dialBuffer.replace('IA', '').replace('FWD', '');
      if (iaCode) sendMsg({ type: 'ia_call', cmd1: iaCode, dbl1: 0 });
    } else {
      // Dial call: send via sendDialCall with the active trunk
      const activeDialLineState = useCoreStore.getState().activeDialLine;
      if (activeDialLineState && dialBuffer) {
        sendDialCall(activeDialLineState.trunkName, dialBuffer);
      }
    }
    setKeypadActive(false);
    setDialBuffer('');
    setIaMode(false);
  };

  // Handle keypad digit press
  const handleKeypadPress = (digit: string) => {
    // # submits the dial buffer
    if (digit === '#') {
      handleKeypadSubmit();
      return;
    }
    // * clears the dial buffer
    if (digit === '*') {
      setDialBuffer(iaMode ? 'IA' : '');
      return;
    }

    // Play DTMF tone
    playDTMFTone(digit);

    // Max 16 characters (fits in activity display)
    if (dialBuffer.length < 16) {
      setDialBuffer(dialBuffer + digit);
    }
  };

  // Render a single keypad button (function button style with larger indicator box)
  // L/NL box always has lime green outline, numbers are not bold and one point larger (15pt)
  // Letters are 17pt font size
  const renderKeypadButton = (digit: string, letters: string, width: number, height: number) => {
    const funcColors = getFunctionButtonColors();
    const funcFillValue = getFillValue(funcColors.fillDesign, funcColors.background, funcColors.border);

    // Larger indicator box for dial digit buttons
    const indicatorWidth = 24;
    const indicatorHeight = 20;
    const indicatorX = (width - indicatorWidth) / 2;
    const indicatorY = height - indicatorHeight - 6;

    // Digit displayed in the indicator box
    const digitY = indicatorY + indicatorHeight / 2 + 5;

    // Letters displayed above the indicator box
    const lettersY = indicatorY - 4;

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ cursor: 'pointer' }}
        onClick={() => handleKeypadPress(digit)}
      >
        <FillPatternDefs color={funcColors.border} />
        {/* Button border - no outer border since keypad has its own border */}
        <rect x="2" y="2" width={width - 4} height={height - 4} fill={funcFillValue} stroke={funcColors.border} strokeWidth="2" />

        {/* Letters label above indicator - 17pt font */}
        {letters && (
          <text
            x={width / 2}
            y={lettersY}
            textAnchor="middle"
            fill={funcColors.text}
            fontSize="17"
            fontFamily="RDVSimulated, monospace"
            fontWeight="100"
          >
            {letters}
          </text>
        )}

        {/* Digit indicator box (L/NL box) - always lime green outline */}
        <rect
          x={indicatorX}
          y={indicatorY}
          width={indicatorWidth}
          height={indicatorHeight}
          fill={COLORS.BLACK}
          stroke={COLORS.GREEN}
          strokeWidth="1"
        />

        {/* Digit inside indicator box - not bold, 15pt font */}
        <text
          x={width / 2}
          y={digitY}
          textAnchor="middle"
          fill={funcColors.text}
          fontSize="15"
          fontFamily="RDVSimulated, monospace"
          fontWeight="normal"
        >
          {digit}
        </text>
      </svg>
    );
  };

  // Render the keypad quadrant overlay (replaces 3x4 grid below Activity Display)
  // In left-handed mode: Q1 (columns 1-3, rows 2-5 in CSS grid terms)
  // In right-handed mode: Q2 (columns 8-10, rows 2-5 in CSS grid terms)
  // The entire keypad has a 2px white border around the outside
  const renderKeypadQuadrant = () => {
    // Keypad spans 3 columns x 4 rows
    // Total available space: 3 cells + 2 gaps width, 4 cells + 3 gaps height
    const totalWidth = 3 * CELL_WIDTH + 2 * GAP;
    const totalHeight = 4 * CELL_HEIGHT + 3 * GAP;

    // Border (2px each side) takes 4px total from each dimension
    const borderSize = 2;
    const innerWidth = totalWidth - 2 * borderSize;
    const innerHeight = totalHeight - 2 * borderSize;

    // Calculate button sizes to fit within the inner area with gaps
    // 3 buttons + 2 gaps = innerWidth, so buttonWidth = (innerWidth - 2*GAP) / 3
    const buttonWidth = Math.floor((innerWidth - 2 * GAP) / 3);
    const buttonHeight = Math.floor((innerHeight - 3 * GAP) / 4);

    return (
      <div
        style={{
          border: `${borderSize}px solid ${COLORS.WHITE}`,
          boxSizing: 'border-box',
          backgroundColor: COLORS.BLACK,
          width: totalWidth,
          height: totalHeight,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(3, ${buttonWidth}px)`,
            gridTemplateRows: `repeat(4, ${buttonHeight}px)`,
            gap: `${GAP}px`,
            width: innerWidth,
            height: innerHeight,
          }}
        >
          {KEYPAD_LAYOUT.flat().map((key, idx) => (
            <div key={`keypad-${key.digit}`}>
              {renderKeypadButton(key.digit, key.letters, buttonWidth, buttonHeight)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Page Control: 2-column module with arrows and page indicators
  const renderPageControl = (width: number, height: number) => {
    const arrowW = Math.floor((width - 8) / 2);
    const arrowH = Math.min(28, height - 24);

    return (
      <div style={{ width, height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0px' }}>
        <svg width={width} height="14" viewBox={`0 0 ${width} 14`}>
          <text x={width / 2} y="12" textAnchor="middle" fill={COLORS.WHITE} fontSize="20" fontFamily="RDVSimulated, monospace" fontWeight="bold">Page {currentPage}</text>
        </svg>
        <div style={{ display: 'flex', gap: '4px' }}>
          {renderHexArrow('prev')}
          {renderHexArrow('next')}
        </div>
        <svg width={width} height="14" viewBox={`0 0 ${width} 14`}>
          <text x={width / 2} y="12" textAnchor="middle" fill={COLORS.WHITE} fontSize="20" fontFamily="RDVSimulated, monospace" fontWeight="bold">of {maxPage}</text>
        </svg>
      </div>
    );
  };

  // DIM Knob: 1-column module
  const renderDimKnob = (width: number, height: number) => {
    const knobRadius = Math.min(12, (height - 20) / 2);
    const knobY = height / 2 + 6;

    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <text x={width / 2} y="14" textAnchor="middle" fill={COLORS.WHITE} fontSize="13" fontFamily="RDVSimulated, monospace" fontWeight="bold">Dim</text>
        <circle cx={width / 2} cy={knobY} r={knobRadius} fill={COLORS.BLACK} stroke={COLORS.WHITE} strokeWidth="2" />
      </svg>
    );
  };

  // BRIGHT Knob: 1-column module
  const renderBrightKnob = (width: number, height: number) => {
    const knobRadius = Math.min(12, (height - 20) / 2);
    const knobY = height / 2 + 6;

    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <text x={width / 2} y="14" textAnchor="middle" fill={COLORS.WHITE} fontSize="13" fontFamily="RDVSimulated, monospace" fontWeight="bold">Bright</text>
        <circle cx={width / 2} cy={knobY} r={knobRadius} fill={COLORS.BLACK} stroke={COLORS.WHITE} strokeWidth="2" />
      </svg>
    );
  };

  // Brightness percentage overlay (positioned between DIM and BRIGHT)
  const renderBrightnessValue = (height: number) => {
    return (
      <svg width="40" height={height} viewBox={`0 0 40 ${height}`} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        <text x="20" y={height - 6} textAnchor="middle" fill={COLORS.WHITE} fontSize="13" fontFamily="RDVSimulated, monospace" fontWeight="bold">47%</text>
      </svg>
    );
  };

  // Header row renderer - uses grid positioning
  const renderHeaderRow = () => {
    // Left-hand mode (default): Activity Display | IA/OVR/CA | PAD | Page Control | DIM | BRIGHT
    // Each module spans specific columns in row 0
    const moduleConfigs = handedness === 'left'
      ? [
          { key: 'activity', cols: 3, render: renderActivityDisplay },
          { key: 'status', cols: 2, render: renderStatusIndicators },
          { key: 'pad', cols: 1, render: renderPadModule },
          { key: 'page', cols: 2, render: renderPageControl },
          { key: 'dim', cols: 1, render: renderDimKnob },
          { key: 'bright', cols: 1, render: renderBrightKnob },
        ]
      : [
          { key: 'bright', cols: 1, render: renderBrightKnob },
          { key: 'dim', cols: 1, render: renderDimKnob },
          { key: 'page', cols: 2, render: renderPageControl },
          { key: 'pad', cols: 1, render: renderPadModule },
          { key: 'status', cols: 2, render: renderStatusIndicators },
          { key: 'activity', cols: 3, render: renderActivityDisplay },
        ];

    let colStart = 1; // CSS grid is 1-indexed
    const elements: React.ReactNode[] = [];

    moduleConfigs.forEach((config, idx) => {
      const moduleWidth = config.cols * CELL_WIDTH + (config.cols - 1) * GAP;
      const moduleHeight = CELL_HEIGHT;

      // Special handling for brightness value between DIM and BRIGHT
      const isDimOrBright = config.key === 'dim' || config.key === 'bright';

      elements.push(
        <div
          key={`header-${config.key}`}
          style={{
            gridColumn: `${colStart} / span ${config.cols}`,
            gridRow: '1',
            position: isDimOrBright ? 'relative' : undefined,
          }}
        >
          {config.render(moduleWidth, moduleHeight)}
        </div>
      );

      // Add brightness value overlay after DIM (for left-hand) or after BRIGHT (for right-hand)
      if ((handedness === 'left' && config.key === 'dim') || (handedness === 'right' && config.key === 'bright')) {
        elements.push(
          <div
            key="brightness-value"
            style={{
              gridColumn: `${colStart} / span 2`,
              gridRow: '1',
              position: 'relative',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {renderBrightnessValue(moduleHeight)}
          </div>
        );
      }

      colStart += config.cols;
    });

    return elements;
  };

  // Render communication matrix cells (rows 1-8, all 10 columns)
  const renderCommunicationMatrix = () => {
    const elements: React.ReactNode[] = [];

    // If keypad is active, render it as an overlay in the appropriate quadrant
    // Left-handed: columns 1-3 (CSS grid), rows 2-5 (below Activity Display)
    // Right-handed: columns 8-10 (CSS grid), rows 2-5 (below Activity Display)
    if (keypadActive) {
      const keypadStartCol = handedness === 'left' ? 1 : 8;
      elements.push(
        <div
          key="keypad-overlay"
          style={{
            gridColumn: `${keypadStartCol} / span 3`,
            gridRow: '2 / span 4',
            zIndex: 10,
          }}
        >
          {renderKeypadQuadrant()}
        </div>
      );
    }

    // Determine which cells are covered/blacked out when keypad is active
    // Keypad covers: 3x4 grid below Activity Display (Q1 cols 0-2 left-handed, Q2 cols 7-9 right-handed)
    // Left-handed: All of Q1 is blacked out (cols 0-4), and row 1 of Q3 (grid row 4, cols 0-4) is blacked out
    // Right-handed: All of Q2 is blacked out (cols 5-9), and row 1 of Q4 (grid row 4, cols 5-9) is blacked out
    const keypadCoveredCells = new Set<string>();
    const keypadBlackoutCells = new Set<string>(); // Cells to render as black (not skip)
    if (keypadActive) {
      // Keypad itself covers 3 columns x 4 rows
      const keypadStartGridCol = handedness === 'left' ? 0 : 7; // 0-indexed grid column
      for (let row = 0; row < 4; row++) {
        for (let col = keypadStartGridCol; col < keypadStartGridCol + 3; col++) {
          keypadCoveredCells.add(`${row}-${col}`);
        }
      }

      if (handedness === 'left') {
        // Left-handed mode: Black out all of Q1 (rows 0-3, cols 0-4)
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 5; col++) {
            if (!keypadCoveredCells.has(`${row}-${col}`)) {
              keypadBlackoutCells.add(`${row}-${col}`);
            }
          }
        }
        // Black out row 1 of Q3 (grid row 4, cols 0-4)
        for (let col = 0; col < 5; col++) {
          keypadBlackoutCells.add(`4-${col}`);
        }
      } else {
        // Right-handed mode: Black out all of Q2 (rows 0-3, cols 5-9)
        for (let row = 0; row < 4; row++) {
          for (let col = 5; col < 10; col++) {
            if (!keypadCoveredCells.has(`${row}-${col}`)) {
              keypadBlackoutCells.add(`${row}-${col}`);
            }
          }
        }
        // Black out row 1 of Q4 (grid row 4, cols 5-9)
        for (let col = 5; col < 10; col++) {
          keypadBlackoutCells.add(`4-${col}`);
        }
      }
    }

    // If TED pattern config is valid, use it for rendering
    if (hasTEDConfig && parsedTEDLayout) {
      // Get current page from parsed layout
      const currentPageData = getPageByNumber(parsedTEDLayout, currentPage);

      if (currentPageData) {
        // Track which grid positions are occupied (to avoid rendering empty cells in occupied spots)
        const occupiedCells = new Set<string>();

        // Group PARTIAL cells by their row for combined rendering
        const partialsByRow = new Map<number, ParsedCell[]>();

        // Render each cell from the TED pattern config
        currentPageData.cells.forEach((cell, idx) => {
          const { gridRow, gridCol, colSpan, config } = cell;

          // Skip cells that are covered by the keypad overlay
          if (keypadCoveredCells.has(`${gridRow}-${gridCol}`)) {
            return;
          }

          // Render blackout cells as black (Q1 and Q3 row 1 when keypad active)
          if (keypadBlackoutCells.has(`${gridRow}-${gridCol}`)) {
            const cssGridRow = gridRow + 2;
            const cssGridCol = gridCol + 1;
            elements.push(
              <div
                key={`blackout-${gridRow}-${gridCol}`}
                style={{
                  gridColumn: colSpan > 1 ? `${cssGridCol} / span ${colSpan}` : `${cssGridCol}`,
                  gridRow: `${cssGridRow}`,
                }}
              >
                <svg width={colSpan * CELL_WIDTH + (colSpan - 1) * GAP} height={CELL_HEIGHT} viewBox={`0 0 ${colSpan * CELL_WIDTH + (colSpan - 1) * GAP} ${CELL_HEIGHT}`}>
                  <rect x="0" y="0" width={colSpan * CELL_WIDTH + (colSpan - 1) * GAP} height={CELL_HEIGHT} fill={COLORS.BLACK} stroke={COLORS.BLACK} strokeWidth="1" />
                </svg>
              </div>
            );
            // Mark as occupied so we don't render empty cells here
            for (let c = gridCol; c < gridCol + colSpan; c++) {
              occupiedCells.add(`${gridRow}-${c}`);
            }
            return;
          }

          // Handle PARTIAL cells specially - group them by row for combined rendering
          if (config.type === 'PARTIAL') {
            // Mark all 5 columns of the quadrant row as occupied
            const quadrantStartCol = gridCol < 5 ? 0 : 5;
            for (let c = quadrantStartCol; c < quadrantStartCol + 5; c++) {
              occupiedCells.add(`${gridRow}-${c}`);
            }

            // Group partial by row
            if (!partialsByRow.has(gridRow)) {
              partialsByRow.set(gridRow, []);
            }
            partialsByRow.get(gridRow)!.push(cell);
            return; // Don't render individually, will render grouped
          }

          // Mark all columns this cell occupies
          for (let c = gridCol; c < gridCol + colSpan; c++) {
            occupiedCells.add(`${gridRow}-${c}`);
          }

          // CSS grid is 1-indexed, and row 0 in matrix is row 2 in grid (header is row 1)
          const cssGridRow = gridRow + 2;
          const cssGridCol = gridCol + 1;

          elements.push(
            <div
              key={`ted-cell-${gridRow}-${gridCol}`}
              style={{
                gridColumn: colSpan > 1 ? `${cssGridCol} / span ${colSpan}` : `${cssGridCol}`,
                gridRow: `${cssGridRow}`,
              }}
            >
              {renderTEDCell(cell, `ted-${gridRow}-${gridCol}`)}
            </div>
          );
        });

        // Render grouped PARTIAL cells in flex containers spanning full quadrant width
        partialsByRow.forEach((partialCells, gridRow) => {
          // Determine quadrant start column (0 for Q1/Q3, 5 for Q2/Q4)
          const firstCell = partialCells[0];
          if (!firstCell) return; // Skip if no cells in this row
          const quadrantStartCol = firstCell.gridCol < 5 ? 0 : 5;

          const cssGridRow = gridRow + 2;
          const cssGridCol = quadrantStartCol + 1;

          // Calculate dimensions
          // 3 partials with 2 gaps must fit in quadrant width
          const quadrantWidth = 5 * CELL_WIDTH + 4 * GAP;
          const partialGap = GAP; // Same gap as main grid
          const partialWidth = Math.floor((quadrantWidth - 2 * partialGap) / 3);

          // Sort partials by their position (col in config, 1-3)
          const sortedPartials = [...partialCells].sort((a, b) => a.config.col - b.config.col);

          elements.push(
            <div
              key={`partial-row-${gridRow}`}
              style={{
                gridColumn: `${cssGridCol} / span 5`,
                gridRow: `${cssGridRow}`,
                display: 'flex',
                gap: `${partialGap}px`,
              }}
            >
              {sortedPartials.map((cell, idx) => (
                <div key={`partial-${gridRow}-${cell.config.col}`}>
                  {renderTEDCell(cell, `partial-${gridRow}-${cell.config.col}`)}
                </div>
              ))}
            </div>
          );
        });

        // Fill in empty cells that aren't occupied (and not covered by keypad)
        for (let gridRow = 0; gridRow < 8; gridRow++) {
          for (let col = 0; col < GRID_COLS; col++) {
            if (!occupiedCells.has(`${gridRow}-${col}`) && !keypadCoveredCells.has(`${gridRow}-${col}`)) {
              const cssGridRow = gridRow + 2;
              const cssGridCol = col + 1;
              elements.push(
                <div
                  key={`empty-${gridRow}-${col}`}
                  style={{
                    gridColumn: `${cssGridCol}`,
                    gridRow: `${cssGridRow}`,
                  }}
                >
                  <svg width={CELL_WIDTH} height={CELL_HEIGHT} viewBox={`0 0 ${CELL_WIDTH} ${CELL_HEIGHT}`}>
                    <rect x="0" y="0" width={CELL_WIDTH} height={CELL_HEIGHT} fill={COLORS.BLACK} stroke={COLORS.BLACK} strokeWidth="1" />
                  </svg>
                </div>
              );
            }
          }
        }

        return elements;
      }
    }

    // Fall back to legacy layout if no TED pattern config
    // For stacked layout (Q2 and Q4 both frequency): left half is station buttons, right half is line panels
    // For 2x2 layout: Q1/Q3 are station buttons (cols 0-4), Q2 is line panels (cols 5-9, rows 1-4), Q4 is station or mixed (cols 5-9, rows 5-8)
    const isStackedLayout = layoutConfig.quadrants[1] === 'F' && layoutConfig.quadrants[3] === 'F';

    // Rows 1-8 in the 10x10 grid (communication matrix)
    for (let gridRow = 2; gridRow <= 9; gridRow++) {
      const matrixRow = gridRow - 2; // 0-7 for the communication matrix

      for (let col = 0; col < GRID_COLS; col++) {
        // Skip cells covered by keypad overlay
        if (keypadCoveredCells.has(`${matrixRow}-${col}`)) {
          continue;
        }

        // Render blackout cells as black (Q1 and Q3 row 1 when keypad active)
        if (keypadBlackoutCells.has(`${matrixRow}-${col}`)) {
          elements.push(
            <div
              key={`blackout-${matrixRow}-${col}`}
              style={{
                gridColumn: `${col + 1}`,
                gridRow: `${gridRow}`,
              }}
            >
              <svg width={CELL_WIDTH} height={CELL_HEIGHT} viewBox={`0 0 ${CELL_WIDTH} ${CELL_HEIGHT}`}>
                <rect x="0" y="0" width={CELL_WIDTH} height={CELL_HEIGHT} fill={COLORS.BLACK} stroke={COLORS.BLACK} strokeWidth="1" />
              </svg>
            </div>
          );
          continue;
        }

        const isRightHalf = col >= 5;
        const isTopHalf = matrixRow < 4;

        // Determine if this cell should be a line panel or station button
        let isLinePanel = false;
        if (isStackedLayout) {
          // Stacked: right half (cols 5-9) are all line panels
          isLinePanel = isRightHalf;
        } else {
          // 2x2 layout: Q2 (top-right) is always line panels
          isLinePanel = isRightHalf && isTopHalf;
        }

        if (isLinePanel) {
          // Line panels span 5 columns (cols 5-9) for each row
          if (col === 5) {
            elements.push(
              <div
                key={`line-${matrixRow}`}
                style={{
                  gridColumn: '6 / span 5',
                  gridRow: `${gridRow}`,
                }}
              >
                {renderLineControlPanel(matrixRow)}
              </div>
            );
          }
          // Skip cols 6-9 since line panel spans them
          continue;
        } else {
          // Station button
          elements.push(
            <div
              key={`btn-${matrixRow}-${col}`}
              style={{
                gridColumn: `${col + 1}`,
                gridRow: `${gridRow}`,
              }}
            >
              {renderStationButton(matrixRow, col)}
            </div>
          );
        }
      }
    }

    return elements;
  };

  // Sliver position from config (could come from position JSON in future)
  const sliverPosition: SliverPosition = DEFAULT_SLIVER_POSITION;

  // ============================================================
  // FOOTER ROW RENDERER
  // ============================================================

  /**
   * Get the footer keyword for the current page
   * Falls back to 'NONE' if no TED pattern or page config
   */
  const getCurrentFooterKeyword = (): FooterKeyword => {
    if (!parsedTEDLayout) return 'NONE';
    const currentPageConfig = parsedTEDLayout.pages.find(p => p.pageNumber === currentPage);
    return currentPageConfig?.footer || 'NONE';
  };

  /**
   * Render a single footer cell based on its type
   */
  const renderFooterCell = (
    type: FooterSectionType,
    colIndex: number,
    width: number,
    height: number,
    key: string
  ): React.ReactNode => {
    switch (type) {
      case 'DA_OVERFLOW': {
        // Show DA buttons from other pages that have active indicators
        const cellW = CELL_WIDTH;
        const cellH = CELL_HEIGHT;
        const numCells = Math.max(1, Math.round(width / (CELL_WIDTH + GAP)));
        const cells = [];
        for (let i = 0; i < numCells; i++) {
          const overflowBtn = overflowButtons[i];
          if (overflowBtn) {
            // Render a mini DA button with indicator and label
            const daColors = getDAButtonColors(overflowBtn.lineType);
            const fillValue = getFillValue(daColors.fillDesign, daColors.background, daColors.border);
            const indicatorSize = 16;
            const indicatorY = cellH - indicatorSize - 3;
            cells.push(
              <svg
                key={`${key}-${i}`}
                width={cellW}
                height={cellH}
                viewBox={`0 0 ${cellW} ${cellH}`}
                style={{ display: 'block', flexShrink: 0, cursor: 'pointer' }}
                onClick={() => handleLineClick(overflowBtn)}
              >
                <FillPatternDefs color={daColors.border} />
                <rect x="0" y="0" width={cellW} height={cellH} fill={fillValue} stroke={daColors.border} strokeWidth="4" />
                <text x={cellW / 2} y="16" textAnchor="middle" fill={daColors.text} fontSize="13" fontFamily="RDVSimulated, monospace" fontWeight="bold">{overflowBtn.line1}</text>
                {overflowBtn.line2 && <text x={cellW / 2} y="30" textAnchor="middle" fill={daColors.text} fontSize="12" fontFamily="RDVSimulated, monospace" fontWeight="100">{overflowBtn.line2}</text>}
                {renderIndicator(overflowBtn.indicatorState, (cellW - indicatorSize) / 2, indicatorY, indicatorSize, overflowBtn.typeLetter)}
              </svg>
            );
          } else {
            // Empty placeholder cell
            cells.push(
              <svg
                key={`${key}-${i}`}
                width={cellW}
                height={cellH}
                viewBox={`0 0 ${cellW} ${cellH}`}
                style={{ display: 'block', flexShrink: 0 }}
              >
                <rect x={0} y={0} width={cellW} height={cellH} fill={COLORS.BLACK} />
              </svg>
            );
          }
        }
        return (
          <div key={key} style={{ display: 'flex', gap: `${GAP}px` }}>
            {cells}
          </div>
        );
      }

      case 'POPUP_RADIO': {
        // Full radio module component - dark gray styling until a PARTIAL radio is selected
        // When a PARTIAL is selected, shows the full radio panel with proper colors and data
        // POPUP_RADIO is always 5 cells wide (HS/LS, RX, M/S, TX, M/S)

        // Use the exact width passed from renderFooterRow to ensure alignment
        // Width = 5 * CELL_WIDTH + 4 * GAP, divide by 5 cells with remainder handling
        const baseCellW = Math.floor(width / 5);
        const remainder = width - (baseCellW * 5);
        // Distribute remainder across first 'remainder' cells (each gets 1 extra pixel)
        // Pre-compute widths for all 5 cells
        const cellW0 = baseCellW + (0 < remainder ? 1 : 0);
        const cellW1 = baseCellW + (1 < remainder ? 1 : 0);
        const cellW2 = baseCellW + (2 < remainder ? 1 : 0);
        const cellW3 = baseCellW + (3 < remainder ? 1 : 0);
        const cellW4 = baseCellW + (4 < remainder ? 1 : 0);
        const cellH = height;

        // Check if a partial radio is selected
        const selectedRadio = selectedPartialRadioId
          ? currentPosition?.radios?.find((r: any) => r.id === selectedPartialRadioId)
          : null;

        // Get radio data and status
        const freq = selectedRadio?.freq || 0;
        const isEmergency = freq > 0 && isEmergencyFrequency(freq);

        // Get colors based on selection state
        // When no radio selected: dark gray
        // When radio selected: use radio color pattern (emergency or normal)
        const radioColors = selectedRadio
          ? getRadioButtonColors(isEmergency)
          : null;
        const popupBorderColor = radioColors?.border || COLORS.DARK_GREY;
        const popupTextColor = radioColors?.text || COLORS.DARK_GREY;
        const popupFillValue = radioColors
          ? getFillValue(radioColors.fillDesign, radioColors.background, radioColors.border)
          : COLORS.BLACK;

        // Get radio status from ag_status by matching frequency
        const radioStatus = selectedPartialRadioId ? (getRadioAgStatus(selectedPartialRadioId) || {}) : {};
        const isRx = selectedRadio && !!radioStatus.r;
        const isTx = selectedRadio && !!radioStatus.t;
        const isHs = selectedRadio && !!radioStatus.h;
        const isLs = selectedRadio && !!radioStatus.l;

        // Format frequency
        const freqDisplay = freq > 0 ? (freq / 1_000_000).toFixed(2) : '';

        // Radio panels use 0 gap internally - cells are visually joined
        // 5 cells: HS/LS, RX, M/S, TX, M/S
        return (
          <div key={key} style={{ display: 'flex', gap: '0px' }}>
            {/* Cell 1: HS/LS Section */}
            <svg width={cellW0} height={cellH} viewBox={`0 0 ${cellW0} ${cellH}`} style={{ display: 'block', flexShrink: 0, cursor: selectedRadio ? 'pointer' : 'default' }}
              onClick={() => selectedRadio && freq && sendMsg({ type: 'set_hs', cmd1: '' + freq, dbl1: !isHs })}>
              <FillPatternDefs color={popupBorderColor} />
              <rect x="0" y="0" width={cellW0} height={cellH} fill={popupFillValue} stroke="none" />
              {/* Outer borders: left, top, bottom */}
              <line x1="1" y1="0" x2="1" y2={cellH} stroke={popupBorderColor} strokeWidth="2" />
              <line x1="0" y1="1" x2={cellW0} y2="1" stroke={popupBorderColor} strokeWidth="2" />
              <line x1="0" y1={cellH - 1} x2={cellW0} y2={cellH - 1} stroke={popupBorderColor} strokeWidth="2" />
              {/* Right divider */}
              <line x1={cellW0 - 1} y1="0" x2={cellW0 - 1} y2={cellH} stroke={popupBorderColor} strokeWidth="2" />
              <text x="6" y="20" fill={isHs ? COLORS.GREEN : (selectedRadio ? COLORS.WHITE : popupTextColor)} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">HS</text>
              <text x="6" y="40" fill={isLs ? COLORS.GREEN : (selectedRadio ? COLORS.WHITE : popupTextColor)} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">LS</text>
              {/* HS indicator box - top half */}
              <line x1="38" y1="8" x2="54" y2="8" stroke={selectedRadio ? COLORS.GREEN : popupBorderColor} strokeWidth="1" />
              <line x1="38" y1="8" x2="38" y2="27" stroke={selectedRadio ? COLORS.GREEN : popupBorderColor} strokeWidth="1" />
              <line x1="54" y1="8" x2="54" y2="27" stroke={selectedRadio ? COLORS.GREEN : popupBorderColor} strokeWidth="1" />
              <rect x="39" y="9" width="14" height="17" fill={isHs ? COLORS.GREEN : 'none'} stroke="none" />
              {/* LS indicator box - bottom half */}
              <line x1="38" y1="27" x2="38" y2="46" stroke={selectedRadio ? COLORS.GREEN : popupBorderColor} strokeWidth="1" />
              <line x1="54" y1="27" x2="54" y2="46" stroke={selectedRadio ? COLORS.GREEN : popupBorderColor} strokeWidth="1" />
              <line x1="38" y1="46" x2="54" y2="46" stroke={selectedRadio ? COLORS.GREEN : popupBorderColor} strokeWidth="1" />
              <rect x="39" y="28" width="14" height="17" fill={isLs ? COLORS.GREEN : 'none'} stroke="none" />
            </svg>

            {/* Cell 2: RX Section */}
            <svg width={cellW1} height={cellH} viewBox={`0 0 ${cellW1} ${cellH}`} style={{ display: 'block', flexShrink: 0, cursor: selectedRadio ? 'pointer' : 'default' }}
              onClick={() => selectedRadio && freq && sendMsg({ type: 'rx', cmd1: '' + freq, dbl1: !isRx })}>
              <FillPatternDefs color={popupBorderColor} />
              <rect x="0" y="0" width={cellW1} height={cellH} fill={popupFillValue} stroke="none" />
              <line x1="0" y1="1" x2={cellW1} y2="1" stroke={popupBorderColor} strokeWidth="2" />
              <line x1="0" y1={cellH - 1} x2={cellW1} y2={cellH - 1} stroke={popupBorderColor} strokeWidth="2" />
              <line x1={cellW1 - 1} y1="0" x2={cellW1 - 1} y2={cellH} stroke={popupBorderColor} strokeWidth="2" />
              <text x="6" y="18" fill={selectedRadio ? COLORS.WHITE : popupTextColor} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">RX</text>
              <rect x="30" y="6" width="30" height="15" fill={isRx ? COLORS.GREEN : 'none'} stroke={selectedRadio ? COLORS.GREEN : popupBorderColor} strokeWidth="1" />
              <text x="3" y="42" fill={selectedRadio ? COLORS.WHITE : popupTextColor} fontSize="18" fontFamily="RDVSimulated, monospace" fontWeight="100">{freqDisplay}</text>
            </svg>

            {/* Cell 3: M/S Section */}
            <svg width={cellW2} height={cellH} viewBox={`0 0 ${cellW2} ${cellH}`} style={{ display: 'block', flexShrink: 0 }}>
              <FillPatternDefs color={popupBorderColor} />
              <rect x="0" y="0" width={cellW2} height={cellH} fill={popupFillValue} stroke="none" />
              <line x1="0" y1="1" x2={cellW2} y2="1" stroke={popupBorderColor} strokeWidth="2" />
              <line x1="0" y1={cellH - 1} x2={cellW2} y2={cellH - 1} stroke={popupBorderColor} strokeWidth="2" />
              <line x1={cellW2 - 1} y1="0" x2={cellW2 - 1} y2={cellH} stroke={popupBorderColor} strokeWidth="2" />
              <text x="6" y="18" fill={selectedRadio ? COLORS.WHITE : popupTextColor} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">M/S</text>
              <rect x="44" y="6" width="15" height="15" fill={selectedRadio ? COLORS.GREEN : 'none'} stroke={selectedRadio ? COLORS.GREEN : popupBorderColor} strokeWidth="1" />
              {selectedRadio && <text x="51" y="18" textAnchor="middle" fill={COLORS.BLACK} fontSize="15" fontFamily="RDVSimulated, monospace" fontWeight="100">M</text>}
            </svg>

            {/* Cell 4: TX Section */}
            <svg width={cellW3} height={cellH} viewBox={`0 0 ${cellW3} ${cellH}`} style={{ display: 'block', flexShrink: 0, cursor: selectedRadio ? 'pointer' : 'default' }}
              onClick={() => selectedRadio && freq && sendMsg({ type: 'tx', cmd1: '' + freq, dbl1: !isTx })}>
              <FillPatternDefs color={popupBorderColor} />
              <rect x="0" y="0" width={cellW3} height={cellH} fill={popupFillValue} stroke="none" />
              <line x1="0" y1="1" x2={cellW3} y2="1" stroke={popupBorderColor} strokeWidth="2" />
              <line x1="0" y1={cellH - 1} x2={cellW3} y2={cellH - 1} stroke={popupBorderColor} strokeWidth="2" />
              <line x1={cellW3 - 1} y1="0" x2={cellW3 - 1} y2={cellH} stroke={popupBorderColor} strokeWidth="2" />
              <text x="6" y="18" fill={selectedRadio ? COLORS.WHITE : popupTextColor} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">TX</text>
              <rect x="30" y="6" width="30" height="15" fill={isTx ? COLORS.GREEN : 'none'} stroke={selectedRadio ? COLORS.GREEN : popupBorderColor} strokeWidth="1" />
              {/* TX radial PTT indicator */}
              <circle cx="45" cy="34" r="6" fill={isTx ? COLORS.RED : COLORS.BLACK} stroke={selectedRadio ? COLORS.RED : popupBorderColor} strokeWidth="2" />
            </svg>

            {/* Cell 5: Secondary M/S Section */}
            <svg width={cellW4} height={cellH} viewBox={`0 0 ${cellW4} ${cellH}`} style={{ display: 'block', flexShrink: 0 }}>
              <FillPatternDefs color={popupBorderColor} />
              <rect x="0" y="0" width={cellW4} height={cellH} fill={popupFillValue} stroke="none" />
              <line x1="0" y1="1" x2={cellW4} y2="1" stroke={popupBorderColor} strokeWidth="2" />
              <line x1="0" y1={cellH - 1} x2={cellW4} y2={cellH - 1} stroke={popupBorderColor} strokeWidth="2" />
              <line x1={cellW4 - 1} y1="0" x2={cellW4 - 1} y2={cellH} stroke={popupBorderColor} strokeWidth="2" />
              <text x="6" y="18" fill={selectedRadio ? COLORS.WHITE : popupTextColor} fontSize="16" fontFamily="RDVSimulated, monospace" fontWeight="100">M/S</text>
              <rect x="44" y="6" width="15" height="15" fill={selectedRadio ? COLORS.GREEN : 'none'} stroke={selectedRadio ? COLORS.GREEN : popupBorderColor} strokeWidth="1" />
              {selectedRadio && <text x="51" y="18" textAnchor="middle" fill={COLORS.BLACK} fontSize="15" fontFamily="RDVSimulated, monospace" fontWeight="100">M</text>}
            </svg>
          </div>
        );
      }

      case 'RADIO_OVERFLOW': {
        // R.O. - Radio Overflow: Single stacked HS/LS indicator with PTT circles
        // R.O. is always exactly ONE cell wide (CELL_WIDTH), regardless of colSpan
        // The colSpan just determines the space allocated, but R.O. only needs 1 cell
        // Same format as HS_LS function button - black background, no border, green outlines
        const cellW = CELL_WIDTH;
        const cellH = CELL_HEIGHT;

        // Spacing constants - tighter layout with larger font
        const boxWidth = 34;
        const boxHeight = 18;
        const circleRadius = 6;
        const leftPadding = 4;
        const circleRightPadding = 8;
        const circleX = cellW - circleRightPadding - circleRadius;

        // Vertical layout: HS in top half, LS in bottom half
        const hsBoxY = 4;
        const hsTextY = hsBoxY + 14; // Baseline for font inside box
        const hsCenterY = hsBoxY + boxHeight / 2;

        const lsBoxY = cellH - boxHeight - 4;
        const lsTextY = lsBoxY + 14;
        const lsCenterY = lsBoxY + boxHeight / 2;

        // R.O. is a single indicator module - just render one cell
        // If colSpan > 1, fill remaining space with black cells
        const numBlankCells = Math.max(0, Math.round(width / (CELL_WIDTH + GAP)) - 1);

        return (
          <div key={key} style={{ display: 'flex', gap: `${GAP}px` }}>
            {/* The actual R.O. indicator */}
            <svg
              width={cellW}
              height={cellH}
              viewBox={`0 0 ${cellW} ${cellH}`}
              style={{ display: 'block', flexShrink: 0 }}
            >
              {/* Black background, no border */}
              <rect x="0" y="0" width={cellW} height={cellH} fill={COLORS.BLACK} />
              {/* HS label and indicator box */}
              <rect x={leftPadding} y={hsBoxY} width={boxWidth} height={boxHeight} fill="none" stroke={COLORS.GREEN} strokeWidth="1" />
              <text x={leftPadding + boxWidth / 2} y={hsTextY} textAnchor="middle" fill={COLORS.WHITE} fontSize="14" fontFamily="RDVSimulated, monospace" fontWeight="100">HS</text>
              <circle cx={circleX} cy={hsCenterY} r={circleRadius} fill={COLORS.BLACK} stroke={COLORS.RED} strokeWidth="2" />
              {/* LS label and indicator box */}
              <rect x={leftPadding} y={lsBoxY} width={boxWidth} height={boxHeight} fill="none" stroke={COLORS.GREEN} strokeWidth="1" />
              <text x={leftPadding + boxWidth / 2} y={lsTextY} textAnchor="middle" fill={COLORS.WHITE} fontSize="14" fontFamily="RDVSimulated, monospace" fontWeight="100">LS</text>
              <circle cx={circleX} cy={lsCenterY} r={circleRadius} fill={COLORS.BLACK} stroke={COLORS.RED} strokeWidth="2" />
            </svg>
            {/* Fill remaining space with blank cells if colSpan > 1 */}
            {Array.from({ length: numBlankCells }, (_, i) => (
              <svg
                key={`${key}-blank-${i}`}
                width={cellW}
                height={cellH}
                viewBox={`0 0 ${cellW} ${cellH}`}
                style={{ display: 'block', flexShrink: 0 }}
              >
                <rect x="0" y="0" width={cellW} height={cellH} fill={COLORS.BLACK} />
              </svg>
            ))}
          </div>
        );
      }

      case 'UNUSED':
      default: {
        // Blank/unused cells - completely black
        // Render as individual modular cells
        const cellW = CELL_WIDTH;
        const cellH = CELL_HEIGHT;
        const numCells = Math.max(1, Math.round(width / (CELL_WIDTH + GAP)));
        const cells = [];
        for (let i = 0; i < numCells; i++) {
          cells.push(
            <svg
              key={`${key}-${i}`}
              width={cellW}
              height={cellH}
              viewBox={`0 0 ${cellW} ${cellH}`}
              style={{ display: 'block', flexShrink: 0 }}
            >
              <rect x={0} y={0} width={cellW} height={cellH} fill={COLORS.BLACK} />
            </svg>
          );
        }
        return (
          <div key={key} style={{ display: 'flex', gap: `${GAP}px` }}>
            {cells}
          </div>
        );
      }
    }
  };

  /**
   * Render the footer row based on the current page's footer keyword
   */
  const renderFooterRow = (): React.ReactNode => {
    const footerKeyword = getCurrentFooterKeyword();
    const layout = FOOTER_LAYOUTS[footerKeyword];

    if (!layout) {
      // Fallback to empty footer
      return null;
    }

    // Render each section of the footer
    return layout.map((section, idx) => {
      // Calculate width based on colSpan (each column is CELL_WIDTH + GAP, except last)
      const sectionWidth = section.colSpan * CELL_WIDTH + (section.colSpan - 1) * GAP;

      return renderFooterCell(
        section.type,
        section.startCol,
        sectionWidth,
        CELL_HEIGHT,
        `footer-${idx}-${section.type}-${section.startCol}`
      );
    });
  };

  // Render page tabs sliver
  // Tabs align with left edge of second column (paddingLeft = CELL_WIDTH + GAP = 78px)
  // Tabs touch horizontally (no gap)
  // Spacing between sliver and grid: marginTop for bottom, marginBottom for top
  const renderPageSliver = () => (
    <div
      style={{
        width: `${AVAILABLE_WIDTH}px`,
        height: `${SLIVER_HEIGHT}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingLeft: `${CELL_WIDTH + GAP}px`,
        gap: '0',
        marginTop: sliverPosition === 'bottom' ? '4px' : undefined,
        marginBottom: sliverPosition === 'top' ? '4px' : undefined,
      }}
    >
      {/* Page tabs - aligned with column 2, touching horizontally */}
      {Array.from({ length: maxPage }, (_, i) => i + 1).map((pageNum) => (
        renderPageTab(pageNum, pageNum === currentPage, sliverPosition)
      ))}
    </div>
  );

  return (
    <div
      style={{
        backgroundColor: COLORS.BLACK,
        padding: '20px',
        display: 'inline-block',
      }}
    >
      <div
        style={{
          width: `${CONTAINER_WIDTH}px`,
          height: `${CONTAINER_HEIGHT}px`,
          backgroundColor: COLORS.BLACK,
          color: COLORS.WHITE,
          fontFamily: 'RDVSimulated, monospace',
          fontWeight: 100,
          fontSize: '14px',
          userSelect: 'none',
          padding: `${PADDING}px`,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Sliver (page tabs) at top if configured */}
        {sliverPosition === 'top' && renderPageSliver()}

        {/* Main grid container */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_WIDTH}px)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL_HEIGHT}px)`,
            gap: `${GAP}px`,
          }}
        >
          {/* Row 0: Header modules */}
          {renderHeaderRow()}

          {/* Rows 1-8: Communication matrix */}
          {renderCommunicationMatrix()}

          {/* Row 9: Footer row - DA/Radio overflow per TED pattern footer keyword */}
          <div
            style={{
              gridColumn: '1 / span 10',
              gridRow: '10',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: `${GAP}px`,
              height: CELL_HEIGHT,
            }}
          >
            {renderFooterRow()}
          </div>
        </div>

        {/* Sliver (page tabs) at bottom if configured - OUTSIDE the grid */}
        {sliverPosition === 'bottom' && renderPageSliver()}
      </div>
    </div>
  );
}
