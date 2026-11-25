export interface NgPositionRef {
  facilityId: string;
  positionId: string;
}

export interface NgPosition extends NgPositionRef {
  facilityName: string;
  artccId: string;
  positionName: string;
  systemType: string | null;
  occupied: boolean;
  occupiedByCid?: string;
  profiles: { profileId: string; profileName: string }[];
}

export interface NgCall {
  callId: string;
  kind: string;
  state: string;
  incoming: boolean;
  dialNumber: string;
  canRelease: boolean;
  peer: { callsign: string; positionName: string } | null;
}

export interface NgButton {
  elementType: 'GG' | 'FUNC' | 'EMPTY';
  x: number;
  y: number;
  lineType: string | null;
  dialNumber: string;
  text: string;
  func: string | null;
  disabled: boolean;
  state: string;
  tx: boolean;
  rx: boolean;
  callId: string | null;
  calls: NgCall[];
}

export interface NgPositions {
  type: 'positions';
  artccId: string;
  positions: NgPosition[];
  suggestedMain: NgPositionRef | null;
  suggestedAssumed: NgPositionRef[];
}

export interface NgResult {
  type: 'result';
  reqId: string | number;
  ok: boolean;
  callId?: string;
  error?: { code: string; message: string };
}

export interface NgState {
  type: 'll_state';
  afv: { connected: boolean; cid: string | null; callsign: string | null };
  server: 'connected' | 'connecting' | 'disconnected';
  session: { mainPosition: NgPositionRef; positions: NgPosition[] } | null;
  sessionEnd: { reason: string; error?: { message: string } | null } | null;
  selectedProfileId: string | null;
  buttons: NgButton[];
  ia: NgCall[];
}

export interface NgChannel {
  freq: number;
  tx: boolean;
  rx: boolean;
  headset: boolean;
  rxActive: boolean;
  name: string;
}

export function ngButtonId(button: Pick<NgButton, 'x' | 'y'>): string {
  return `button-${button.x}:${button.y}`;
}

export function ngIaDialNumber(value: unknown, type: unknown): string | null {
  const number = String(value ?? '');
  if (/^\d{4}$/.test(number)) return number;
  if (/^\d{3}$/.test(number) && (type === 0 || type === 1 || type === 2)) return `${type}${number}`;
  return null;
}

export function ngButtonStatus(state: string): string {
  switch (state) {
    case 'ringing_in': return 'chime';
    case 'setup_out':
    case 'ringing_out': return 'ringing';
    case 'held': return 'hold';
    case 'overridden': return 'overridden';
    case 'connected':
    case 'conference':
    case 'override_out':
    case 'broadcast_out': return 'ok';
    case 'broadcast_in':
    case 'conference_other': return 'online';
    case 'disabled':
    case 'denied': return state;
    default: return 'idle';
  }
}

export function ngButtonsToLegacy(buttons: NgButton[], columns?: number) {
  const mapped = buttons.map(button => {
    if (button.elementType === 'EMPTY') return { isPlaceholder: true };
    const lineType = button.lineType === 'OVERRIDE' ? 0 : button.lineType === 'SHOUT' ? 2 : 1;
    return {
      call: `${lineType === 2 ? 'SO' : 'DL'}_${ngButtonId(button)}`,
      call_name: button.text || button.func || button.dialNumber,
      lineType,
      status: button.state === 'idle' && lineType !== 2 ? 'off' : ngButtonStatus(button.state),
      ngButton: button,
      disabled: button.disabled,
    };
  });
  if (!columns) return mapped;
  const layout: typeof mapped = [];
  buttons.forEach((button, index) => {
    if (button.x >= 0 && button.x < columns && button.y >= 0) {
      layout[button.y * columns + button.x] = mapped[index]!;
    }
  });
  return Array.from({ length: layout.length }, (_, index) => layout[index] || { isPlaceholder: true });
}

export function ngChannelsToLegacy(channels: NgChannel[]) {
  return channels.map(channel => ({
    call: 'A/G', freq: channel.freq, t: channel.tx, r: channel.rx,
    h: channel.headset, talking: channel.rxActive, name: channel.name,
  }));
}