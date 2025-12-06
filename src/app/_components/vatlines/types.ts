// Button type for VSCS UI
export interface Button {
  id: string;
  label: string;
  type: ButtonType | string;
  shortName?: string;
  longName?: string;
  target?: string;
  [key: string]: any;
}
export enum CALL_TYPE {
  NONE = 'NONE',
  OVERRIDE = 'OVERRIDE',
  RING = 'RING',
  SHOUT = 'SHOUT',
}

export interface Configuration {
  id: string;
  name: string;
  layouts: any[];
}

export interface ActiveLandline {
  id: string;
  name: string;
  target?: string;
  type?: ButtonType | string;
  from?: string;
  // Add more fields as needed
}

export interface IncomingLandline {
  id: string;
  name: string;
  target?: string;
  type?: ButtonType | string;
  from?: string;
  // Add more fields as needed
}
// Shared types and enums for vatlines UI

export enum ButtonType {
  NONE = 'NONE',
  OVERRIDE = 'OVERRIDE',
  RING = 'RING',
  SHOUT = 'SHOUT',
}
