/**
 * GET    /api/files                                               → { mode: 'blob' | 'disk' }
 * POST   /api/files   multipart form: file, category, companyId?  → { path, url }   (disk mode only)
 * DELETE /api/files?path=<storage path>                           → { ok: true }
 * POST/DELETE require "Authorization: Bearer <Firebase ID token>".
 * In blob mode browsers upload straight to Vercel Blob via /api/files/blob-upload.
 */
import { NextResponse } from 'next/server';
import { saveFile, deleteFile, MAX_UPLOAD_BYTES, storageMode } from '@/lib/server/file-store';
import { getCaller, folderForUpload, assertCanDelete, AccessError } from '@/lib/server/file-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(error: unknown) {
  if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  const message = (error as Error)?.message;
  if (message === 'This file type is not allowed.' || message?.startsWith('File is too large') || message === 'Invalid path') {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  console.error('File API error:', error);
  return NextResponse.json({ error: 'Something went wrong with the file.' }, { status: 500 });
}

export async function GET() {
  return NextResponse.json({ mode: storageMode() });
}

export async function POST(request: Request) {
  try {
    if (storageMode() === 'blob') {
      return NextResponse.json({ error: 'Uploads go directly to storage in this deployment.' }, { status: 409 });
    }
    const length = Number(request.headers.get('content-length') || 0);
    if (length > MAX_UPLOAD_BYTES + 1024 * 1024) {
      return NextResponse.json({ error: 'File is too large (max 25 MB).' }, { status: 413 });
    }
    const caller = await getCaller(request.headers.get('authorization'));
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file was sent.' }, { status: 400 });

    const folder = folderForUpload(caller, String(form.get('category') ?? ''), (form.get('companyId') as string) || null);
    const saved = await saveFile(folder, file);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const caller = await getCaller(request.headers.get('authorization'));
    const relPath = new URL(request.url).searchParams.get('path') || '';
    assertCanDelete(caller, relPath);
    await deleteFile(relPath);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
