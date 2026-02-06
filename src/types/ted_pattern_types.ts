// TED Pattern Configuration Types
// Based on FAA TI 6650.58 specifications with quadrant-based cell references

// ============================================================
// MAIN CONFIGURATION TYPES
// ============================================================

/**
 * TED Pattern Configuration - embedded in position JSON
 */
export interface TEDPatternConfig {
  /** Pattern name for identification (e.g., "PAT-S3", "TRACON_STANDARD") */
  patternName: string;

  /** Default brightness percentage (0-100) when position is loaded. Default: 50 */
  dimPercent?: number;

  /** Activity display location in header (applies to all pages) */
  display: DisplayLocation;

  /** Page definitions (1-8 pages supported) */
  pages: TEDPageConfig[];
}

/**
 * Page configuration within a TED pattern
 */
export interface TEDPageConfig {
  /** Page number (1-8) */
  pageNumber: number;

  /** Footer layout configuration */
  footer: FooterKeyword;

  /** Grid cell definitions - quadrant-based row/col references */
  cells: TEDCellConfig[];
}

/**
 * Cell configuration within a page
 */
export interface TEDCellConfig {
  /** Quadrant number (1=top-left, 2=top-right, 3=bottom-left, 4=bottom-right) */
  quad: QuadrantNumber;

  /** Row within quadrant (1-4) */
  row: QuadrantRow;

  /**
   * Column within quadrant
   * - For most types: 1-5 (standard grid columns)
   * - For PARTIAL: 1-3 (position within row of up to 3 partial radios)
   *   PARTIAL radios occupy their own row, with 1-3 panels fitting across
   */
  col: QuadrantCol;

  /** Module type */
  type: ModuleType;

  /** For DA buttons - unique line ID from position.lines (matches call_id) */
  lineId?: string;

  /** For RADIO/PARTIAL - unique radio ID from position.radios */
  radioId?: string;

  /** For FUNC buttons - function key type */
  funcType?: FuncKeyType;
}

// ============================================================
// ENUM/UNION TYPES
// ============================================================

/** Quadrant number (1-4) */
export type QuadrantNumber = 1 | 2 | 3 | 4;

/** Row within quadrant (1-4) */
export type QuadrantRow = 1 | 2 | 3 | 4;

/** Column within quadrant (1-5) */
export type QuadrantCol = 1 | 2 | 3 | 4 | 5;

/** Activity display location */
export type DisplayLocation = 'LEFT' | 'RIGHT' | 'NONE';

/** Module types supported */
export type ModuleType = 'DA' | 'RADIO' | 'PARTIAL' | 'IA' | 'NULL' | 'FUNC';

/** Function key types */
export type FuncKeyType =
  | 'HOLD'
  | 'REL'
  | 'HL'
  | 'RECON'
  | 'FWD'
  | 'OHL'
  | 'RHL'
  | 'RB'
  | 'HS_LS';

/**
 * Footer layout keywords per FAA spec
 * Each keyword defines a 10-cell footer arrangement
 */
export type FooterKeyword =
  | 'DRP'   // DA Overflows | R.O. | Pop-Up Radio
  | 'RDP'   // R.O. | DA Overflows | Pop-Up Radio
  | 'DP'    // DA Overflows | Pop-Up Radio
  | 'PRD'   // Pop-Up Radio | R.O. | DA Overflows
  | 'PDR'   // Pop-Up Radio | DA Overflows | R.O.
  | 'PD'    // Pop-Up Radio | DA Overflows
  | 'DR'    // DA Overflows | R.O.
  | 'RD'    // R.O. | DA Overflows
  | 'DA'    // DA Overflows only
  | 'RA'    // R.O. | Unused
  | 'RP'    // R.O. | Unused | Pop-Up Radio
  | 'PR'    // Pop-Up Radio | Unused | R.O.
  | 'NP'    // Unused | Pop-Up Radio
  | 'POP'   // Pop-Up Radio | Unused
  | 'NONE'; // All unused

// ============================================================
// MODULE DIMENSIONS (auto-calculated from type)
// ============================================================

/** Column span for each module type */
export const MODULE_COL_SPANS: Record<ModuleType, number> = {
  DA: 1,
  RADIO: 5,    // Full quadrant width
  PARTIAL: 2,  // Spans ~2 cols in grid for positioning (actual render width is 1/3 quadrant)
  IA: 3,
  NULL: 1,
  FUNC: 1,
};

/**
 * Maximum start column for each module type (to fit within quadrant)
 * Note: PARTIAL uses col 1-3 to represent position (1st, 2nd, 3rd) within a row
 * of partial radios, not the actual grid column
 */
