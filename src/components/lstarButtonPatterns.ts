// LSTAR Button Patterns - Matching reference image colors
export const lstarButtonPatterns = {
  PRIORITY: {
    bg: '#dc2626',    // Red background for priority buttons
    fg: '#ffffff',    // White text
    border: '#991b1b', // Darker red border
    fill: '#ef4444'   // Slightly lighter red fill
  },
  
  STANDARD: {
    bg: '#6b7280',    // Light blue background matching reference
    fg: '#ffffff',    // White text
    border: '#ffffff', // Blue border
    fill: '#6b7280'   // Slightly lighter blue fill
  },
  
  FREQUENCY: {
    bg: '#507d8a',    // Light blue for frequency buttons (matches reference)
    fg: '#ffffff',    // White text
    border: '#ffffff', // Blue border
    fill: '#456388'   // Blue fill
  },
  
  SYSTEM_ACTIVE: {
    bg: '#507d8a',    // Light blue for active system status (matches reference)
    fg: '#ffffff',    // White text
    border: '#456388', // Blue border
    fill: '#10b981'   // Lighter blue fill
  },
  
  SYSTEM_INACTIVE: {
    bg: '#6b7280',    // Gray for inactive system status
    fg: '#ffffff',    // White text
    border: '#4b5563', // Darker gray border
    fill: '#9ca3af'   // Lighter gray fill
  },
  
  SYSTEM_ALERT: {
    bg: '#f59e0b',    // Orange/amber for alert status
    fg: '#ffffff',    // White text
    border: '#d97706', // Darker orange border
    fill: '#fbbf24'   // Lighter orange fill
  },
  
  UTILITY: {
    bg: '#6b7280',    // Light blue for utility buttons (matches reference)
    fg: '#ffffff',    // White text
    border: '#456388', // Blue border
    fill: '#06b6d4'   // Lighter blue fill
  },
  
  CONTROL: {
    bg: '#6b7280',    // Gray for control buttons (matches bottom buttons in reference)
    fg: '#ffffff',    // White text
    border: '#4b5563', // Darker gray border
    fill: '#8b5cf6'   // Light gray fill
  },
  
  GW_ROLES: {
    bg: '#507d8a',    // Light blue for GW ROLES header (matches reference)
    fg: '#ffffff',    // White text
    border: '#ffffff', // Blue border
    fill: '#10b981'   // Light blue fill
  },
  
  DEFAULT: {
    bg: '#6b7280',    // Default light blue (matches reference theme)
    fg: '#ffffff',    // White text
    border: '#ffffff', // Blue border
    fill: '#6b7280'   // Light blue fill
  }
};

// Helper function to get button pattern based on button type
export const getLstarButtonPattern = (buttonType: string, systemStatus?: string) => {
  switch (buttonType) {
    case 'PRIORITY':
      return lstarButtonPatterns.PRIORITY;
    case 'FREQUENCY':
      return lstarButtonPatterns.FREQUENCY;
    case 'UTILITY':
      return lstarButtonPatterns.UTILITY;
    case 'CRIME':
    case 'OPS_TWO':
    case 'TEAM_PICKUP':
    case 'ROLE_SELECT':
      return lstarButtonPatterns.STANDARD;
    case 'GW_ROLES':
      return lstarButtonPatterns.GW_ROLES;
    case 'SYSTEM_STATUS':
    case 'GG_1':
      if (systemStatus === 'active') return lstarButtonPatterns.SYSTEM_ACTIVE;
      if (systemStatus === 'alert') return lstarButtonPatterns.SYSTEM_ALERT;
      return lstarButtonPatterns.SYSTEM_INACTIVE;
    case 'RADIO_OFF':
    case 'MIC_MUTE':
    case 'LS_OFF':
      return lstarButtonPatterns.CONTROL;
    default:
      return lstarButtonPatterns.DEFAULT;
  }
};