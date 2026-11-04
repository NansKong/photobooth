import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const meteredDomain = 'photobooth_retro.metered.live';

export async function GET() {
  const apiKey = process.env.METERED_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'TURN relay is not configured' }, { status: 503 });
  }

  try {
    const response = await fetch(
      `https://${meteredDomain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) {
      return NextResponse.json({ error: 'TURN relay unavailable' }, { status: 502 });
    }
    const servers = await response.json();
    if (!Array.isArray(servers) || !servers.some((server) =>
      Boolean(server?.username && server?.credential &&
        (Array.isArray(server.urls) ? server.urls : [server.urls]).some((url: unknown) =>
          typeof url === 'string' && /^turns?:/i.test(url)
        ))
    )) {
      return NextResponse.json({ error: 'TURN credentials missing' }, { status: 502 });
    }
    return NextResponse.json({ iceServers: servers }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'TURN relay unavailable' }, { status: 502 });
  }
}
