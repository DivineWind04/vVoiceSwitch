/**
 * VATSIM Controller Detection
 * 
 * Fetches controller data from VATSIM live feed and matches it with
 * the user's CID/callsign from AFV WebSocket to auto-detect the
 * appropriate UI to render.
 */

// Use local API proxy to avoid CORS issues
const VATSIM_CONTROLLERS_URL = '/api/vatsim/controllers';

export interface VatsimPosition {
  facilityId: string;
  facilityName: string;
  positionId: string;
  positionName: string;
  positionType: 'Artcc' | 'Tracon' | 'Atct' | string;
  radioName: string;
  defaultCallsign: string;
  frequency: number;
  isPrimary: boolean;
  isActive: boolean;
  eramData?: { sectorId: string } | null;
  starsData?: {
    subset: number;
    sectorId: string;
    areaId: string;
    assumedTcps: string[];
  } | null;
}

export interface VatsimControllerData {
  cid: string;
  realName: string;
  controllerInfo: string;
  userRating: string;
  requestedRating: string;
  callsign: string;
  facilityType: string;
  primaryFrequency: number;
}

export interface VatsimController {
  artccId: string;
  primaryFacilityId: string;
  primaryPositionId: string;
  role: string;
  positions: VatsimPosition[];
  isActive: boolean;
  isObserver: boolean;
  loginTime: string;
  vatsimData: VatsimControllerData;
}

export interface VatsimControllersFeed {
  updatedAt: string;
  controllers: VatsimController[];
}

/**
 * Fetch the current list of online controllers from VATSIM
 */
export async function fetchVatsimControllers(): Promise<VatsimControllersFeed | null> {
  try {
    const response = await fetch(VATSIM_CONTROLLERS_URL);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data as VatsimControllersFeed;
  } catch (error) {
    console.error('[vatsimController] Error fetching controllers:', error);
    return null;
  }
}

/**
 * Find a controller in the VATSIM feed by CID
 */
export function findControllerByCid(
  feed: VatsimControllersFeed,
  cid: number | string
): VatsimController | null {
  const cidStr = String(cid);
  return feed.controllers.find(c => c.vatsimData.cid === cidStr) || null;
}

/**
 * Find a controller in the VATSIM feed by callsign
 */
export function findControllerByCallsign(
  feed: VatsimControllersFeed,
  callsign: string
): VatsimController | null {
  if (!callsign) return null;
  return feed.controllers.find(c => 
    c.vatsimData.callsign === callsign || 
    c.positions.some(p => p.defaultCallsign === callsign)
  ) || null;
}

/**
 * Match a VATSIM controller to a position in the local position data
 * Returns the matched position with its UI type
 * 
 * @param controller - VATSIM controller data (may have stale callsign)
 * @param positionData - Local position configuration
 * @param afvCallsign - Current callsign from AFV WebSocket (source of truth)
 */
export function matchControllerToPosition(
  controller: VatsimController | null,
  positionData: any,
  afvCallsign?: string
): { position: any; ui: string } | null {
  if (!positionData) return null;
  
  // PRIORITY: Use AFV callsign first (it's the real-time source of truth)
  // Fall back to VATSIM callsign only if AFV callsign not provided
  const controllerCallsign = afvCallsign || controller?.vatsimData?.callsign;
  const defaultCallsign = controller?.positions?.find(p => p.isPrimary)?.defaultCallsign;
  
  if (!controllerCallsign) return null;
  
  // Search for matching position in the position data
  const positions = getAllPositions(positionData);
  
  // Try exact match first
  let match = positions.find(p => p.cs === controllerCallsign);
  
  // If no exact match, try matching by default callsign
  if (!match && defaultCallsign) {
    match = positions.find(p => p.cs === defaultCallsign);
  }
  
  // If still no match, try partial matching (e.g., "OAK_TWR" matches "OAK_1_TWR")
  if (!match) {
    const baseCallsign = controllerCallsign.replace(/_\d+_/, '_');
    match = positions.find(p => {
      const posBase = p.cs?.replace(/_\d+_/, '_');
      return posBase === baseCallsign || p.cs === baseCallsign;
    });
  }
  
  // If still no match, try matching by frequency
  if (!match && controller?.vatsimData?.primaryFrequency) {
    const freq = controller.vatsimData.primaryFrequency;
    match = positions.find(p => p.freq === freq);
  }
  
  if (match) {
    return {
      position: match,
      ui: match.ui || 'vscs',
    };
  }
  
  return null;
}

