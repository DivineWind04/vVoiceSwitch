// TED Pattern Parser and Validator
// Parses TEDPatternConfig and validates against position data

import {
  TEDPatternConfig,
  TEDPageConfig,
  TEDCellConfig,
  TEDValidationError,
  ParsedTEDLayout,
  ParsedPage,
  ParsedCell,
  ModuleType,
  FooterKeyword,
  QuadrantNumber,
  QuadrantRow,
  QuadrantCol,
  quadrantToGrid,
  getModuleColSpan,
  canModuleStartAtCol,
  isValidFooterKeyword,
} from '../types/ted_pattern_types';

// ============================================================
// POSITION DATA INTERFACE (minimal for validation)
// ============================================================

interface PositionLine {
  call_id: string;
  // Additional fields exist but not needed for validation
}

interface PositionRadio {
  id: string;
  // Additional fields exist but not needed for validation
}

interface PositionData {
  lines?: Array<[string, number, string] | PositionLine>;
  radios?: PositionRadio[];
}

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

/**
 * Validate a TED pattern configuration against position data
 * Returns an array of validation errors (empty if valid)
 */
export function validateTEDPattern(
  config: TEDPatternConfig,
  position: PositionData
): TEDValidationError[] {
  const errors: TEDValidationError[] = [];

  // Extract line IDs from position (handle array format)
  const lineIds = new Set<string>();
  if (position.lines) {
    for (const line of position.lines) {
      if (Array.isArray(line)) {
        lineIds.add(String(line[0]));
      } else if (line.call_id) {
        lineIds.add(line.call_id);
      }
    }
  }

  // Extract radio IDs from position
  const radioIds = new Set<string>();
  if (position.radios) {
    for (const radio of position.radios) {
      if (radio.id) {
        radioIds.add(radio.id);
      }
    }
  }

  // Validate pages
  const pageNumbers = new Set<number>();

  for (const page of config.pages) {
    // Check for duplicate page numbers
    if (pageNumbers.has(page.pageNumber)) {
      errors.push({
        code: 'DUPLICATE_PAGE',
        message: `Page ${page.pageNumber} is defined multiple times`,
        pageNumber: page.pageNumber,
        severity: 'error',
      });
    }
    pageNumbers.add(page.pageNumber);

    // Check page number range (1-8)
    if (page.pageNumber < 1 || page.pageNumber > 8) {
      errors.push({
        code: 'INVALID_PAGE',
        message: `Page number ${page.pageNumber} is out of range (must be 1-8)`,
        pageNumber: page.pageNumber,
        severity: 'error',
      });
    }

    // Validate footer keyword
    if (!isValidFooterKeyword(page.footer)) {
      errors.push({
        code: 'INVALID_FOOTER',
        message: `Invalid footer keyword: "${page.footer}"`,
        pageNumber: page.pageNumber,
        severity: 'error',
      });
    }

    // Validate cells
    const pageErrors = validatePageCells(page, lineIds, radioIds);
    errors.push(...pageErrors);
  }

  return errors;
}

/**
 * Validate cells within a page
 */
