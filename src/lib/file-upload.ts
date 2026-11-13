import { auth } from './firebase';
import { MAX_UPLOAD_BYTES, buildFilePath } from './file-types';

export type UploadCategory = 'logos' | 'documents' | 'labor_ids' | 'rented_materials' | 'avatars' | 'landing';

export interface UploadedFile {
  /** Storage path, e.g. "documents/<companyId>/<id>-report.pdf" (keep it to delete the file later). */
  path: string;
  /** Signed link to show or download the file; this is what gets saved in the database. */
  url: string;
}

async function idToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in.');
  return user.getIdToken();
}

/** Where files are stored: Vercel Blob (on Vercel) or the app server's disk. Asked once per page load. */
let modePromise: Promise<'blob' | 'disk'> | null = null;
function storageMode(): Promise<'blob' | 'disk'> {
  modePromise ??= fetch('/api/files')
    .then((r) => r.json())
    .then((b) => (b.mode === 'blob' ? 'blob' : 'disk'))
    .catch(() => 'disk');
  return modePromise;
}

function folderFor(category: UploadCategory, companyId?: string | null): string {
  if (category === 'avatars') return `avatars/${auth.currentUser?.uid}`;
  if (category === 'landing') return 'landing';
  if (!companyId) throw new Error('Missing company.');
  return `${category}/${companyId}`;
}

/** Uploads a file (to Vercel Blob or the server folder) and returns its path and signed link. */
export async function uploadFile(category: UploadCategory, file: File, companyId?: string | null): Promise<UploadedFile> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('File is too large (max 25 MB).');
  const token = await idToken();

  if ((await storageMode()) === 'blob') {
    // Straight from the browser to Vercel Blob as a private file (no server size limit).
    const pathname = buildFilePath(folderFor(category, companyId), file, crypto.randomUUID());
    const { upload } = await import('@vercel/blob/client');
    try {
      await upload(pathname, file, {
        access: 'private',
        handleUploadUrl: '/api/files/blob-upload',
        clientPayload: JSON.stringify({ idToken: token, category, companyId: companyId ?? null }),
        contentType: file.type,
        multipart: file.size > 8 * 1024 * 1024,
      });
    } catch (error: any) {
      throw new Error(error?.message?.includes('limit') ? 'Storage limit reached. Please try again later.' : 'Upload failed. Please try again.');
    }
    const res = await fetch('/api/files/sign', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Upload failed.');
    return body as UploadedFile;
  }

  // Server folder (local development, Docker, VPS).
  const form = new FormData();
  form.append('file', file);
  form.append('category', category);
  if (companyId) form.append('companyId', companyId);
  const res = await fetch('/api/files', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Upload failed.');
  return body as UploadedFile;
}

/** Deletes an uploaded file. Missing files are ignored. */
export async function deleteUploadedFile(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${await idToken()}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Could not delete the file.');
  }
}

/** Storage path from a link created by uploadFile (works for links saved in the database). */
export function pathFromFileUrl(url: string | null | undefined): string | null {
  if (!url?.startsWith('/api/files/')) return null;
  return url.slice('/api/files/'.length).split('?')[0].split('/').map(decodeURIComponent).join('/');
}
