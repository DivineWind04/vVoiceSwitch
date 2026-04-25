/**
 * vNAS Store
 *
 * Singleton that manages vNAS environment selection, authentication,
 * and SignalR hub connection for sweatbox/training mode.
 *
 * When in sweatbox mode:
 *   - AFV is not available (no ws://localhost:9002 connection)
 *   - Position is auto-detected from vNAS session (or manually selected as fallback)
 *   - Only landline (ll:) transport is used for G/G calls
 *   - Both student and instructor log onto the same position for mirrored UI
 *
 * Usage:
 *   import { vnasStore } from '@/lib/vnas/store';
 *   vnasStore.fetchConfig();
 *   vnasStore.selectEnvironment(env);
 *   vnasStore.loginWithVatsim(code, redirectUrl);
 */

import { fetchVnasConfig, vnasLogin } from './api';
import { VnasHubClient } from './hub';
import type { VnasHubEvent } from './hub';
import type { VnasConfig, VnasEnvironment, VnasSession, VnasSessionPosition } from './types';

// ─── localStorage Keys ──────────────────────────────────────────────────────

const LS_VNAS_VATSIM_TOKEN = 'vnas_vatsim_token';
const LS_VNAS_ENV_NAME = 'vnas_env_name';

// ─── Store State ─────────────────────────────────────────────────────────────

export interface VnasStoreState {
  /** Whether we're in sweatbox mode (vs live) */
  isSweatbox: boolean;
  /** vNAS configuration (environments list) */
  vnasConfig: VnasConfig | null;
  /** Selected vNAS environment */
  vnasEnvironment: VnasEnvironment | null;
  /** vNAS hub connection status */
  vnasHubConnected: boolean;
  /** vNAS status message for UI */
  vnasStatus: string;
  /** Current vNAS session (auto-detected position) */
  vnasSession: VnasSession | null;
  /** Last vNAS error */
  vnasError: string | null;
}

export const INITIAL_VNAS_STATE: VnasStoreState = {
  isSweatbox: false,
  vnasConfig: null,
  vnasEnvironment: null,
  vnasHubConnected: false,
  vnasStatus: 'disconnected',
  vnasSession: null,
  vnasError: null,
};

// ─── Listener ────────────────────────────────────────────────────────────────

type VnasStoreListener = (state: VnasStoreState) => void;

// ─── Store Singleton ─────────────────────────────────────────────────────────

class VnasStore {
  private state: VnasStoreState = { ...INITIAL_VNAS_STATE };
  private listeners = new Set<VnasStoreListener>();
  private hub = new VnasHubClient();
  private vatsimToken: string | null = null;
  /** VATSIM client ID for vNAS OAuth — read from env at build time or fallback */
  private clientId: string = '';
  /** Zustand store bridge (set/get) */
  private storeSet: ((partial: any) => void) | null = null;
  private storeGet: (() => any) | null = null;

  constructor() {
    // Wire up hub events
    this.hub.on((event) => this.handleHubEvent(event));

    // Restore saved token + environment
    try {
      this.vatsimToken = localStorage.getItem(LS_VNAS_VATSIM_TOKEN);
    } catch { /* SSR */ }
  }

  /** Bind to the zustand store's set/get functions */
  bindStore(set: (partial: any) => void, get: () => any): void {
    this.storeSet = set;
    this.storeGet = get;
  }

  // ─── State Management ──────────────────────────────────────────────

  getState(): VnasStoreState {
    return this.state;
  }

  /** Subscribe to state changes */
  subscribe(listener: VnasStoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(patch: Partial<VnasStoreState>): void {
    this.state = { ...this.state, ...patch };
    // Push to zustand store
    if (this.storeSet) {
      this.storeSet(patch);
    }
    for (const l of this.listeners) {
      try { l(this.state); } catch { /* ignore */ }
    }
  }

  // ─── Config ────────────────────────────────────────────────────────

  /** Fetch vNAS environments from the config API */
  async fetchConfig(): Promise<VnasConfig | null> {
    try {
      const config = await fetchVnasConfig();
      this.setState({ vnasConfig: config });

      // Auto-select saved environment if available
      const savedEnvName = this.getSavedEnvName();
      if (savedEnvName && config.environments) {
        const savedEnv = config.environments.find(
          (e) => e.name === savedEnvName && !e.isDisabled,
        );
        if (savedEnv) {
          this.selectEnvironment(savedEnv);
        }
      }

      return config;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch vNAS config';
      console.error('[vNAS Store]', msg);
      this.setState({ vnasError: msg });
      return null;
    }
  }

  // ─── Environment Selection ─────────────────────────────────────────

  /** Select a vNAS environment (live or sweatbox) */
  selectEnvironment(env: VnasEnvironment | null): void {
    this.setState({
      vnasEnvironment: env,
      isSweatbox: env?.isSweatbox ?? false,
      vnasError: null,
    });

    try {
      if (env) {
        localStorage.setItem(LS_VNAS_ENV_NAME, env.name);
      } else {
        localStorage.removeItem(LS_VNAS_ENV_NAME);
      }
    } catch { /* SSR */ }
  }

  /** Enable sweatbox mode directly (without vNAS environment/OAuth) */
  enableSweatboxMode(): void {
    this.setState({ isSweatbox: true, vnasStatus: 'sweatbox (standalone)' });
  }

  /** Disable sweatbox mode */
  disableSweatboxMode(): void {
    this.setState({ isSweatbox: false, vnasStatus: 'disconnected' });
  }

  private getSavedEnvName(): string | null {
    try {
      return localStorage.getItem(LS_VNAS_ENV_NAME);
    } catch {
      return null;
    }
  }

  // ─── Auth ──────────────────────────────────────────────────────────

  /** Set the VATSIM client ID (called from settings or env) */
  setClientId(id: string): void {
    this.clientId = id;
  }

  /**
   * Build the VATSIM OAuth URL for vNAS login.
   * The user opens this in a popup, and after authorization
   * we receive the code via the callback route.
   */
  getVatsimAuthUrl(redirectUrl: string): string | null {
    if (!this.clientId) {
      this.setState({ vnasError: 'No VATSIM client ID configured' });
      return null;
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUrl,
      response_type: 'code',
      scope: 'full_name vatsim_details',
    });

    return `https://auth.vatsim.net/oauth/authorize?${params.toString()}`;
  }

