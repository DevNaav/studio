/**
 * Server-side file storage on the local disk.
 *
 * Files are written under UPLOAD_DIR (default: ./uploads) and the database only
 * stores a short signed link such as `/api/files/documents/<companyId>/<id>.pdf?sig=…`.
 * The signature (HMAC of the path) means links can't be guessed or altered, so a
 * file is only reachable by people the app gave the link to.
 */
import 'server-only';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { promises as fs, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// turbopackIgnore: this is a runtime data folder, not source code to bundle into the build.
export const UPLOAD_DIR = path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), 'uploads'));
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** File types we accept. SVG/HTML are excluded because they can carry scripts. */
export const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
};
const TYPE_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_TYPES).map(([type, ext]) => [ext, type]),
);

/**
 * Secret for signing links. Set FILE_SIGNING_SECRET in production. If it's
 * missing, a random secret is created once and kept next to the files so
 * links stay valid across restarts.
 */
function signingSecret(): string {
  if (process.env.FILE_SIGNING_SECRET) return process.env.FILE_SIGNING_SECRET;
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

/** Turns a relative storage path into an absolute one, refusing anything outside UPLOAD_DIR. */
export function resolveSafe(relPath: string): string {
  if (!relPath || relPath.includes('\0') || relPath.startsWith('.')) throw new Error('Invalid path');
  const abs = path.resolve(UPLOAD_DIR, relPath);
  if (!abs.startsWith(UPLOAD_DIR + path.sep)) throw new Error('Invalid path');
  if (path.basename(abs).startsWith('.')) throw new Error('Invalid path');
  return abs;
}

/** Keeps a readable, filesystem-safe version of the original file name. */
function safeBaseName(name: string): string {
  const base = name.replace(/\.[^.]*$/, '').normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return base.slice(0, 60) || 'file';
}

export async function saveFile(folder: string, file: File): Promise<{ path: string; url: string }> {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error('This file type is not allowed.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('File is too large (max 25 MB).');
  const relPath = `${folder}/${randomUUID()}-${safeBaseName(file.name)}.${ext}`;
  const abs = resolveSafe(relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, Buffer.from(await file.arrayBuffer()), { flag: 'wx' });
  return { path: relPath, url: publicUrl(relPath) };
}

export async function deleteFile(relPath: string): Promise<void> {
  try {
    await fs.unlink(resolveSafe(relPath));
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export function contentTypeFor(relPath: string): string {
  const ext = relPath.split('.').pop()?.toLowerCase() || '';
  return TYPE_BY_EXT[ext] || 'application/octet-stream';
}
