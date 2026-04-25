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

    if (!data.url) {
      console.error('[VACS Auth] No URL returned from', baseUrl, '- response:', JSON.stringify(data));
      return NextResponse.json(
        { error: `VACS ${env} server did not return an auth URL` },
        { status: 502 },
      );
    }

    console.log('[VACS Auth] Got auth URL for', env, ':', data.url.substring(0, 80) + '...');

    // Capture the VACS session cookie for later use in the exchange step
    // Use getSetCookie() (Node 18.14+) for proper multi-cookie support,
    // fall back to get('set-cookie') for older runtimes
    let rawCookies: string;
    try {
      const cookies = (response.headers as any).getSetCookie?.() as string[] | undefined;
      rawCookies = cookies?.join('; ') || response.headers.get('set-cookie') || '';
    } catch {
      rawCookies = response.headers.get('set-cookie') || '';
    }
    console.log('[VACS Auth] Captured cookie:', rawCookies ? rawCookies.substring(0, 80) + '...' : '(none)');
    if (!rawCookies) {
      console.warn('[VACS Auth] WARNING: No session cookie captured from VACS server!');
      // Dump all response headers for debugging
      const hdrs: Record<string, string> = {};
      response.headers.forEach((v, k) => { hdrs[k] = v; });
      console.warn('[VACS Auth] Response headers:', JSON.stringify(hdrs));
    }
    const sessionId = vacsSessionStore.save(rawCookies, baseUrl);

    return NextResponse.json({ url: data.url, sessionId });
  } catch (error) {
    console.error('[VACS Auth] Error initiating login:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
