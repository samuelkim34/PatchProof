import { parsePublicGithubUrl, runRepositoryProof } from '../../../lib/repo-engine.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Development-time concurrency guard. In production use authentication plus persistent
// quotas; a process-local flag does NOT protect multi-instance deployments.
let scanInProgress = false;

export async function POST(request) {
  const code = process.env.PATCHPROOF_DEMO_CODE;
  if (process.env.VERCEL && !code) return Response.json({ error: 'Cloud scans disabled: configure PATCHPROOF_DEMO_CODE on the server.' }, { status: 503 });
  if (code && request.headers.get('x-demo-code') !== code) return Response.json({ error: 'Invalid demo access code.' }, { status: 401 });
  if (scanInProgress) return Response.json({ error: 'A scan is already running. Try again after it finishes.' }, { status: 429 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Expected JSON.' }, { status: 400 }); }
  if (body?.authorized !== true) return Response.json({ error: 'Confirm you own the repository or are authorized to test it.' }, { status: 400 });
  try { parsePublicGithubUrl(body?.repositoryUrl); }
  catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
  scanInProgress = true;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const emit = event => {
        try { controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')); }
        catch { /* viewer disconnected */ }
      };
      void (async () => {
        try { await runRepositoryProof({ repositoryUrl: body.repositoryUrl, emit }); }
        catch (error) { emit({ type: 'error', message: String(error?.message || error).slice(0, 1400) }); }
        finally { scanInProgress = false; try { controller.close(); } catch {} }
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
