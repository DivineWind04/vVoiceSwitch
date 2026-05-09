import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body?.logs && Array.isArray(body.logs)) {
    for (const entry of body.logs) {
      process.stdout.write(`[BROWSER] ${entry}\n`);
    }
  }
  return NextResponse.json({ ok: true });
}
