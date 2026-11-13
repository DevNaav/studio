/**
 * Server-side file storage.
 *
 * Two backends, chosen automatically:
 *  - Vercel Blob (private files) when BLOB_READ_WRITE_TOKEN is set — used on Vercel,
 *    where the server disk is temporary. Browsers upload straight to Blob.
 *  - The local disk (UPLOAD_DIR, default ./uploads) otherwise — local dev, Docker, VPS.
 *
 * Either way the database only stores a short signed link such as
 * `/api/files/documents/<companyId>/<id>.pdf?sig=…`. The signature (HMAC of the
 * path) means links can't be guessed or altered.
 */
import 'server-only';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { promises as fs, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { del as blobDel, issueSignedToken, presignUrl, type IssuedSignedToken } from '@vercel/blob';
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, TYPE_BY_EXT, buildFilePath } from '@/lib/file-types';

export { ALLOWED_TYPES, MAX_UPLOAD_BYTES };

// turbopackIgnore: this is a runtime data folder, not source code to bundle into the build.
export const UPLOAD_DIR = path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), 'uploads'));

/** 'blob' on Vercel (Blob store connected), 'disk' everywhere else. */
export function storageMode(): 'blob' | 'disk' {
  return process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'disk';
}

/**
 * Secret for signing links. Set FILE_SIGNING_SECRET in production (required on
 * Vercel). On a normal server, if it's missing, a random secret is created once
 * and kept next to the files so links stay valid across restarts.
 */
function signingSecret(): string {
  if (process.env.FILE_SIGNING_SECRET) return process.env.FILE_SIGNING_SECRET;
  if (storageMode() === 'blob') {
    throw new Error('FILE_SIGNING_SECRET is not set. Add it in your Vercel project settings.');
  }
  const secretFile = path.join(UPLOAD_DIR, '.signing-secret');
  if (existsSync(secretFile)) return readFileSync(secretFile, 'utf8').trim();
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const secret = randomBytes(32).toString('hex');
  writeFileSync(secretFile, secret, { mode: 0o600 });
  return secret;
}

export function signPath(relPath: string): string {
  return createHmac('sha256', signingSecret()).update(relPath).digest('base64url');
}

export function verifySignature(relPath: string, sig: string | null): boolean {
  if (!sig) return false;
  const expected = Buffer.from(signPath(relPath));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function publicUrl(relPath: string): string {
  const encoded = relPath.split('/').map(encodeURIComponent).join('/');
  return `/api/files/${encoded}?sig=${signPath(relPath)}`;
}

/** Validates a storage path (no "..", no hidden files) and returns it unchanged. */
export function assertSafePath(relPath: string): string {
  if (!relPath || relPath.includes('\0') || relPath.startsWith('.') || relPath.startsWith('/')) throw new Error('Invalid path');
  const parts = relPath.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..' || p.startsWith('.'))) throw new Error('Invalid path');
  return relPath;
}

/** Turns a relative storage path into an absolute one on disk, refusing anything outside UPLOAD_DIR. */
export function resolveSafe(relPath: string): string {
  assertSafePath(relPath);
  const abs = path.resolve(UPLOAD_DIR, relPath);
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) throw new Error('Invalid path');
  return abs;
}

/** Disk mode: saves an uploaded file sent through the app server. */
export async function saveFile(folder: string, file: File): Promise<{ path: string; url: string }> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('File is too large (max 25 MB).');
  const relPath = buildFilePath(folder, file, randomUUID());
  const abs = resolveSafe(relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, Buffer.from(await file.arrayBuffer()), { flag: 'wx' });
  return { path: relPath, url: publicUrl(relPath) };
}

export async function deleteFile(relPath: string): Promise<void> {
  assertSafePath(relPath);
  if (storageMode() === 'blob') {
    await blobDel(relPath); // deleting a missing blob is a no-op
    return;
  }
  try {
    await fs.unlink(resolveSafe(relPath));
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

// --- Blob downloads: short-lived presigned links (private files stay private) ---

let readToken: IssuedSignedToken | null = null;

/**
 * Returns a temporary (~1 hour) link to a private blob. One read token is issued
 * per hour and reused for every file, to stay well inside Blob's free operations.
 */
export async function blobDownloadUrl(relPath: string): Promise<string> {
  assertSafePath(relPath);
  if (!readToken || readToken.validUntil - Date.now() < 10 * 60 * 1000) {
    readToken = await issueSignedToken({ pathname: '*', operations: ['get'], validUntil: Date.now() + 70 * 60 * 1000 });
  }
  const { presignedUrl } = await presignUrl(readToken, {
    operation: 'get',
    pathname: relPath,
    access: 'private',
    validUntil: Math.min(readToken.validUntil, Date.now() + 60 * 60 * 1000),
  });
  return presignedUrl;
}

export function contentTypeFor(relPath: string): string {
  const ext = relPath.split('.').pop()?.toLowerCase() || '';
  return TYPE_BY_EXT[ext] || 'application/octet-stream';
}