export const MODULE_MAX_START_COL: Record<ModuleType, QuadrantCol> = {
  DA: 5,
  RADIO: 1,    // Must start at col 1 to span 5
  PARTIAL: 3,  // Position 1, 2, or 3 within partial row (maps to grid cols 1, 3, 5)
  IA: 3,       // Can start at col 1-3 (needs 3 cols)
  NULL: 5,
  FUNC: 5,
};

// ============================================================
// VALIDATION TYPES
// ============================================================

/** Validation error severity */
export type ValidationSeverity = 'error' | 'warning';

/** Validation error codes */
export type ValidationErrorCode =
  | 'CELL_OVERLAP'       // Two cells defined at same position
  | 'OUT_OF_BOUNDS'      // Cell quad/row/col exceeds valid range
  | 'MISSING_ID'         // lineId/radioId required but missing
  | 'LINE_NOT_FOUND'     // lineId doesn't exist in position.lines
  | 'RADIO_NOT_FOUND'    // radioId doesn't exist in position.radios
  | 'INVALID_FOOTER'     // Unknown footer keyword
  | 'INVALID_POSITION'   // Module can't fit at specified col
  | 'INVALID_PAGE'       // Page number out of range
  | 'DUPLICATE_PAGE'     // Same page number defined twice
  | 'MISSING_FUNC_TYPE'; // FUNC cell without funcType

/**
 * Validation error for TED pattern configuration
 */
export interface TEDValidationError {
  /** Error code for programmatic handling */
  code: ValidationErrorCode;

  /** Human-readable error message */
  message: string;

  /** Cell location (if applicable) */
  cell?: {
    quad: number;
    row: number;
    col: number;
  };

  /** Page number (if applicable) */
  pageNumber?: number;

  /** Severity level */
  severity: ValidationSeverity;
}

// ============================================================
// PARSED LAYOUT TYPES (internal use)
// ============================================================

/**
 * Parsed cell with absolute grid coordinates
 */
export interface ParsedCell {
  /** Absolute grid row (0-7) */
  gridRow: number;

  /** Absolute grid column (0-9) */
  gridCol: number;

  /** Column span */
  colSpan: number;

  /** Original cell config */
  config: TEDCellConfig;
}

/**
 * Parsed page layout
 */
export interface ParsedPage {
  /** Page number */
  pageNumber: number;

  /** Footer keyword */
  footer: FooterKeyword;

  /** Parsed cells with absolute coordinates */
  cells: ParsedCell[];

  /** Grid occupancy map for overlap detection */
  occupancy: boolean[][];
}

/**
 * Fully parsed TED layout
 */
export interface ParsedTEDLayout {
  /** Pattern name */
  patternName: string;

  /** Brightness percentage */
  dimPercent: number;

  /** Activity display location in header */
  display: DisplayLocation;

  /** Parsed pages */
  pages: ParsedPage[];

  /** Validation errors (empty if valid) */
  errors: TEDValidationError[];
}

// ============================================================
// FOOTER LAYOUT DEFINITIONS
// ============================================================

/** Footer section types */
export type FooterSectionType = 'DA_OVERFLOW' | 'RADIO_OVERFLOW' | 'POPUP_RADIO' | 'UNUSED';

/** Footer section definition */
export interface FooterSection {
  type: FooterSectionType;
  startCol: number;  // 0-9
  colSpan: number;
}

/**
 * Footer layouts per keyword (10 cells total, 0-indexed columns 0-9)
 * Based on FAA TI 6650.58 specification
 *
 * Cell assignments (user positions are 1-10, we use 0-indexed):
 * - DRP: 1-4 DA Overflows, 5 R.O., 6-10 Pop-Up Radio
 * - RDP: 1 R.O., 2-5 DA Overflows, 6-10 Pop-Up Radio
 * - DP:  1-5 DA Overflows, 6-10 Pop-Up Radio
 * - PRD: 1-5 Pop-Up Radio, 6 R.O., 7-10 DA Overflows
 * - PDR: 1-5 Pop-Up Radio, 6-9 DA Overflows, 10 R.O.
 * - PD:  1-5 Pop-Up Radio, 6-10 DA Overflows
 * - DR:  1-5 DA Overflows, 6-9 DA Overflows, 10 R.O.
 * - RD:  1 R.O., 2-5 DA Overflows, 6-10 DA Overflows
 * - DA:  1-10 DA Overflows
 * - RA:  1 R.O., 2-5 Unused, 6-10 Unused
 * - RP:  1 R.O., 2-5 Unused, 6-10 Pop-Up Radio
 * - PR:  1-5 Pop-Up Radio, 6-9 Unused, 10 R.O.
 * - NP:  1-5 Unused, 6-10 Pop-Up Radio
 * - POP: 1-5 Pop-Up Radio, 6-10 Unused
 * - NONE: 1-10 Unused
 */
