/**
 * vNAS SignalR Hub Client
 *
 * Connects to the vNAS client hub to:
 *   1. Auto-detect the controller's position from their active session
 *   2. Listen for session start/end events
 *
 * Modeled after vFDIO's HubContext implementation.
 */

import {
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
} from '@microsoft/signalr';
import type { HubConnection } from '@microsoft/signalr';
import { vnasRefreshToken } from './api';
import type { VnasEnvironment, VnasSession } from './types';

// ─── Event Types ─────────────────────────────────────────────────────────────

export type VnasHubEvent =
  | { type: 'connected' }
  | { type: 'disconnected'; reason?: string }
  | { type: 'sessionDetected'; session: VnasSession }
  | { type: 'sessionEnded' }
  | { type: 'error'; message: string };

export type VnasHubEventHandler = (event: VnasHubEvent) => void;

// ─── Hub Client ──────────────────────────────────────────────────────────────

export class VnasHubClient {
  private connection: HubConnection | null = null;
  private handlers = new Set<VnasHubEventHandler>();
  private env: VnasEnvironment | null = null;
  private vatsimToken: string | null = null;

  get isConnected(): boolean {
    return this.connection?.state === HubConnectionState.Connected;
  }

  /** Subscribe to hub events */
  on(handler: VnasHubEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(event: VnasHubEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('[vNAS Hub] Handler error:', err);
      }
    }
  }

  /**
   * Connect to the vNAS SignalR hub.
   * @param env - The selected vNAS environment
   * @param vatsimToken - The long-lived VATSIM token for nasToken refresh
   */
  async connect(env: VnasEnvironment, vatsimToken: string): Promise<void> {
    if (this.connection) {
      await this.disconnect();
    }

    this.env = env;
    this.vatsimToken = vatsimToken;

    const getValidNasToken = async (): Promise<string> => {
      return vnasRefreshToken(env.apiBaseUrl, vatsimToken);
    };

    this.connection = new HubConnectionBuilder()
      .withUrl(env.clientHubUrl, {
        accessTokenFactory: getValidNasToken,
        transport: HttpTransportType.WebSockets,
        skipNegotiation: true,
      })
      .withAutomaticReconnect()
      .build();

    // Wire up events
    this.connection.onclose((err) => {
      console.log('[vNAS Hub] Connection closed:', err?.message);
      this.emit({ type: 'disconnected', reason: err?.message });
    });

    this.connection.onreconnecting((err) => {
      console.log('[vNAS Hub] Reconnecting:', err?.message);
    });

    this.connection.onreconnected(() => {
      console.log('[vNAS Hub] Reconnected');
      this.emit({ type: 'connected' });
      // Re-check sessions after reconnect
      void this.getSessions();
    });

    // Session lifecycle events from the hub
    this.connection.on('HandleSessionStarted', (sessionInfo: VnasSession) => {
      console.log('[vNAS Hub] Session started:', sessionInfo);
      if (sessionInfo && !sessionInfo.isPseudoController) {
        this.emit({ type: 'sessionDetected', session: sessionInfo });
      }
    });

    this.connection.on('HandleSessionEnded', () => {
      console.log('[vNAS Hub] Session ended');
      this.emit({ type: 'sessionEnded' });
    });

    this.connection.keepAliveIntervalInMilliseconds = 1000;

    // Start connection
    try {
      await this.connection.start();
      console.log('[vNAS Hub] Connected to', env.clientHubUrl);
      this.emit({ type: 'connected' });

      // Immediately check for existing sessions
      await this.getSessions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown connection error';
      console.error('[vNAS Hub] Connection failed:', msg);
      this.emit({ type: 'error', message: msg });
      throw err;
    }
  }

  /** Query existing sessions and emit if a primary one is found */
  async getSessions(): Promise<VnasSession | null> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      return null;
    }

    try {
      const sessions = await this.connection.invoke<VnasSession[]>('GetSessions');
      console.log('[vNAS Hub] GetSessions result:', sessions);

      const primarySession = sessions?.find((s) => !s.isPseudoController);
      if (primarySession) {
        const primaryPos = primarySession.positions.find((p) => p.isPrimary)?.position;
        if (primaryPos) {
          console.log('[vNAS Hub] Found primary position:', primaryPos.callsign, primaryPos.name);
          this.emit({ type: 'sessionDetected', session: primarySession });
          return primarySession;
        }
      }

      console.log('[vNAS Hub] No active primary session found, waiting for HandleSessionStarted');
      return null;
    } catch (err) {
      console.log('[vNAS Hub] GetSessions error (may not have active session):', err);
      return null;
    }
  }

  /** Disconnect from the hub */
  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch (err) {
        console.warn('[vNAS Hub] Error stopping connection:', err);
      }
      this.connection = null;
    }
    this.env = null;
    this.vatsimToken = null;
  }

  /** Clean up all resources */
  destroy(): void {
    void this.disconnect();
    this.handlers.clear();
  }
}
