/**
 * VACS Auth: Exchange VATSIM access token for WS token
 *
 * New simplified flow (vatsim-token-auth branch):
 *   1. POST /auth/vatsim/token with Authorization: Bearer <VATSIM_ACCESS_TOKEN>
 *      → { cid, token: VACS_API_TOKEN }
 *   2. GET /ws/token with Authorization: Bearer <VACS_API_TOKEN>
 *      → { token: WS_TOKEN }
 *
 * This replaces the old OAuth redirect + session cookie flow entirely.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vatsimToken, env } = body;

    if (!vatsimToken) {
      return NextResponse.json(
        { error: 'Missing vatsimToken' },
        { status: 400 },
      );
    }

    const baseUrl = env === 'prod' ? 'https://vacs.network' : 'https://dev.vacs.network';

    // ── Step 1: Exchange VATSIM access token for VACS API token ─────────

    console.log('[VACS Token Auth] Exchanging VATSIM token with', baseUrl);
    const authRes = await fetch(`${baseUrl}/auth/vatsim/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vatsimToken}`,
        'Accept': 'application/json',
      },
    });

    if (!authRes.ok) {
      const errorText = await authRes.text();
      console.error('[VACS Token Auth] Auth failed:', authRes.status, errorText);
      return NextResponse.json(
        { error: `VACS auth failed (${authRes.status}): ${errorText}` },
        { status: authRes.status },
      );
    }

    const authData = await authRes.json() as { cid?: string; token?: string };
    if (!authData.token) {
      console.error('[VACS Token Auth] No API token returned:', JSON.stringify(authData));
      return NextResponse.json(
        { error: 'VACS server did not return an API token' },
        { status: 502 },
      );
    }

    console.log('[VACS Token Auth] Got VACS API token for CID:', authData.cid);

    // ── Step 2: Use VACS API token to get WebSocket token ───────────────

    const wsRes = await fetch(`${baseUrl}/ws/token`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.token}`,
        'Accept': 'application/json',
      },
    });

    if (!wsRes.ok) {
      const errorText = await wsRes.text();
      console.error('[VACS Token Auth] WS token fetch failed:', wsRes.status, errorText);
      return NextResponse.json(
        { error: `WS token fetch failed (${wsRes.status}): ${errorText}` },
        { status: wsRes.status },
      );
    }

    const wsData = await wsRes.json() as { token?: string };
    if (!wsData.token) {
      console.error('[VACS Token Auth] No WS token returned:', JSON.stringify(wsData));
      return NextResponse.json(
        { error: 'VACS server did not return a WS token' },
        { status: 502 },
      );
    }

    console.log('[VACS Token Auth] Success — WS token obtained for CID:', authData.cid);
    return NextResponse.json({
      token: wsData.token,
      cid: authData.cid,
    });
  } catch (error) {
    console.error('[VACS Token Auth] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
