/**
 * VACS Auth: Initiate VATSIM Connect OAuth2 Login
 *
 * Proxies the VACS server's /auth/vatsim endpoint.
 * Returns { url, sessionId } — the sessionId tracks the VACS session cookie
 * server-side so we can exchange the code later without browser cookie issues.
 *
 * Flow:
 *   1. Client calls GET /api/vacs/auth/login?env=prod|dev
 *   2. We call VACS server's GET /auth/vatsim (capturing session cookie)
 *   3. Return the OAuth2 authorization URL + server-side sessionId
 *   4. Client opens the URL in a popup
 */

import { NextRequest, NextResponse } from 'next/server';
import { vacsSessionStore } from '../_session';

export async function GET(request: NextRequest) {
  try {
    const env = request.nextUrl.searchParams.get('env') || 'dev';
    const baseUrl = env === 'prod' ? 'https://vacs.network' : 'https://dev.vacs.network';

    const response = await fetch(`${baseUrl}/auth/vatsim`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.error('[VACS Auth] Login init failed:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to initiate VACS login' },
        { status: response.status },
      );
    }

    const data = await response.json() as { url: string };

    // Capture the VACS session cookie for later use in the exchange step
    const setCookie = response.headers.get('set-cookie');
    const sessionId = vacsSessionStore.save(setCookie || '', baseUrl);

    return NextResponse.json({ url: data.url, sessionId });
  } catch (error) {
    console.error('[VACS Auth] Error initiating login:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
