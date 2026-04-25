/**
 * VACS Auth: VATSIM Connect OAuth2 Callback
 *
 * This is the redirect URI that VATSIM sends the user back to after authorization.
 * It:
 *   1. Receives ?code=...&state=... from VATSIM
 *   2. Exchanges the code for a VATSIM access token (using PKCE verifier)
 *   3. Uses the VATSIM access token to get a VACS WS token via /auth/vatsim/token
 *   4. Returns an HTML page that posts the token to the opener window and closes
 */

import { NextRequest, NextResponse } from 'next/server';

// VATSIM token endpoints
const VATSIM_TOKEN_URL_DEV = 'https://auth-dev.vatsim.net/oauth/token';
const VATSIM_TOKEN_URL_PROD = 'https://auth.vatsim.net/oauth/token';

// VACS endpoints
const VACS_DEV_URL = 'https://dev.vacs.network';
const VACS_PROD_URL = 'https://vacs.network';

// Client IDs (must match the login route)
const VATSIM_CLIENT_ID_DEV = process.env.VATSIM_CLIENT_ID_DEV || '1053';
const VATSIM_CLIENT_ID_PROD = process.env.VATSIM_CLIENT_ID_PROD || '';

function getRedirectUri(request: NextRequest): string {
  const origin = request.nextUrl.origin;
  return `${origin}/api/vacs/auth/vatsim-callback`;
}

/**
 * We need access to the pkceStore from the login route.
 * Since Next.js API routes are separate modules, we use globalThis to share state.
 */
const GLOBAL_PKCE_KEY = '__vacsPkceStore' as const;
const g = globalThis as unknown as { [GLOBAL_PKCE_KEY]: Map<string, { verifier: string; env: string; createdAt: number }> | undefined };
function getPkceStore() {
  if (!g[GLOBAL_PKCE_KEY]) {
    g[GLOBAL_PKCE_KEY] = new Map();
  }
  return g[GLOBAL_PKCE_KEY];
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  // Handle OAuth errors
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

  // Look up the PKCE verifier for this state
  const pkceStore = getPkceStore();
  const pkceEntry = pkceStore.get(state);
  if (!pkceEntry) {
    return new NextResponse(renderResultPage(null, 'Session expired or invalid state. Please try again.'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const { verifier, env } = pkceEntry;
  pkceStore.delete(state); // One-time use

  const isProd = env === 'prod';
  const clientId = isProd ? VATSIM_CLIENT_ID_PROD : VATSIM_CLIENT_ID_DEV;
  const tokenUrl = isProd ? VATSIM_TOKEN_URL_PROD : VATSIM_TOKEN_URL_DEV;
  const vacsBaseUrl = isProd ? VACS_PROD_URL : VACS_DEV_URL;
  const redirectUri = getRedirectUri(request);

  try {
    // ── Step 1: Exchange code for VATSIM access token ─────────────────
    console.log('[VACS Callback] Exchanging code for VATSIM token...');
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: verifier,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[VACS Callback] VATSIM token exchange failed:', tokenRes.status, errText);
      return new NextResponse(renderResultPage(null, `VATSIM token exchange failed (${tokenRes.status})`), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const tokenData = await tokenRes.json() as { access_token?: string; token_type?: string };
    if (!tokenData.access_token) {
      console.error('[VACS Callback] No access_token in response:', JSON.stringify(tokenData));
      return new NextResponse(renderResultPage(null, 'VATSIM did not return an access token'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    console.log('[VACS Callback] Got VATSIM access token');

    // ── Step 2: Exchange VATSIM token for VACS API token ──────────────
    console.log('[VACS Callback] Exchanging VATSIM token with VACS...');
    const vacsAuthRes = await fetch(`${vacsBaseUrl}/auth/vatsim/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!vacsAuthRes.ok) {
      const errText = await vacsAuthRes.text();
      console.error('[VACS Callback] VACS auth failed:', vacsAuthRes.status, errText);
      return new NextResponse(renderResultPage(null, `VACS authentication failed (${vacsAuthRes.status}): ${errText}`), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const vacsAuthData = await vacsAuthRes.json() as { cid?: string; token?: string };
    if (!vacsAuthData.token) {
      return new NextResponse(renderResultPage(null, 'VACS did not return an API token'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    console.log('[VACS Callback] Got VACS API token for CID:', vacsAuthData.cid);

    // ── Step 3: Get WS token from VACS ────────────────────────────────
    const wsRes = await fetch(`${vacsBaseUrl}/ws/token`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${vacsAuthData.token}`,
        'Accept': 'application/json',
      },
    });

    if (!wsRes.ok) {
      const errText = await wsRes.text();
      console.error('[VACS Callback] WS token fetch failed:', wsRes.status, errText);
      return new NextResponse(renderResultPage(null, `WS token fetch failed (${wsRes.status})`), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const wsData = await wsRes.json() as { token?: string };
    if (!wsData.token) {
      return new NextResponse(renderResultPage(null, 'VACS did not return a WS token'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    console.log('[VACS Callback] Full auth chain complete — CID:', vacsAuthData.cid);

    // Return HTML that sends the token to the opener and closes
    return new NextResponse(
      renderResultPage({
        wsToken: wsData.token,
        vatsimToken: tokenData.access_token,
        cid: vacsAuthData.cid,
        env,
      }, null),
      { headers: { 'Content-Type': 'text/html' } },
    );
  } catch (err) {
    console.error('[VACS Callback] Error:', err);
    return new NextResponse(renderResultPage(null, `Internal error: ${err instanceof Error ? err.message : 'unknown'}`), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

/** Render a minimal HTML page that posts results back to the opener window */
function renderResultPage(
  result: { wsToken: string; vatsimToken: string; cid?: string; env: string } | null,
  error: string | null,
): string {
  const payload = result
    ? JSON.stringify({ success: true, ...result })
    : JSON.stringify({ success: false, error });

  return `<!DOCTYPE html>
<html>
<head><title>VACS Auth</title></head>
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