  /**
   * Complete login with a VATSIM OAuth code.
   * Exchanges code for nasToken + vatsimToken via the selected environment's API.
   */
  async loginWithCode(code: string, redirectUrl: string): Promise<boolean> {
    const env = this.state.vnasEnvironment;
    if (!env) {
      this.setState({ vnasError: 'No vNAS environment selected' });
      return false;
    }

    this.setState({ vnasStatus: 'authenticating...', vnasError: null });

    try {
      const result = await vnasLogin(env.apiBaseUrl, code, redirectUrl, this.clientId);
      if (!result.ok) {
        throw new Error(`Login failed: ${result.statusText}`);
      }

      this.vatsimToken = result.vatsimToken;
      this.persistToken(result.vatsimToken);
      this.setState({ vnasStatus: 'authenticated' });

      // Auto-connect hub after login
      await this.connectHub();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      console.error('[vNAS Store] Login error:', msg);
      this.setState({ vnasStatus: 'auth failed', vnasError: msg });
      return false;
    }
  }

  /**
   * Login with a saved or manually-provided VATSIM token (skip OAuth code exchange).
   */
  async loginWithToken(vatsimToken: string): Promise<boolean> {
    this.vatsimToken = vatsimToken;
    this.persistToken(vatsimToken);
    this.setState({ vnasStatus: 'authenticated', vnasError: null });

    try {
      await this.connectHub();
      return true;
    } catch {
      return false;
    }
  }

  /** Whether we have a saved vatsim token and could auto-connect */
  get hasSavedToken(): boolean {
    return !!this.vatsimToken;
  }

  private persistToken(token: string): void {
    try {
      localStorage.setItem(LS_VNAS_VATSIM_TOKEN, token);
    } catch { /* SSR */ }
  }

  private clearToken(): void {
    this.vatsimToken = null;
    try {
      localStorage.removeItem(LS_VNAS_VATSIM_TOKEN);
    } catch { /* SSR */ }
  }

  // ─── Hub Connection ────────────────────────────────────────────────

  /** Connect to the vNAS SignalR hub */
  async connectHub(): Promise<void> {
    const env = this.state.vnasEnvironment;
    if (!env) {
      this.setState({ vnasError: 'No environment selected' });
      return;
    }
    if (!this.vatsimToken) {
      this.setState({ vnasError: 'Not authenticated — login first' });
      return;
    }

    this.setState({ vnasStatus: 'connecting hub...', vnasError: null });

    try {
      await this.hub.connect(env, this.vatsimToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Hub connection failed';
      this.setState({ vnasStatus: 'hub failed', vnasError: msg });
    }
  }

  /** Disconnect from the vNAS hub */
  async disconnectHub(): Promise<void> {
    await this.hub.disconnect();
    this.setState({
      vnasHubConnected: false,
      vnasStatus: 'disconnected',
      vnasSession: null,
    });
  }

  /** Full logout: disconnect hub, clear tokens */
  async logout(): Promise<void> {
    await this.disconnectHub();
    this.clearToken();
    this.setState({
      ...INITIAL_VNAS_STATE,
      vnasConfig: this.state.vnasConfig, // Keep config
      vnasEnvironment: this.state.vnasEnvironment, // Keep env selection
      isSweatbox: this.state.vnasEnvironment?.isSweatbox ?? false,
    });
  }

  // ─── Hub Event Handler ─────────────────────────────────────────────

  private handleHubEvent(event: VnasHubEvent): void {
    switch (event.type) {
      case 'connected':
        this.setState({ vnasHubConnected: true, vnasStatus: 'hub connected' });
        break;

      case 'disconnected':
        this.setState({
          vnasHubConnected: false,
          vnasStatus: 'hub disconnected',
          vnasSession: null,
        });
        break;

      case 'sessionDetected':
        this.setState({ vnasSession: event.session });
        break;

      case 'sessionEnded':
        this.setState({ vnasSession: null });
        break;

      case 'error':
        this.setState({ vnasError: event.message });
        break;
    }
  }

  // ─── Position Resolution ───────────────────────────────────────────

  /**
   * Extract the primary position callsign and artccId from the current session.
   * Returns null if no session or no primary position detected.
   */
  getDetectedPosition(): { callsign: string; artccId: string; facilityId: string; name: string } | null {
    const session = this.state.vnasSession;
    if (!session) return null;

    const primaryPos = session.positions.find((p) => p.isPrimary);
    if (!primaryPos) return null;

    return {
      callsign: primaryPos.position.callsign,
      artccId: session.artccId,
      facilityId: primaryPos.facilityId,
      name: primaryPos.position.name,
    };
  }

  /** Destroy all resources */
  destroy(): void {
    this.hub.destroy();
    this.listeners.clear();
  }
}

// ─── Export Singleton ────────────────────────────────────────────────────────

export const vnasStore = new VnasStore();
