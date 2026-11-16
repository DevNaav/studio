#!/usr/bin/env node
// Restores an Inventra backup file into Firestore.
//   node scripts/restore-backup.mjs <backup.json> [--overwrite] [--yes]
// Default: only puts back documents that are MISSING (safe: nothing existing is changed).
// --overwrite also replaces documents that exist with the backed-up version.
// Without --yes it only shows what it would do.
// Needs Google credentials (GOOGLE_APPLICATION_CREDENTIALS) or FIRESTORE_EMULATOR_HOST.
import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { documentsInBackup, fromJson } from './backup-lib.mjs';

const [file, ...flags] = process.argv.slice(2);
if (!file) { console.error('Usage: node scripts/restore-backup.mjs <backup.json> [--overwrite] [--yes]'); process.exit(1); }
const overwrite = flags.includes('--overwrite');
const apply = flags.includes('--yes');

const projectId = process.env.FIREBASE_PROJECT_ID || 'duplicatemanagmne';
initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId } : { credential: applicationDefault(), projectId });
const db = getFirestore();

const docs = documentsInBackup(JSON.parse(readFileSync(file, 'utf8')));
let toWrite = [];
let skipped = 0;
for (let i = 0; i < docs.length; i += 300) {
  const chunk = docs.slice(i, i + 300);
  const existing = await db.getAll(...chunk.map(d => db.doc(d.path)));
  chunk.forEach((d, j) => (existing[j].exists && !overwrite ? skipped++ : toWrite.push(d)));
}
console.log(`${docs.length} documents in backup: ${toWrite.length} to restore, ${skipped} already exist (kept).`);
if (!apply) { console.log('Dry run. Add --yes to restore.'); process.exit(0); }

for (let i = 0; i < toWrite.length; i += 400) {
  const batch = db.batch();
  toWrite.slice(i, i + 400).forEach(d => batch.set(db.doc(d.path), fromJson(d.data)));
  await batch.commit();
}
console.log(`Restored ${toWrite.length} documents.`);
