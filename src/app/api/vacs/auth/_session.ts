/**
 * Server-side VACS session store.
 *
 * When we call VACS /auth/vatsim, the server sets a session cookie.
 * We store that cookie here keyed by a random sessionId so we can
 * replay it later during the /auth/vatsim/exchange and /ws/token steps.
 *
 * Sessions expire after 10 minutes (the OAuth flow should complete quickly).
 */

import { randomBytes } from 'crypto';

interface StoredSession {
  cookie: string;
  baseUrl: string;
  createdAt: number;
}

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

class VacsSessionStore {
  private sessions = new Map<string, StoredSession>();

  /** Save a VACS session cookie and return a sessionId */
  save(cookie: string, baseUrl: string): string {
    this.cleanup();
    const sessionId = randomBytes(16).toString('hex');
    this.sessions.set(sessionId, { cookie, baseUrl, createdAt: Date.now() });
    return sessionId;
  }

  /** Retrieve and optionally update a stored session */
  get(sessionId: string): StoredSession | null {
    this.cleanup();
    return this.sessions.get(sessionId) ?? null;
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

/** Singleton session store (lives in server memory) */
export const vacsSessionStore = new VacsSessionStore();
