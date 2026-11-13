/**
 * GET /api/files/<storage path>?sig=<signature>
 * Serves an uploaded file. Only links created by the app (with a valid
 * signature) work, so file URLs can't be guessed or edited to reach other files.
 */
import { promises as fs } from 'node:fs';
import { resolveSafe, verifySignature, contentTypeFor } from '@/lib/server/file-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const relPath = segments.map(decodeURIComponent).join('/');
  const sig = new URL(request.url).searchParams.get('sig');

  if (!verifySignature(relPath, sig)) return new Response('Not found', { status: 404 });

  let data: Buffer;
  try {
    data = await fs.readFile(resolveSafe(relPath));
  } catch {
    return new Response('Not found', { status: 404 });
  }

  const type = contentTypeFor(relPath);
  const inline = type.startsWith('image/') || type === 'application/pdf';
  const fileName = relPath.split('/').pop()!.replace(/^[0-9a-f-]{36}-/, '');
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': type,
      'Content-Length': String(data.length),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${fileName}"`,
      // Files never change at a given path (each upload gets a new name).
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
