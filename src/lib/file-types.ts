/** Upload rules shared by the browser and the server. */

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

export const TYPE_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_TYPES).map(([type, ext]) => [ext, type]),
);

/** Keeps a readable, filesystem/URL-safe version of the original file name (without extension). */
export function safeBaseName(name: string): string {
  const base = name.replace(/\.[^.]*$/, '').normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return base.slice(0, 60) || 'file';
}

/** Storage path for a new upload inside a folder, e.g. "documents/<company>/<uuid>-invoice.pdf". */
export function buildFilePath(folder: string, file: { name: string; type: string }, id: string): string {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error('This file type is not allowed.');
  return `${folder}/${id}-${safeBaseName(file.name)}.${ext}`;
}
