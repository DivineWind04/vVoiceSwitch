/**
 * VACS Auth: Exchange OAuth2 code for session
 *
 * Proxies the VACS server's /auth/vatsim/exchange endpoint.
 * After the user authenticates with VATSIM Connect, the callback provides
 * a code and state which we exchange for a VACS server session.
 *
 * Flow:
 *   1. VATSIM Connect redirects back with ?code=...&state=...
 *   2. Client calls POST /api/vacs/auth/callback with { code, state }
 *   3. We call VACS server's POST /auth/vatsim/exchange
 *   4. Store the session cookie and return success
 */

import { NextRequest, NextResponse } from 'next/server';

const VACS_BASE_URL = process.env.VACS_BASE_URL || 'https://dev.vacs.network';

// Store session cookies in memory per user (simple approach for dev)
// In production, you'd use a proper session store
const sessionStore = new Map<string, string>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, state } = body;

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing code or state parameter' },
        { status: 400 },
      );
    }

    // Forward the cookies from the login step
    const cookieHeader = request.headers.get('cookie') || '';

    const response = await fetch(`${VACS_BASE_URL}/auth/vatsim/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': cookieHeader,
      },
      body: JSON.stringify({ code, state }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[VACS Auth] Exchange failed:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to exchange auth token', details: errorText },
        { status: response.status },
      );
    }

    // Store the session cookie from VACS server
    const setCookie = response.headers.get('set-cookie');
    const data = await response.json().catch(() => ({}));

    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    if (setCookie) {
      // Store for later use in token fetch
      const sessionId = `vacs_session_${Date.now()}`;
      sessionStore.set(sessionId, setCookie);
      // Set our own cookie to track the VACS session
      headers.append('Set-Cookie', `vacs_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`);
      // Also forward the original VACS cookie
      headers.append('Set-Cookie', setCookie);
    }

    return new NextResponse(JSON.stringify({ success: true, ...data }), { headers });
  } catch (error) {
    console.error('[VACS Auth] Error exchanging token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
