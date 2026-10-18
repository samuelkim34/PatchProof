import { runProof } from '../../../lib/engine.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  // A deployed public endpoint must not expose your free API quotas to anyone on the internet.
  const demoCode = process.env.PATCHPROOF_DEMO_CODE;
  if (process.env.VERCEL && !demoCode) {
    return Response.json({ error: 'Set PATCHPROOF_DEMO_CODE before enabling cloud scans.' }, { status: 503 });
  }
  if (demoCode && request.headers.get('x-demo-code') !== demoCode) {
    return Response.json({ error: 'Demo access code is required or incorrect.' }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event) => {
        try { controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')); } catch { /* disconnected */ }
      };
      void (async () => {
        try {
          await runProof(send);
        } catch (error) {
          send({ type: 'error', message: String(error?.message || error).slice(0, 1500) });
        } finally {
          try { controller.close(); } catch { /* disconnected */ }
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
