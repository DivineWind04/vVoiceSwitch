/**
 * vNAS Auth: Initiate VATSIM Connect OAuth2 Login
 *
 * Same PKCE-based OAuth flow as the VACS auth, but the callback
 * route returns the VATSIM access token directly (vNAS handles
 * code exchange itself via its own API).
 *
 * Flow:
 *   1. Client calls GET /api/vnas/auth/login
 *   2. We generate PKCE challenge + state, build auth URL
 *   3. Client opens the URL in a popup
 *   4. VATSIM redirects to /api/vnas/auth/callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';

const VATSIM_AUTH_URL = 'https://auth.vatsim.net/oauth/authorize';
const VATSIM_CLIENT_ID = process.env.VATSIM_CLIENT_ID_VNAS || process.env.VATSIM_CLIENT_ID_PROD || '';

function getRedirectUri(request: NextRequest): string {
  const origin = request.nextUrl.origin;
  return `${origin}/api/vnas/auth/callback`;
}

function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// Shared PKCE store (same pattern as VACS auth)
const GLOBAL_KEY = '__vnasPkceStore' as const;
const g = globalThis as unknown as { [GLOBAL_KEY]: Map<string, { verifier: string; createdAt: number }> | undefined };
if (!g[GLOBAL_KEY]) {
  g[GLOBAL_KEY] = new Map();
}
const pkceStore = g[GLOBAL_KEY];

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

  if (!VATSIM_CLIENT_ID) {
    return NextResponse.json(
      { error: 'No VATSIM client ID configured for vNAS. Set VATSIM_CLIENT_ID_VNAS env var.' },
      { status: 500 },
    );
  }

  const redirectUri = getRedirectUri(request);
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = randomBytes(16).toString('hex');

  pkceStore.set(state, { verifier: codeVerifier, createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: VATSIM_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'full_name vatsim_details',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const url = `${VATSIM_AUTH_URL}?${params.toString()}`;
  console.log('[vNAS Auth] Generated auth URL — state:', state.substring(0, 8));

  return NextResponse.json({ url, state, redirectUri });
}
