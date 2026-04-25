/**
 * VACS Auth: Initiate VATSIM Connect OAuth2 Login (PKCE flow)
 *
 * Returns { url, state, codeVerifier } for the client to open in a popup.
 * Uses PKCE (Proof Key for Code Exchange) so no client secret is needed.
 *
 * Flow:
 *   1. Client calls GET /api/vacs/auth/vatsim-login?env=dev|prod
 *   2. We generate PKCE challenge + state, build the authorization URL
 *   3. Client opens the URL in a popup
 *   4. After user authorizes, VATSIM redirects to our callback page
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';

// VATSIM Connect OAuth2 endpoints
const VATSIM_AUTH_URL_DEV = 'https://auth-dev.vatsim.net/oauth/authorize';
const VATSIM_AUTH_URL_PROD = 'https://auth.vatsim.net/oauth/authorize';

// Client IDs — must be registered at https://auth.vatsim.net/ (or dev)
// Using env vars so each deployment can use its own registered app
const VATSIM_CLIENT_ID_DEV = process.env.VATSIM_CLIENT_ID_DEV || '1053';
const VATSIM_CLIENT_ID_PROD = process.env.VATSIM_CLIENT_ID_PROD || '';

// Redirect URI — must match what's registered on VATSIM Connect
function getRedirectUri(request: NextRequest): string {
  const origin = request.nextUrl.origin;
  return `${origin}/api/vacs/auth/vatsim-callback`;
}

/** Generate PKCE code verifier (43-128 chars, URL-safe) */
function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

/** Generate PKCE code challenge (S256) from verifier */
function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// Store PKCE verifiers server-side keyed by state (short TTL)
// Use globalThis to share across Next.js API route modules (survives HMR in dev)
const GLOBAL_PKCE_KEY = '__vacsPkceStore' as const;
const g = globalThis as unknown as { [GLOBAL_PKCE_KEY]: Map<string, { verifier: string; env: string; createdAt: number }> | undefined };
if (!g[GLOBAL_PKCE_KEY]) {
  g[GLOBAL_PKCE_KEY] = new Map();
}
const pkceStore = g[GLOBAL_PKCE_KEY];

// Clean up expired entries (5 min TTL)
function cleanupPkce() {
  const now = Date.now();
  for (const [key, val] of pkceStore) {
    if (now - val.createdAt > 5 * 60 * 1000) {
      pkceStore.delete(key);
    }
  }
}

export async function GET(request: NextRequest) {
  cleanupPkce();

  const env = request.nextUrl.searchParams.get('env') || 'dev';
  const isProd = env === 'prod';

  const clientId = isProd ? VATSIM_CLIENT_ID_PROD : VATSIM_CLIENT_ID_DEV;
  if (!clientId) {
    return NextResponse.json(
      { error: `No VATSIM client ID configured for ${env} environment. Set VATSIM_CLIENT_ID_${env.toUpperCase()} env var.` },
      { status: 500 },
    );
  }

  const authUrl = isProd ? VATSIM_AUTH_URL_PROD : VATSIM_AUTH_URL_DEV;
  const redirectUri = getRedirectUri(request);

  // Generate PKCE pair
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = randomBytes(16).toString('hex');

  // Store verifier server-side for the callback
  pkceStore.set(state, { verifier: codeVerifier, env, createdAt: Date.now() });

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'full_name vatsim_details',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const url = `${authUrl}?${params.toString()}`;

  console.log('[VACS VATSIM Login] Generated auth URL for', env, '- state:', state.substring(0, 8));
  return NextResponse.json({ url, state });
}
