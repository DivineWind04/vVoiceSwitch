/**
 * Facility Loader - Loads and merges multiple ARTCC position files
 * 
 * Supports: ZOA, ZLC, ZSE, ZLA, ZDV, and any other facility JSON files
 * placed in the /public directory following the naming pattern: {facility}_position.json
 */

import { Facility } from '../model';

// List of supported facilities - all 24 ARTCCs
export const SUPPORTED_FACILITIES = [
  'zab',
  'zan',
  'zau',
  'zbw',
  'zdc',
  'zdv',
  'zfw',
  'zhn',
  'zhu',
  'zid',
  'zjx',
  'zkc',
  'zla',
  'zlc',
  'zma',
  'zme',
  'zmp',
  'zny',
  'zoa',
  'zob',
  'zse',
  'zsu',
  'ztl',
  'zua',
] as const;

export type FacilityCode = typeof SUPPORTED_FACILITIES[number];

interface LoadResult {
  facility: string;
  data: any;
  error?: string;
}

/**
 * Load a single facility's position data
 */
export async function loadFacility(facilityCode: string): Promise<LoadResult> {
  try {
    const response = await fetch(`/${facilityCode}_position.json`);
    if (!response.ok) {
      return { facility: facilityCode, data: null, error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    return { facility: facilityCode, data };
  } catch (error) {
    return { facility: facilityCode, data: null, error: String(error) };
  }
}

/**
 * Load all available facility position files and merge them
 * Returns a unified data structure with all facilities
 */
export async function loadAllFacilities(): Promise<{
  merged: Facility;
  loaded: string[];
  failed: string[];
}> {
  const results = await Promise.all(
    SUPPORTED_FACILITIES.map(code => loadFacility(code))
  );

  const loaded: string[] = [];
  const failed: string[] = [];
  
  // Create a root facility that contains all ARTCCs
  const merged: Facility = {
    id: 'root',
    name: 'All Facilities',
    positions: [],
    childFacilities: [],
  };

  for (const result of results) {
    if (result.data) {
      loaded.push(result.facility.toUpperCase());
      
      // Handle different JSON structures:
      // 1. Flat structure (positions at root): wrap in a facility object
      // 2. Facility structure (has childFacilities): use as-is
      
      if (result.data.positions && !result.data.childFacilities) {
        // Flat structure - wrap it
        const facilityWrapper: Facility = {
          id: result.facility.toUpperCase(),
          name: result.facility.toUpperCase(),
          positions: result.data.positions || [],
          childFacilities: [],
          dialCodeTable: result.data.dialCodeTable,
        };
        merged.childFacilities.push(facilityWrapper);
      } else if (result.data.childFacilities) {
        // Already a proper facility structure
        merged.childFacilities.push(result.data);
      } else if (result.data.id) {
        // Single facility object
        merged.childFacilities.push(result.data);
      }
    } else {
      // Only log as failed if it's not just a missing file
      if (result.error && !result.error.includes('404')) {
        failed.push(result.facility.toUpperCase());
        console.warn(`Failed to load ${result.facility}_position.json:`, result.error);
      }
    }
  }

  console.log(`Loaded facilities: ${loaded.join(', ') || 'none'}`);
  if (failed.length > 0) {
    console.warn(`Failed to load: ${failed.join(', ')}`);
  }

  return { merged, loaded, failed };
}

/**
 * Find a position by callsign across all loaded facilities
 */
export function findPositionByCallsign(data: Facility, callsign: string): {
  position: any;
  facility: Facility | null;
} | null {
  // Search recursively through facility tree
  function search(facility: Facility): { position: any; facility: Facility } | null {
    // Check positions at this level
    if (facility.positions) {
      for (const pos of facility.positions) {
        if (pos.cs === callsign) {
          return { position: pos, facility };
        }
      }
    }
    
    // Search child facilities
    if (facility.childFacilities) {
      for (const child of facility.childFacilities) {
        const result = search(child);
        if (result) return result;
      }
    }
    
    return null;
  }
  
  return search(data);
}

/**
 * Get all positions from merged facility data (flattened list)
 */
export function getAllPositions(data: Facility): any[] {
  const positions: any[] = [];
  
  function collect(facility: Facility) {
    if (facility.positions) {
      positions.push(...facility.positions);
    }
    if (facility.childFacilities) {
      for (const child of facility.childFacilities) {
        collect(child);
      }
    }
  }
  
  collect(data);
  return positions;
}

/**
 * Get the facility code from a callsign (e.g., "OAK_10_CTR" -> "ZOA")
 * This is a simple heuristic - you may need to customize this mapping
 */
export function getFacilityFromCallsign(callsign: string): string | null {
  const prefix = callsign.split('_')[0]?.toUpperCase();
  if (!prefix) return null;
  
  // Map common prefixes to facilities
  const prefixMap: Record<string, string> = {
    // ZOA
    'OAK': 'ZOA', 'SFO': 'ZOA', 'SJC': 'ZOA', 'RNO': 'ZOA', 'SMF': 'ZOA',
    'FAT': 'ZOA', 'MRY': 'ZOA', 'MOD': 'ZOA', 'SCK': 'ZOA',
    // ZLC
    'SLC': 'ZLC', 'BOI': 'ZLC', 'BIL': 'ZLC', 'GTF': 'ZLC',
    // ZSE  
    'SEA': 'ZSE', 'PDX': 'ZSE', 'GEG': 'ZSE',
    // ZLA
    'LAX': 'ZLA', 'SAN': 'ZLA', 'ONT': 'ZLA', 'BUR': 'ZLA', 'LGB': 'ZLA',
    'SNA': 'ZLA', 'VNY': 'ZLA', 'PSP': 'ZLA', 'LAS': 'ZLA',
    // ZDV
    'DEN': 'ZDV', 'COS': 'ZDV', 'ABQ': 'ZDV', 'APA': 'ZDV',
    // ZME
    'MEM': 'ZME', 'BNA': 'ZME', 'LIT': 'ZME', 'HSV': 'ZME', 'JAN': 'ZME',
    'NQA': 'ZME', 'OLV': 'ZME', 'XNA': 'ZME', 'FSM': 'ZME', 'CBM': 'ZME',
    'GTR': 'ZME', 'TUP': 'ZME', 'HOP': 'ZME', 'PAH': 'ZME', 'CGI': 'ZME',
    // ZSU
    'SJU': 'ZSU', 'BQN': 'ZSU', 'PSE': 'ZSU', 'STT': 'ZSU', 'STX': 'ZSU',
    'SIG': 'ZSU', 'NRR': 'ZSU', 'VQS': 'ZSU',
    // ZTL - Atlanta
    'ATL': 'ZTL', 'CLT': 'ZTL', 'BHM': 'ZTL', 'GSP': 'ZTL', 'TYS': 'ZTL',
    'CHA': 'ZTL', 'AGS': 'ZTL', 'SAV': 'ZTL', 'CAE': 'ZTL', 'MCN': 'ZTL',
    'CSG': 'ZTL', 'MGM': 'ZTL', 'MOB': 'ZTL', 'GPT': 'ZTL', 'DHN': 'ZTL',
    // ZAB - Albuquerque
    'ABQ': 'ZAB', 'TUS': 'ZAB', 'PHX': 'ZAB', 'ELP': 'ZAB', 'ROW': 'ZAB',
    'AMA': 'ZAB', 'LBB': 'ZAB', 'MAF': 'ZAB', 'SAF': 'ZAB', 'FLG': 'ZAB',
    'PRC': 'ZAB', 'DVT': 'ZAB', 'GUP': 'ZAB', 'FMN': 'ZAB',
    // ZJX - Jacksonville
    'JAX': 'ZJX', 'TPA': 'ZJX', 'MCO': 'ZJX', 'DAB': 'ZJX', 'GNV': 'ZJX',
    'TLH': 'ZJX', 'PNS': 'ZJX', 'VPS': 'ZJX', 'ECP': 'ZJX', 'MLB': 'ZJX',
    'SFB': 'ZJX', 'ORL': 'ZJX', 'PIE': 'ZJX', 'SRQ': 'ZJX', 'RSW': 'ZJX',
    // ZMA - Miami
    'MIA': 'ZMA', 'FLL': 'ZMA', 'PBI': 'ZMA', 'EYW': 'ZMA', 'FXE': 'ZMA',
    'TMB': 'ZMA', 'OPF': 'ZMA', 'BCT': 'ZMA', 'APF': 'ZMA', 'MKY': 'ZMA',
    // ZMP - Minneapolis
    'MSP': 'ZMP', 'FAR': 'ZMP', 'FSD': 'ZMP', 'DLH': 'ZMP', 'RST': 'ZMP',
    'ICT': 'ZMP', 'MCI': 'ZMP', 'OMA': 'ZMP', 'DSM': 'ZMP', 'SUX': 'ZMP',
    'BIS': 'ZMP', 'RAP': 'ZMP', 'GFK': 'ZMP', 'MOT': 'ZMP',
    // ZOB - Cleveland
    'CLE': 'ZOB', 'PIT': 'ZOB', 'CMH': 'ZOB', 'CVG': 'ZOB', 'DAY': 'ZOB',
    'CAK': 'ZOB', 'YNG': 'ZOB', 'TOL': 'ZOB', 'ERI': 'ZOB', 'FWA': 'ZOB',
    'SBN': 'ZOB', 'LAN': 'ZOB', 'GRR': 'ZOB', 'AZO': 'ZOB', 'BTL': 'ZOB',
    // ZNY - New York
    'JFK': 'ZNY', 'LGA': 'ZNY', 'EWR': 'ZNY', 'ISP': 'ZNY', 'HPN': 'ZNY',
    'SWF': 'ZNY', 'TTN': 'ZNY', 'PHL': 'ZNY', 'ACY': 'ZNY', 'ABE': 'ZNY',
    'AVP': 'ZNY', 'BGM': 'ZNY', 'ELM': 'ZNY', 'ITH': 'ZNY', 'SYR': 'ZNY',
    'ROC': 'ZNY', 'BUF': 'ZNY', 'FRG': 'ZNY', 'TEB': 'ZNY', 'MMU': 'ZNY',
  };
  
  return prefixMap[prefix] || null;
}
