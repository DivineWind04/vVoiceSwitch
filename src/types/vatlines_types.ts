  export interface Facility {
    facilityId: string;
    parentFacility?: Facility | null;
    childFacilities: Facility[];
    positions: Position[];
    editors: Editor[];
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date;
  }

export interface Editor {
  id: string;

  cid: number;

  facility: Facility;

  addedBy: number;

  createdAt: Date;
}

export interface Position {
  id: string;

  name: string;

  sector: string;

  facility: Facility;

  dialCode: string;

  panelType: PanelType;

  callsign: string;

  frequency: string;

  configurations: PositionConfiguration[];

  createdAt: Date;

  updatedAt: Date;

  deletedAt?: Date;
}

export enum PanelType {
  RDVS = 'RDVS',
  VSCS = 'VSCS',
  ETVS = 'ETVS',
  STVS = 'STVS',
  IVSR = 'IVSR',
}

export interface PositionConfiguration {
  id: string;

  name: string;

  positions: Position[];

  layouts: Layout[];

  createdAt: Date;

  updatedAt: Date;

  deletedAt?: Date;
}

export interface Button {
  id: string;

  shortName: string;

  longName?: string;

  target: string;

  type: ButtonType;

  dialCode?: string;

  layouts: Layout[];

  createdAt: Date;

  updatedAt: Date;

  deletedAt?: Date;
}

export interface Layout {
  order: number;
  configuration: PositionConfiguration;
  button: Button;
}

export enum ButtonType {
  SHOUT = 'SHOUT',
  OVERRIDE = 'OVERRIDE',
  RING = 'RING',
  NONE = 'NONE',
}