export const FOOTER_LAYOUTS: Record<FooterKeyword, FooterSection[]> = {
  // DRP: 1-4 DA Overflows (cols 0-3), 5 R.O. (col 4), 6-10 Pop-Up Radio (cols 5-9)
  DRP: [
    { type: 'DA_OVERFLOW', startCol: 0, colSpan: 4 },
    { type: 'RADIO_OVERFLOW', startCol: 4, colSpan: 1 },
    { type: 'POPUP_RADIO', startCol: 5, colSpan: 5 },
  ],
  // RDP: 1 R.O. (col 0), 2-5 DA Overflows (cols 1-4), 6-10 Pop-Up Radio (cols 5-9)
  RDP: [
    { type: 'RADIO_OVERFLOW', startCol: 0, colSpan: 1 },
    { type: 'DA_OVERFLOW', startCol: 1, colSpan: 4 },
    { type: 'POPUP_RADIO', startCol: 5, colSpan: 5 },
  ],
  // DP: 1-5 DA Overflows (cols 0-4), 6-10 Pop-Up Radio (cols 5-9)
  DP: [
    { type: 'DA_OVERFLOW', startCol: 0, colSpan: 5 },
    { type: 'POPUP_RADIO', startCol: 5, colSpan: 5 },
  ],
  // PRD: 1-5 Pop-Up Radio (cols 0-4), 6 R.O. (col 5), 7-10 DA Overflows (cols 6-9)
  PRD: [
    { type: 'POPUP_RADIO', startCol: 0, colSpan: 5 },
    { type: 'RADIO_OVERFLOW', startCol: 5, colSpan: 1 },
    { type: 'DA_OVERFLOW', startCol: 6, colSpan: 4 },
  ],
  // PDR: 1-5 Pop-Up Radio (cols 0-4), 6-9 DA Overflows (cols 5-8), 10 R.O. (col 9)
  PDR: [
    { type: 'POPUP_RADIO', startCol: 0, colSpan: 5 },
    { type: 'DA_OVERFLOW', startCol: 5, colSpan: 4 },
    { type: 'RADIO_OVERFLOW', startCol: 9, colSpan: 1 },
  ],
  // PD: 1-5 Pop-Up Radio (cols 0-4), 6-10 DA Overflows (cols 5-9)
  PD: [
    { type: 'POPUP_RADIO', startCol: 0, colSpan: 5 },
    { type: 'DA_OVERFLOW', startCol: 5, colSpan: 5 },
  ],
  // DR: 1-5 DA Overflows (cols 0-4), 6-9 DA Overflows (cols 5-8), 10 R.O. (col 9)
  DR: [
    { type: 'DA_OVERFLOW', startCol: 0, colSpan: 9 },
    { type: 'RADIO_OVERFLOW', startCol: 9, colSpan: 1 },
  ],
  // RD: 1 R.O. (col 0), 2-5 DA Overflows (cols 1-4), 6-10 DA Overflows (cols 5-9)
  RD: [
    { type: 'RADIO_OVERFLOW', startCol: 0, colSpan: 1 },
    { type: 'DA_OVERFLOW', startCol: 1, colSpan: 9 },
  ],
  // DA: 1-10 DA Overflows (cols 0-9)
  DA: [
    { type: 'DA_OVERFLOW', startCol: 0, colSpan: 10 },
  ],
  // RA: 1 R.O. (col 0), 2-5 Unused (cols 1-4), 6-10 Unused (cols 5-9)
  RA: [
    { type: 'RADIO_OVERFLOW', startCol: 0, colSpan: 1 },
    { type: 'UNUSED', startCol: 1, colSpan: 9 },
  ],
  // RP: 1 R.O. (col 0), 2-5 Unused (cols 1-4), 6-10 Pop-Up Radio (cols 5-9)
  RP: [
    { type: 'RADIO_OVERFLOW', startCol: 0, colSpan: 1 },
    { type: 'UNUSED', startCol: 1, colSpan: 4 },
    { type: 'POPUP_RADIO', startCol: 5, colSpan: 5 },
  ],
  // PR: 1-5 Pop-Up Radio (cols 0-4), 6-9 Unused (cols 5-8), 10 R.O. (col 9)
  PR: [
    { type: 'POPUP_RADIO', startCol: 0, colSpan: 5 },
    { type: 'UNUSED', startCol: 5, colSpan: 4 },
    { type: 'RADIO_OVERFLOW', startCol: 9, colSpan: 1 },
  ],
  // NP: 1-5 Unused (cols 0-4), 6-10 Pop-Up Radio (cols 5-9)
  NP: [
    { type: 'UNUSED', startCol: 0, colSpan: 5 },
    { type: 'POPUP_RADIO', startCol: 5, colSpan: 5 },
  ],
  // POP: 1-5 Pop-Up Radio (cols 0-4), 6-10 Unused (cols 5-9)
  POP: [
    { type: 'POPUP_RADIO', startCol: 0, colSpan: 5 },
    { type: 'UNUSED', startCol: 5, colSpan: 5 },
  ],
  // NONE: 1-10 Unused (cols 0-9)
  NONE: [
    { type: 'UNUSED', startCol: 0, colSpan: 10 },
  ],
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Convert quadrant-based coordinates to absolute grid coordinates
 * Quadrant layout:
 *   Q1 (rows 0-3, cols 0-4) | Q2 (rows 0-3, cols 5-9)
 *   Q3 (rows 4-7, cols 0-4) | Q4 (rows 4-7, cols 5-9)
 */
export function quadrantToGrid(
  quad: QuadrantNumber,
  row: QuadrantRow,
  col: QuadrantCol
): { gridRow: number; gridCol: number } {
  // Convert 1-indexed to 0-indexed
  const qRow = row - 1;
  const qCol = col - 1;

  // Calculate absolute position based on quadrant
  const rowOffset = quad >= 3 ? 4 : 0;
  const colOffset = quad === 2 || quad === 4 ? 5 : 0;

  return {
    gridRow: qRow + rowOffset,
    gridCol: qCol + colOffset,
  };
}

/**
 * Check if a footer keyword is valid
 */
export function isValidFooterKeyword(keyword: string): keyword is FooterKeyword {
  return keyword in FOOTER_LAYOUTS;
}

/**
 * Get the column span for a module type
 */
export function getModuleColSpan(type: ModuleType): number {
  return MODULE_COL_SPANS[type];
}

/**
 * Check if a module can start at the given column
 */
export function canModuleStartAtCol(type: ModuleType, col: QuadrantCol): boolean {
  return col <= MODULE_MAX_START_COL[type];
}

// ============================================================
// RDVS COLOR PATTERN TYPES (per TI 6650.58)
// ============================================================

/**
 * Fill design options for button backgrounds
 */
export type FillDesign = 'solid' | 'empty' | 'interleaved' | 'dots' | 'closeDots';

/**
 * Screen color definition (text and background)
 */
export interface ScreenColorDef {
  text: string;       // Hex color for text
  background: string; // Hex color for background
}

/**
 * Color set definition - one of four possible color/fill combos
 * Per TI 6650.58 Section 2.5.4
 */
export interface ColorSetDef {
  name: string;            // Descriptive name (e.g., "Normal DA / Normal Radio")
  textColor: string;       // Hex color for button text
  backgroundColor: string; // Hex color for button background
  borderColor: string;     // Hex color for button border/frame
  fillDesign: FillDesign;  // Fill pattern for background
}

/**
 * Button type assignments to color sets
 * Maps each button category to a color set number (1-4)
 * Per TI 6650.58 Section 2.5.4
 */
export interface ButtonColorAssignments {
  intercomRingback: '1' | '2' | '3' | '4';    // Intercom Ringback Buttons
  intercomOverride: '1' | '2' | '3' | '4';    // Intercom Override Buttons
  controlMonitor: '1' | '2' | '3' | '4';      // Control Monitor Buttons
  specialFunction: '1' | '2' | '3' | '4';     // Special Function Buttons
  interphone: '1' | '2' | '3' | '4';          // Interphone Buttons (trunks)
  dialDigit: '1' | '2' | '3' | '4';           // Dial Digit Buttons
  normalRadio: '1' | '2' | '3' | '4';         // Normal Radio Channels
  emergencyRadio: '1' | '2' | '3' | '4';      // Emergency Radio Channels
  radioWithSidetone: '1' | '2' | '3' | '4';   // Radio Channels with Sidetone
  radioWithPreempt: '1' | '2' | '3' | '4';    // Radio Channels with Preempt
}

/**
 * RDVS Color Pattern Configuration
 * Defines color schemes for dark/bright environments and button type assignments
 * Per TI 6650.58 Section 2.5
 */
export interface RDVSColorPattern {
  patternName: string;         // Pattern identifier (e.g., "ZAB_DARK")
  description?: string;        // Optional description

  /** Screen colors for dark and bright environment modes */
  screenColors: {
    dark: ScreenColorDef;      // Dark environment scheme
    bright: ScreenColorDef;    // Bright environment scheme
  };

  /** Four color sets available for button assignments */
  colorSets: {
    '1': ColorSetDef;  // Color set #1 - typically "normal" buttons
    '2': ColorSetDef;  // Color set #2 - typically "significant DA" buttons
    '3': ColorSetDef;  // Color set #3 - typically "utility" buttons
    '4': ColorSetDef;  // Color set #4 - typically "significant radio" buttons
  };

  /** Mapping of button types to color sets */
  buttonAssignments: ButtonColorAssignments;
}
