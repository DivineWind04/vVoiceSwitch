/**
 * Landline Signaling Server — Cloudflare Worker Entry Point
 *
 * Routes all WebSocket connections to a single SignalingRoom Durable Object.
 * The DO holds all state (roster, calls) in memory.
 *
 * Endpoints:
 *   GET /ws     → WebSocket upgrade → SignalingRoom DO
 *   GET /health → { ok: true, clients: N, activeCalls: N }
 */

import { SignalingRoom } from './room';

export { SignalingRoom };

export interface Env {
  SIGNALING_ROOM: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    // Route /ws and /health to the single Durable Object instance
    if (url.pathname === '/ws' || url.pathname === '/health') {
      // Use a fixed ID so all clients land in the same room
      const id = env.SIGNALING_ROOM.idFromName('global');
      const room = env.SIGNALING_ROOM.get(id);
      const response = await room.fetch(request);

      // Add CORS headers to non-WebSocket responses
      if (response.status !== 101) {
        const headers = new Headers(response.headers);
        for (const [k, v] of Object.entries(corsHeaders())) {
          headers.set(k, v);
        }
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }

      return response;
    }

    // Root — basic info
    if (url.pathname === '/') {
      return Response.json(
        { service: 'landline-signaling', version: '0.1.0' },
        { headers: corsHeaders() },
      );
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders() });
  },
};

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Connection',
  };
}
