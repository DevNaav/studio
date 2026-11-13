/**
 * POST /api/files/sign  { path }  → { path, url }
 * After a direct-to-Blob upload, the browser asks for the app's signed link
 * (`/api/files/…?sig=…`) to store in the database. Requires a Firebase login
 * and access to the file's folder.
 */
import { NextResponse } from 'next/server';
import { assertSafePath, publicUrl } from '@/lib/server/file-store';
import { getCaller, assertCanRead, AccessError } from '@/lib/server/file-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const caller = await getCaller(request.headers.get('authorization'));
    const { path } = (await request.json()) as { path?: string };
    if (!path) return NextResponse.json({ error: 'Missing path.' }, { status: 400 });
    assertSafePath(path);
    assertCanRead(caller, path);
    return NextResponse.json({ path, url: publicUrl(path) });
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    if ((error as Error)?.message === 'Invalid path') return NextResponse.json({ error: 'Invalid path.' }, { status: 400 });
    console.error('Sign file link failed:', error);
    return NextResponse.json({ error: 'Could not create the file link.' }, { status: 500 });
  }
}
