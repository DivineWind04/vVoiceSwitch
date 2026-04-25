/**
 * VACS Auth: Get WebSocket Token
 *
 * Proxies the VACS server's /ws/token endpoint.
 * Returns a { token } that is used to authenticate the WebSocket connection.
 * Must be called after a successful OAuth2 exchange (session must be present).
 */

import { NextRequest, NextResponse } from 'next/server';

const VACS_BASE_URL = process.env.VACS_BASE_URL || 'https://dev.vacs.network';

export async function GET(request: NextRequest) {
  try {
    // Forward cookies so the VACS server sees our authenticated session
    const cookieHeader = request.headers.get('cookie') || '';

    const response = await fetch(`${VACS_BASE_URL}/ws/token`, {
      headers: {
        'Accept': 'application/json',
        'Cookie': cookieHeader,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[VACS Auth] Token fetch failed:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to get WebSocket token. Are you authenticated?' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[VACS Auth] Error fetching token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
