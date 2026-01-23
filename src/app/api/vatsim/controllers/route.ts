import { NextResponse } from 'next/server';

const VATSIM_CONTROLLERS_URL = 'https://live.env.vnas.vatsim.net/data-feed/controllers.json';

export async function GET() {
  try {
    const response = await fetch(VATSIM_CONTROLLERS_URL, {
      headers: {
        'Accept': 'application/json',
      },
      // Cache for 30 seconds to avoid hammering the VATSIM API
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      console.error('[API] VATSIM fetch failed:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch VATSIM data' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Error fetching VATSIM controllers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
