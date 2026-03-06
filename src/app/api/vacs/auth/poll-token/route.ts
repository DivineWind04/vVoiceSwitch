/**
 * VACS Auth: Poll for WS token
 *
 * After the user authorizes on VATSIM, the VACS server may have authenticated
 * the session (cookie) we obtained during login. This endpoint polls
 * VACS /ws/token using our stored session cookie.
 *
 * Returns { token } if the session is authenticated, or { ready: false } if not.
 *
 * This handles the case where:
 *   1. We called /auth/vatsim and got a session cookie + auth URL with state=X
 *   2. User authorized on VATSIM → redirect to vacs:// with code+state
 *   3. VACS desktop app (or browser) processes the callback
 *   4. VACS server may have authenticated our session based on the state
 */

import { NextRequest, NextResponse } from 'next/server';
import { vacsSessionStore } from '../_session';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const session = vacsSessionStore.get(sessionId);
    if (!session) {
      return NextResponse.json({ ready: false, error: 'Session expired' });
    }

    const { cookie, baseUrl } = session;

    // Try to get a WS token — this only works if the session is authenticated
    const tokenRes = await fetch(`${baseUrl}/ws/token`, {
      headers: {
        'Accept': 'application/json',
        'Cookie': cookie,
      },
    });

    if (!tokenRes.ok) {
      // Session not authenticated yet — expected during polling
      return NextResponse.json({ ready: false });
    }

    const data = await tokenRes.json() as { token?: string };
    if (!data.token) {
      return NextResponse.json({ ready: false });
    }

    // Success! Session was authenticated. Clean up and return token.
    console.log('[VACS Poll] Token obtained for session', sessionId.substring(0, 8));
    vacsSessionStore.delete(sessionId);
    return NextResponse.json({ ready: true, token: data.token });
  } catch (error) {
    console.error('[VACS Poll] Error:', error);
    return NextResponse.json({ ready: false });
  }
}
