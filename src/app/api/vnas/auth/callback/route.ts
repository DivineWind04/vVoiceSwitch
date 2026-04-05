/**
 * vNAS Auth: VATSIM Connect OAuth2 Callback
 *
 * After VATSIM authorization, this route:
 *   1. Exchanges the OAuth code for a VATSIM access token (using PKCE)
 *   2. Returns the VATSIM token to the opener window via postMessage
 *
 * The vNAS code exchange (VATSIM token → nasToken) happens client-side
 * via the vNAS API, since each environment has its own apiBaseUrl.
 */

import { NextRequest, NextResponse } from 'next/server';

const VATSIM_TOKEN_URL = 'https://auth.vatsim.net/oauth/token';
const VATSIM_CLIENT_ID = process.env.VATSIM_CLIENT_ID_VNAS || process.env.VATSIM_CLIENT_ID_PROD || '';

function getRedirectUri(request: NextRequest): string {
  const origin = request.nextUrl.origin;
  return `${origin}/api/vnas/auth/callback`;
}

// Shared PKCE store with the login route
const GLOBAL_KEY = '__vnasPkceStore' as const;
const g = globalThis as unknown as { [GLOBAL_KEY]: Map<string, { verifier: string; createdAt: number }> | undefined };
function getPkceStore() {
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map();
  }
  return g[GLOBAL_KEY];
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    const desc = request.nextUrl.searchParams.get('error_description') || error;
    return new NextResponse(renderResultPage(null, `VATSIM authorization failed: ${desc}`), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!code || !state) {
    return new NextResponse(renderResultPage(null, 'Missing code or state parameter'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const pkceStore = getPkceStore();
  const pkceEntry = pkceStore.get(state);
  if (!pkceEntry) {
    return new NextResponse(renderResultPage(null, 'Session expired or invalid state. Please try again.'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const { verifier } = pkceEntry;
  pkceStore.delete(state);

  const redirectUri = getRedirectUri(request);

  try {
    // Exchange code for VATSIM access token
    console.log('[vNAS Callback] Exchanging code for VATSIM token...');
    const tokenRes = await fetch(VATSIM_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: VATSIM_CLIENT_ID,
        redirect_uri: redirectUri,
        code,
        code_verifier: verifier,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[vNAS Callback] Token exchange failed:', tokenRes.status, errText);
      return new NextResponse(renderResultPage(null, `VATSIM token exchange failed (${tokenRes.status})`), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) {
      return new NextResponse(renderResultPage(null, 'VATSIM did not return an access token'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    console.log('[vNAS Callback] Got VATSIM access token');

    // Return the VATSIM token to the opener — the client will pass it
    // to the vNAS API for nasToken exchange
    return new NextResponse(
      renderResultPage({ vatsimToken: tokenData.access_token }, null),
      { headers: { 'Content-Type': 'text/html' } },
    );
  } catch (err) {
    console.error('[vNAS Callback] Error:', err);
    return new NextResponse(renderResultPage(null, `Internal error: ${err instanceof Error ? err.message : 'unknown'}`), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

function renderResultPage(
  result: { vatsimToken: string } | null,
  error: string | null,
): string {
  const payload = result
    ? JSON.stringify({ success: true, source: 'vnas', vatsimToken: result.vatsimToken })
    : JSON.stringify({ success: false, source: 'vnas', error });

  return `<!DOCTYPE html>
<html>
<head><title>vNAS Auth</title></head>
<body>
<p>${result ? 'Authenticated! This window will close...' : `Error: ${error}`}</p>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage(${JSON.stringify(payload)}, window.location.origin);
    }
  } catch(e) { console.error('Failed to post message:', e); }
  setTimeout(() => window.close(), ${result ? 500 : 3000});
</script>
</body>
</html>`;
}
