/**
 * vNAS Data API
 *
 * Client-side functions for interacting with the vNAS REST API:
 *   - Fetch available environments (live/sweatbox)
 *   - Exchange VATSIM OAuth code for nasToken + vatsimToken
 *   - Refresh nasToken using vatsimToken
 */

import { VNAS_CONFIG_URL } from './types';
import type { VnasConfig, VnasLoginResponse } from './types';

/**
 * Fetch vNAS configuration (environments list).
 * Called once on app load to populate the environment selector.
 */
export async function fetchVnasConfig(): Promise<VnasConfig> {
  const res = await fetch(VNAS_CONFIG_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch vNAS config: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<VnasConfig>;
}

/**
 * Exchange a VATSIM OAuth authorization code for vNAS tokens.
 * 
 * @param apiBaseUrl - The environment's API base URL
 * @param code - The OAuth authorization code from VATSIM callback
 * @param redirectUrl - The redirect URL used in the OAuth flow
 * @param clientId - The VATSIM OAuth client ID
 */
export async function vnasLogin(
  apiBaseUrl: string,
  code: string,
  redirectUrl: string,
  clientId: string,
): Promise<VnasLoginResponse & { ok: boolean; statusText: string }> {
  const url = `${apiBaseUrl}/auth/login?code=${encodeURIComponent(code)}&redirectUrl=${encodeURIComponent(redirectUrl)}&clientId=${encodeURIComponent(clientId)}`;
  const res = await fetch(url, { credentials: 'include' });
  const data = (await res.json()) as VnasLoginResponse;
  return { ...data, ok: res.ok, statusText: res.statusText };
}

/**
 * Refresh the nasToken using the long-lived vatsimToken.
 * Called by the SignalR hub's accessTokenFactory before each connection/reconnect.
 */
export async function vnasRefreshToken(
  apiBaseUrl: string,
  vatsimToken: string,
): Promise<string> {
  const res = await fetch(`${apiBaseUrl}/auth/refresh?vatsimToken=${encodeURIComponent(vatsimToken)}`);
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}