/**
 * Get all positions from a nested facility structure
 * Handles both flat (positions at root) and nested (childFacilities) structures
 */
function getAllPositions(facility: any, positions: any[] = []): any[] {
  if (!facility) return positions;
  
  // Handle array of positions directly
  if (Array.isArray(facility)) {
    for (const item of facility) {
      if (item.cs) {
        positions.push(item);
      } else {
        getAllPositions(item, positions);
      }
    }
    return positions;
  }
  
  // Handle positions array at current level
  if (facility.positions && Array.isArray(facility.positions)) {
    for (const pos of facility.positions) {
      if (pos.cs) {
        positions.push(pos);
      }
    }
  }
  
  // Recurse into childFacilities
  if (facility.childFacilities && Array.isArray(facility.childFacilities)) {
    for (const child of facility.childFacilities) {
      getAllPositions(child, positions);
    }
  }
  
  return positions;
}

/**
 * Determine which UI to use based on position type from VATSIM data
 * Falls back to checking local position data
 */
export function determineUIFromVatsim(controller: VatsimController): string {
  const positionType = controller.positions.find(p => p.isPrimary)?.positionType;
  const facilityType = controller.vatsimData.facilityType;
  
  // Map VATSIM position/facility types to UI types
  // Note: The position JSON's `ui` field takes precedence if available
  switch (positionType?.toLowerCase()) {
    case 'artcc':
      return 'vscs'; // Center positions typically use VSCS
    case 'tracon':
      return 'stvs'; // TRACON positions might use STVS
    case 'atct':
      return 'etvs'; // Tower positions might use ETVS
    default:
      break;
  }
  
  switch (facilityType?.toLowerCase()) {
    case 'center':
      return 'vscs';
    case 'approachdeparture':
      return 'stvs';
    case 'tower':
    case 'ground':
    case 'clearance':
    case 'delivery':
      return 'etvs';
    default:
      return 'vscs'; // Default to VSCS
  }
}

/**
 * Auto-detect position and UI for a user based on their CID and callsign
 * This is the main entry point for automatic UI selection
 * 
 * @param cid - User's VATSIM CID
 * @param callsign - Current callsign from AFV WebSocket (SOURCE OF TRUTH)
 * @param positionData - Local position configuration
 */
export async function autoDetectPosition(
  cid: number | string,
  callsign: string,
  positionData: any
): Promise<{
  controller: VatsimController | null;
  position: any | null;
  ui: string;
  method: 'vatsim-match' | 'vatsim-infer' | 'fallback' | 'afv-direct';
} | null> {
  // If we don't have a valid callsign, can't auto-detect
  if (!callsign) return null;
  
  // FIRST: Try to match directly using AFV callsign (most reliable, real-time)
  const directMatch = matchControllerToPosition(null, positionData, callsign);
  
  if (directMatch) {
    // Optionally fetch VATSIM data for additional info (but don't use it for matching)
    let controller: VatsimController | null = null;
    if (cid && cid !== 0) {
      const feed = await fetchVatsimControllers();
      if (feed) {
        controller = findControllerByCid(feed, cid);
      }
    }
    
    return {
      controller,
      position: directMatch.position,
      ui: directMatch.ui,
      method: 'afv-direct',
    };
  }
  
  // FALLBACK: If no direct match, try VATSIM data
  if (!cid || cid === 0) return null;
  
  // Fetch VATSIM controller data
  const feed = await fetchVatsimControllers();
  if (!feed) return null;
  
  // Find the controller by CID first (most reliable)
  let controller = findControllerByCid(feed, cid);
  
  // If not found by CID, try by callsign
  if (!controller && callsign) {
    controller = findControllerByCallsign(feed, callsign);
  }
  
  if (!controller) return null;
  
  // Check if the controller is an observer
  if (controller.isObserver) {
    return {
      controller,
      position: null,
      ui: 'vscs',
      method: 'vatsim-infer',
    };
  }
  
  // Try to match using VATSIM data but still prefer AFV callsign
  const match = matchControllerToPosition(controller, positionData, callsign);
  
  if (match) {
    return {
      controller,
      position: match.position,
      ui: match.ui,
      method: 'vatsim-match',
    };
  }
  
  // If no local position match, infer UI from VATSIM data
  const inferredUI = determineUIFromVatsim(controller);
  
  return {
    controller,
    position: null,
    ui: inferredUI,
    method: 'vatsim-infer',
  };
}
