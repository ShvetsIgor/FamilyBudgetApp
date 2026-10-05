import { toZonedDateKey } from '@/shared/utils/dateKey';

export class SiriRequestError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

/** Bound actual streamed bytes, not the caller-controlled Content-Length. */
export async function readSiriRequest(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new SiriRequestError(400, 'A JSON body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new SiriRequestError(413, 'Request body is too large.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new SiriRequestError(400, 'A valid JSON body is required.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 2000) {
    throw new SiriRequestError(400, 'Text must contain between 1 and 2000 characters.');
  }
  if (typeof body.timeZone !== 'string' || !body.timeZone || body.timeZone.length > 100) {
    throw new SiriRequestError(400, 'A valid timeZone is required, for example Asia/Jerusalem.');
  }
  if (body.requestId !== undefined && (typeof body.requestId !== 'string'
    || body.requestId.length < 1 || body.requestId.length > 128 || /[^A-Za-z0-9_-]/.test(body.requestId))) {
    throw new SiriRequestError(400, 'requestId must contain 1 to 128 letters, digits, underscores or hyphens.');
  }
  let todayKey: string;
  try { todayKey = toZonedDateKey(new Date(), body.timeZone); }
  catch { throw new SiriRequestError(400, 'A valid timeZone is required, for example Asia/Jerusalem.'); }
  return { text: body.text.trim() as string, timeZone: body.timeZone as string, requestId: body.requestId as string | undefined, todayKey };
}
