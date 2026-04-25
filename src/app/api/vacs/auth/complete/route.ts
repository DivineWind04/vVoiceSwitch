/**
 * VACS Auth: Complete OAuth flow — exchange code → get WS token
 *
 * Single endpoint that finishes the entire OAuth flow server-side:
 *   1. Takes { sessionId, code, state } from the client
 *   2. Uses stored session cookie to POST /auth/vatsim/exchange
 *   3. Uses the resulting session to GET /ws/token
 *   4. Returns { token } ready for WebSocket connection
 *
 * The client extracts code+state from the vacs://auth/vatsim/callback?code=...&state=...
 * URL that appears in the popup after the user authorizes on VATSIM.
 */

import { NextRequest, NextResponse } from 'next/server';
import { vacsSessionStore } from '../_session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, code, state } = body;

    if (!sessionId || !code || !state) {
      return NextResponse.json(
        { error: 'Missing sessionId, code, or state' },
        { status: 400 },
      );
    }

    // Retrieve the stored session from the login step
    const session = vacsSessionStore.get(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session expired or invalid. Please start the login flow again.' },
        { status: 400 },
      );
    }

    const { cookie, baseUrl } = session;
    console.log('[VACS Auth Complete] Session found — cookie length:', cookie.length, '- baseUrl:', baseUrl);
    if (!cookie) {
      console.error('[VACS Auth Complete] WARNING: stored cookie is empty!');
    }

    // ── Step 1: Exchange the OAuth code for a VACS session ──────────────

    console.log('[VACS Auth Complete] Exchanging code with', baseUrl, '- code:', code.substring(0, 10) + '...', '- state:', state.substring(0, 10) + '...');
    const exchangeRes = await fetch(`${baseUrl}/auth/vatsim/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': cookie,
      },
      body: JSON.stringify({ code, state }),
    });

    if (!exchangeRes.ok) {
      const errorText = await exchangeRes.text();
      console.error('[VACS Auth Complete] Exchange failed:', exchangeRes.status, errorText);
      vacsSessionStore.delete(sessionId);
      return NextResponse.json(
        { error: `Exchange failed (${exchangeRes.status}): ${errorText}` },
        { status: exchangeRes.status },
      );
    }

    // The exchange step may set new/updated cookies
    let exchangeCookies: string;
    try {
      const cookies = (exchangeRes.headers as any).getSetCookie?.() as string[] | undefined;
      exchangeCookies = cookies?.join('; ') || exchangeRes.headers.get('set-cookie') || '';
    } catch {
      exchangeCookies = exchangeRes.headers.get('set-cookie') || '';
    }
    const sessionCookie = exchangeCookies || cookie;
    console.log('[VACS Auth Complete] Exchange success — new cookie:', exchangeCookies ? 'yes' : 'no (using original)');

    // ── Step 2: Fetch the WebSocket token using the authenticated session ─

    console.log('[VACS Auth Complete] Fetching WS token');
    const tokenRes = await fetch(`${baseUrl}/ws/token`, {
      headers: {
        'Accept': 'application/json',
        'Cookie': sessionCookie,
      },
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('[VACS Auth Complete] Token fetch failed:', tokenRes.status, errorText);
      vacsSessionStore.delete(sessionId);
      return NextResponse.json(
        { error: `Token fetch failed (${tokenRes.status}): ${errorText}` },
        { status: tokenRes.status },
      );
    }

    const tokenData = await tokenRes.json() as { token?: string };

    // Clean up the session — it's no longer needed
    vacsSessionStore.delete(sessionId);

    if (!tokenData.token) {
      return NextResponse.json(
        { error: 'VACS server did not return a token' },
        { status: 502 },
      );
    }

    console.log('[VACS Auth Complete] Success — token obtained');
    return NextResponse.json({ token: tokenData.token });
  } catch (error) {
    console.error('[VACS Auth Complete] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