function validatePageCells(
  page: TEDPageConfig,
  lineIds: Set<string>,
  radioIds: Set<string>
): TEDValidationError[] {
  const errors: TEDValidationError[] = [];

  // Create occupancy grid for overlap detection (8 rows x 14 cols)
  // Cols 0-9: standard grid columns
  // Cols 10-13: PARTIAL position tracking (10=unused, 11-13 = positions 1-3)
  const occupancy: boolean[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 14 }, () => false)
  );

  for (const cell of page.cells) {
    // Validate quad/row/col ranges
    if (cell.quad < 1 || cell.quad > 4) {
      errors.push({
        code: 'OUT_OF_BOUNDS',
        message: `Invalid quadrant ${cell.quad} (must be 1-4)`,
        cell: { quad: cell.quad, row: cell.row, col: cell.col },
        pageNumber: page.pageNumber,
        severity: 'error',
      });
      continue;
    }

    if (cell.row < 1 || cell.row > 4) {
      errors.push({
        code: 'OUT_OF_BOUNDS',
        message: `Invalid row ${cell.row} in Q${cell.quad} (must be 1-4)`,
        cell: { quad: cell.quad, row: cell.row, col: cell.col },
        pageNumber: page.pageNumber,
        severity: 'error',
      });
      continue;
    }

    // PARTIAL uses col 1-3 (position within row), others use col 1-5 (grid column)
    const maxCol = cell.type === 'PARTIAL' ? 3 : 5;
    if (cell.col < 1 || cell.col > maxCol) {
      errors.push({
        code: 'OUT_OF_BOUNDS',
        message: cell.type === 'PARTIAL'
          ? `Invalid position ${cell.col} for PARTIAL in Q${cell.quad} (must be 1-3)`
          : `Invalid column ${cell.col} in Q${cell.quad} (must be 1-5)`,
        cell: { quad: cell.quad, row: cell.row, col: cell.col },
        pageNumber: page.pageNumber,
        severity: 'error',
      });
      continue;
    }

    // Check if module can fit at this column (skip for PARTIAL since it uses position, not col)
    if (cell.type !== 'PARTIAL' && !canModuleStartAtCol(cell.type, cell.col as QuadrantCol)) {
      errors.push({
        code: 'INVALID_POSITION',
        message: `${cell.type} cannot start at column ${cell.col} in Q${cell.quad} (needs ${getModuleColSpan(cell.type)} columns)`,
        cell: { quad: cell.quad, row: cell.row, col: cell.col },
        pageNumber: page.pageNumber,
        severity: 'error',
      });
      continue;
    }

    // Validate required IDs based on type
    if (cell.type === 'DA') {
      if (!cell.lineId) {
        errors.push({
          code: 'MISSING_ID',
          message: `DA cell at Q${cell.quad} R${cell.row} C${cell.col} is missing lineId`,
          cell: { quad: cell.quad, row: cell.row, col: cell.col },
          pageNumber: page.pageNumber,
          severity: 'error',
        });
      } else if (!lineIds.has(cell.lineId)) {
        errors.push({
          code: 'LINE_NOT_FOUND',
          message: `Line ID "${cell.lineId}" not found in position.lines`,
          cell: { quad: cell.quad, row: cell.row, col: cell.col },
          pageNumber: page.pageNumber,
          severity: 'error',
        });
      }
    }

    if (cell.type === 'RADIO' || cell.type === 'PARTIAL') {
      if (!cell.radioId) {
        errors.push({
          code: 'MISSING_ID',
          message: `${cell.type} cell at Q${cell.quad} R${cell.row} C${cell.col} is missing radioId`,
          cell: { quad: cell.quad, row: cell.row, col: cell.col },
          pageNumber: page.pageNumber,
          severity: 'error',
        });
      } else if (!radioIds.has(cell.radioId)) {
        errors.push({
          code: 'RADIO_NOT_FOUND',
          message: `Radio ID "${cell.radioId}" not found in position.radios`,
          cell: { quad: cell.quad, row: cell.row, col: cell.col },
          pageNumber: page.pageNumber,
          severity: 'error',
        });
      }
    }

    if (cell.type === 'FUNC' && !cell.funcType) {
      errors.push({
        code: 'MISSING_FUNC_TYPE',
        message: `FUNC cell at Q${cell.quad} R${cell.row} C${cell.col} is missing funcType`,
        cell: { quad: cell.quad, row: cell.row, col: cell.col },
        pageNumber: page.pageNumber,
        severity: 'error',
      });
    }

    // Check for overlaps
    // PARTIAL cells are grouped by row in rendering, so we check differently:
    // - PARTIALs can coexist on the same row (positions 1-3) but not at the same position
    // - PARTIALs occupy the full quadrant row, blocking other cell types
    const baseGrid = quadrantToGrid(
      cell.quad as QuadrantNumber,
      cell.row as QuadrantRow,
      cell.type === 'PARTIAL' ? 1 as QuadrantCol : cell.col as QuadrantCol
    );
    const gridRow = baseGrid.gridRow;

    if (cell.type === 'PARTIAL') {
      // For PARTIAL, check if another PARTIAL exists at the same position in this row
      const partialKey = `partial-${gridRow}-${cell.col}`;
      if (occupancy[gridRow]?.[10 + cell.col]) { // Use cols 11-13 for PARTIAL position tracking
        errors.push({
          code: 'CELL_OVERLAP',
          message: `PARTIAL at Q${cell.quad} R${cell.row} position ${cell.col} overlaps with another PARTIAL`,
          cell: { quad: cell.quad, row: cell.row, col: cell.col },
          pageNumber: page.pageNumber,
          severity: 'error',
        });
      } else {
        // Mark this PARTIAL position as occupied (use extended occupancy slots)
        const rowData = occupancy[gridRow];
        if (rowData) {
          rowData[10 + cell.col] = true; // Positions 1-3 map to indices 11-13
          // Also mark the entire quadrant row as having PARTIALs (block non-PARTIAL cells)
          const quadrantStartCol = baseGrid.gridCol;
          for (let c = quadrantStartCol; c < quadrantStartCol + 5; c++) {
            rowData[c] = true;
          }
        }
      }
    } else {
      // Non-PARTIAL cells: standard overlap check
      const gridCol = baseGrid.gridCol;
      const colSpan = getModuleColSpan(cell.type);

      for (let c = gridCol; c < gridCol + colSpan && c < 10; c++) {
        const rowData = occupancy[gridRow];
        if (rowData && rowData[c]) {
          errors.push({
            code: 'CELL_OVERLAP',
            message: `Cell at Q${cell.quad} R${cell.row} C${cell.col} overlaps with another cell`,
            cell: { quad: cell.quad, row: cell.row, col: cell.col },
            pageNumber: page.pageNumber,
            severity: 'error',
          });
          break;
        }
        if (rowData) {
          rowData[c] = true;
        }
      }
    }
  }

  return errors;
}

