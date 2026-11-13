import { auth } from './firebase';

export type UploadCategory = 'logos' | 'documents' | 'labor_ids' | 'rented_materials' | 'avatars' | 'landing';

export interface UploadedFile {
  /** Storage path on the server, e.g. "documents/<companyId>/<id>-report.pdf" (keep it to delete the file later). */
  path: string;
  /** Signed link to show or download the file; this is what gets saved in the database. */
  url: string;
}

async function authHeader(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in.');
  return `Bearer ${await user.getIdToken()}`;
}

/** Uploads a file to the app server's upload folder and returns its path and link. */
export async function uploadFile(category: UploadCategory, file: File, companyId?: string | null): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  form.append('category', category);
  if (companyId) form.append('companyId', companyId);

  const res = await fetch('/api/files', { method: 'POST', headers: { Authorization: await authHeader() }, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Upload failed.');
  return body as UploadedFile;
}

/** Deletes an uploaded file. Missing files are ignored. */
export async function deleteUploadedFile(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`, { method: 'DELETE', headers: { Authorization: await authHeader() } });
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
