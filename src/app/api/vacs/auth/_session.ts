/**
 * Server-side VACS session store.
 *
 * When we call VACS /auth/vatsim, the server sets a session cookie.
 * We store that cookie here keyed by a random sessionId so we can
 * replay it later during the /auth/vatsim/exchange and /ws/token steps.
 *
 * Sessions expire after 10 minutes (the OAuth flow should complete quickly).
 *
 * Uses globalThis to survive Next.js hot-module-replacement in dev mode.
 */

import { randomBytes } from 'crypto';

export interface StoredSession {
  cookie: string;
  baseUrl: string;
  createdAt: number;
}

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

class VacsSessionStore {
  private sessions: Map<string, StoredSession>;

  constructor(sessions: Map<string, StoredSession>) {
    this.sessions = sessions;
  }

  /** Save a VACS session cookie and return a sessionId */
  save(cookie: string, baseUrl: string): string {
    this.cleanup();
    const sessionId = randomBytes(16).toString('hex');
    this.sessions.set(sessionId, { cookie, baseUrl, createdAt: Date.now() });
    console.log('[VACS Session] Saved session', sessionId.substring(0, 8), '- cookie length:', cookie.length, '- total sessions:', this.sessions.size);
    return sessionId;
  }

  /** Retrieve a stored session */
  get(sessionId: string): StoredSession | null {
    this.cleanup();
    const session = this.sessions.get(sessionId) ?? null;
    console.log('[VACS Session] Get', sessionId.substring(0, 8), session ? 'FOUND' : 'NOT FOUND', '- total sessions:', this.sessions.size);
    return session;
  }

  /** Update the cookie for an existing session (after exchange sets new cookies) */
  updateCookie(sessionId: string, cookie: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cookie = cookie;
    }
  }

  /** Remove a session */
  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /** Remove expired sessions */
  private cleanup(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.createdAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }
}

/**
 * Singleton session store — survives Next.js HMR in dev.
 * In dev mode, module re-evaluation creates new Map instances,
 * losing all sessions. globalThis persists across HMR cycles.
 */
const globalKey = '__vacsSessionStore' as const;
const g = globalThis as unknown as { [globalKey]: Map<string, StoredSession> | undefined };
if (!g[globalKey]) {
  g[globalKey] = new Map<string, StoredSession>();
}
export const vacsSessionStore = new VacsSessionStore(g[globalKey]!);