// ============================================================
// PARSER FUNCTIONS
// ============================================================

/**
 * Parse a TED pattern configuration into a layout ready for rendering
 * Also validates the config and includes any errors in the result
 */
export function parseTEDPattern(
  config: TEDPatternConfig,
  position: PositionData
): ParsedTEDLayout {
  // Validate first
  const errors = validateTEDPattern(config, position);

  // Parse pages
  const pages: ParsedPage[] = config.pages.map((pageConfig) =>
    parsePage(pageConfig)
  );

  return {
    patternName: config.patternName,
    dimPercent: config.dimPercent ?? 50,
    display: config.display,
    pages,
    errors,
  };
}

/**
 * Parse a single page configuration
 */
function parsePage(pageConfig: TEDPageConfig): ParsedPage {
  // Create occupancy grid (8 rows x 10 cols)
  const occupancy: boolean[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 10 }, () => false)
  );

  // Parse cells
  const cells: ParsedCell[] = [];

  for (const cellConfig of pageConfig.cells) {
    // Skip invalid cells (will be caught by validation)
    // PARTIAL uses col 1-3 (position), others use col 1-5 (grid column)
    const maxCol = cellConfig.type === 'PARTIAL' ? 3 : 5;
    if (
      cellConfig.quad < 1 || cellConfig.quad > 4 ||
      cellConfig.row < 1 || cellConfig.row > 4 ||
      cellConfig.col < 1 || cellConfig.col > maxCol
    ) {
      continue;
    }

    let gridRow: number;
    let gridCol: number;
    let colSpan: number;

    if (cellConfig.type === 'PARTIAL') {
      // PARTIAL radios use col 1-3 to represent position within a row
      // All PARTIALs in a row are grouped and rendered together in a flex container
      // gridCol is the quadrant's starting column (0 or 5), colSpan is 5 (full quadrant)
      // The position (1-3) is stored in config.col and used for sorting
      const baseGrid = quadrantToGrid(
        cellConfig.quad as QuadrantNumber,
        cellConfig.row as QuadrantRow,
        1 as QuadrantCol
      );
      gridRow = baseGrid.gridRow;
      gridCol = baseGrid.gridCol; // Start of quadrant (0 or 5)
      colSpan = 5; // Full quadrant width - actual positioning done in renderer
    } else {
      const baseGrid = quadrantToGrid(
        cellConfig.quad as QuadrantNumber,
        cellConfig.row as QuadrantRow,
        cellConfig.col as QuadrantCol
      );
      gridRow = baseGrid.gridRow;
      gridCol = baseGrid.gridCol;
      colSpan = getModuleColSpan(cellConfig.type);
    }

    cells.push({
      gridRow,
      gridCol,
      colSpan,
      config: cellConfig,
    });

    // Mark occupancy
    for (let c = gridCol; c < gridCol + colSpan && c < 10; c++) {
      const rowData = occupancy[gridRow];
      if (rowData) {
        rowData[c] = true;
      }
    }
  }

  return {
    pageNumber: pageConfig.pageNumber,
    footer: pageConfig.footer,
    cells,
    occupancy,
  };
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get a cell at specific grid coordinates from a parsed page
 */
export function getCellAtGridPosition(
  page: ParsedPage,
  gridRow: number,
  gridCol: number
): ParsedCell | null {
  for (const cell of page.cells) {
    if (cell.gridRow === gridRow) {
      // Check if gridCol falls within this cell's span
      if (gridCol >= cell.gridCol && gridCol < cell.gridCol + cell.colSpan) {
        return cell;
      }
    }
  }
  return null;
}

/**
 * Check if a grid position is occupied
 */
export function isGridPositionOccupied(
  page: ParsedPage,
  gridRow: number,
  gridCol: number
): boolean {
  return page.occupancy[gridRow]?.[gridCol] ?? false;
}

/**
 * Get the page config for a specific page number
 */
export function getPageByNumber(
  layout: ParsedTEDLayout,
  pageNumber: number
): ParsedPage | null {
  return layout.pages.find((p) => p.pageNumber === pageNumber) ?? null;
}

/**
 * Find a line in position data by ID
 */
export function findLineById(
  position: PositionData,
  lineId: string
): { call_id: string; type: number; label: string } | null {
  if (!position.lines) return null;

  for (const line of position.lines) {
    if (Array.isArray(line)) {
      if (String(line[0]) === lineId) {
        return {
          call_id: String(line[0]),
          type: line[1],
          label: line[2] || '',
        };
      }
    }
  }
  return null;
}

/**
 * Find a radio in position data by ID
 */
export function findRadioById(
  position: PositionData,
  radioId: string
): PositionRadio | null {
  if (!position.radios) return null;
  return position.radios.find((r) => r.id === radioId) ?? null;
}
