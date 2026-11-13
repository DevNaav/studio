/**
 * POST /api/files/blob-upload — Vercel Blob client-upload handshake.
 *
 * The browser asks for a one-time upload token here. We check the user's
 * Firebase login and that the requested path is inside a folder they're allowed
 * to write to, then let the browser upload the file straight to Blob as a
 * private file (so large files never pass through the 4.5 MB function limit).
 */
import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, assertSafePath } from '@/lib/server/file-store';
import { getCaller, folderForUpload, AccessError } from '@/lib/server/file-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UploadPayload { idToken: string; category: string; companyId?: string | null }

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Blob storage is not configured.' }, { status: 501 });
  }
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload: UploadPayload;
        try {
          payload = JSON.parse(clientPayload || '{}');
        } catch {
          throw new AccessError('Bad upload request.', 400);
        }
        const caller = await getCaller(`Bearer ${payload.idToken}`);
        const folder = folderForUpload(caller, payload.category, payload.companyId ?? null);
        assertSafePath(pathname);
        // The file must go straight into the caller's own folder (no sub-folders).
        if (!pathname.startsWith(`${folder}/`) || pathname.slice(folder.length + 1).includes('/')) {
          throw new AccessError('You can’t upload to that location.', 403);
        }
        return {
          allowedContentTypes: Object.keys(ALLOWED_TYPES),
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: false, // the path already contains a random UUID
          allowOverwrite: false,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
      // Nothing to record here: the browser saves the signed link itself.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Blob upload handshake failed:', error);
    return NextResponse.json({ error: (error as Error)?.message === 'Invalid path' ? 'Invalid file name.' : 'Could not start the upload.' }, { status: 400 });
  }
}
