/** Connection probe for Shortcuts. Never echoes input or accesses user data. */
export const dynamic = 'force-dynamic';

function connected() {
  return Response.json({ ok: true, message: 'Connection works. No expense was created.' }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function GET() { return connected(); }

export async function POST(request: Request) {
  // Consume the upload before replying so the probe also tests POST transport.
  // Bound memory regardless of any caller-supplied Content-Length header.
  const reader = request.body?.getReader();
  if (reader) {
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) {
          await reader.cancel();
          return Response.json({ ok: false, message: 'Probe body is too large.' }, {
            status: 413, headers: { 'Cache-Control': 'no-store' },
          });
        }
      }
    } catch {
      return Response.json({ ok: false, message: 'Could not read the probe body.' }, {
        status: 400, headers: { 'Cache-Control': 'no-store' },
      });
    } finally { reader.releaseLock(); }
  }
  return connected();
}
