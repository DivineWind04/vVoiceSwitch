/**
 * Landline General Settings Store
 *
 * Persists PTT keybind and volume settings to localStorage.
 * Manages global PTT key state (pressed/released) and volume levels.
 * Notifies listeners on PTT state changes so the WebRTC layer
 * can mute/unmute mic tracks accordingly.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LandlineSettings {
  /** PTT 1 key code (e.g. 'ControlRight', 'KeyG', 'F1') */
  ptt1Key: string | null;
  /** PTT 1 display name */
  ptt1Label: string;
  /** PTT 2 key code (secondary / optional) */
  ptt2Key: string | null;
  /** PTT 2 display name */
  ptt2Label: string;
  /** Microphone gain 0–100 */
  micGain: number;
  /** Headset volume 0–100 */
  headsetVolume: number;
  /** Speaker volume 0–100 */
  speakerVolume: number;
}

type PttChangeListener = (pressed: boolean) => void;
type SettingsChangeListener = (settings: LandlineSettings) => void;

const STORAGE_KEY = 'landline_settings';

const DEFAULT_SETTINGS: LandlineSettings = {
  ptt1Key: null,
  ptt1Label: 'None',
  ptt2Key: null,
  ptt2Label: 'None',
  micGain: 100,
  headsetVolume: 50,
  speakerVolume: 50,
};

// ─── Singleton Store ─────────────────────────────────────────────────────────

class LandlineSettingsStore {
  private settings: LandlineSettings;
  private pttPressed = false;
  private pttListeners = new Set<PttChangeListener>();
  private settingsListeners = new Set<SettingsChangeListener>();
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
  private _settingPtt: 1 | 2 | null = null;

  constructor() {
    this.settings = this.load();
    this.installKeyListeners();
  }

  // ─── Persistence ─────────────────────────────────────────────────

  private load(): LandlineSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch { /* use defaults */ }
    return { ...DEFAULT_SETTINGS };
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch { /* ignore */ }
  }

  // ─── Getters ─────────────────────────────────────────────────────

  getSettings(): LandlineSettings {
    return { ...this.settings };
  }

  isPttPressed(): boolean {
    return this.pttPressed;
  }

  /** Whether UI is currently capturing the next key press for PTT binding */
  get isSettingPtt(): 1 | 2 | null {
    return this._settingPtt;
  }

  // ─── Update Settings ─────────────────────────────────────────────

  update(partial: Partial<LandlineSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.save();
    this.notifySettingsChange();
  }

  /** Enter "set PTT" mode — next key press becomes the new PTT key */
  startSettingPtt(slot: 1 | 2): void {
    this._settingPtt = slot;
  }

  /** Cancel PTT capture without changing the binding */
  cancelSettingPtt(): void {
    this._settingPtt = null;
  }

  clearPtt(slot: 1 | 2): void {
    if (slot === 1) {
      this.settings.ptt1Key = null;
      this.settings.ptt1Label = 'None';
    } else {
      this.settings.ptt2Key = null;
      this.settings.ptt2Label = 'None';
    }
    this.save();
    this.notifySettingsChange();
  }

  // ─── Key Listeners ───────────────────────────────────────────────

  private installKeyListeners(): void {
    if (typeof window === 'undefined') return;

    this.keydownHandler = (e: KeyboardEvent) => {
      // If we're capturing a PTT binding, assign this key
      if (this._settingPtt) {
        e.preventDefault();
        e.stopPropagation();
        const label = formatKeyLabel(e);
        if (this._settingPtt === 1) {
          this.settings.ptt1Key = e.code;
          this.settings.ptt1Label = label;
        } else {
          this.settings.ptt2Key = e.code;
          this.settings.ptt2Label = label;
        }
        this._settingPtt = null;
        this.save();
        this.notifySettingsChange();
        return;
      }

      // PTT press detection
      if (this.matchesPtt(e.code) && !this.pttPressed) {
        this.pttPressed = true;
        this.notifyPttChange(true);
      }
    };

    this.keyupHandler = (e: KeyboardEvent) => {
      if (this.matchesPtt(e.code) && this.pttPressed) {
        this.pttPressed = false;
        this.notifyPttChange(false);
      }
    };

    window.addEventListener('keydown', this.keydownHandler, { capture: true });
    window.addEventListener('keyup', this.keyupHandler, { capture: true });
  }

  private matchesPtt(code: string): boolean {
    return code === this.settings.ptt1Key || code === this.settings.ptt2Key;
  }

  // ─── Event Listeners ─────────────────────────────────────────────

  onPttChange(fn: PttChangeListener): () => void {
    this.pttListeners.add(fn);
    return () => this.pttListeners.delete(fn);
  }

  onSettingsChange(fn: SettingsChangeListener): () => void {
    this.settingsListeners.add(fn);
    return () => this.settingsListeners.delete(fn);
  }

  private notifyPttChange(pressed: boolean): void {
    this.pttListeners.forEach(fn => {
      try { fn(pressed); } catch { /* ignore */ }
    });
  }

  private notifySettingsChange(): void {
    const s = this.getSettings();
    this.settingsListeners.forEach(fn => {
      try { fn(s); } catch { /* ignore */ }
    });
  }

  destroy(): void {
    if (typeof window === 'undefined') return;
    if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler, { capture: true });
    if (this.keyupHandler) window.removeEventListener('keyup', this.keyupHandler, { capture: true });
    this.pttListeners.clear();
    this.settingsListeners.clear();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatKeyLabel(e: KeyboardEvent): string {
  // Produce a readable label like "RightCtrl", "F1", "G"
  const code = e.code;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ControlLeft') return 'LeftCtrl';
  if (code === 'ControlRight') return 'RightCtrl';
  if (code === 'ShiftLeft') return 'LeftShift';
  if (code === 'ShiftRight') return 'RightShift';
  if (code === 'AltLeft') return 'LeftAlt';
  if (code === 'AltRight') return 'RightAlt';
  if (code === 'MetaLeft') return 'LeftMeta';
  if (code === 'MetaRight') return 'RightMeta';
  if (code === 'Space') return 'Space';
  if (code === 'CapsLock') return 'CapsLock';
  if (code === 'Backquote') return '`';
  if (code === 'Tab') return 'Tab';
  // Numpad
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  return code;
}

// ─── Singleton Export ────────────────────────────────────────────────────────

export const landlineSettingsStore = new LandlineSettingsStore();
