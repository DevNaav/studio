#!/usr/bin/env node
// Full backup of the whole Firestore database (every company), for the nightly GitHub Action.
//   node scripts/backup-all.mjs backup.json
// Needs Google credentials with read access (GOOGLE_APPLICATION_CREDENTIALS), or
// FIRESTORE_EMULATOR_HOST for testing.
import { writeFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { toJson } from './backup-lib.mjs';

const out = process.argv[2] || 'backup.json';
const projectId = process.env.FIREBASE_PROJECT_ID || 'duplicatemanagmne';
initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId } : { credential: applicationDefault(), projectId });
const db = getFirestore();

const documents = [];
async function walk(collectionRef) {
  const snap = await collectionRef.get();
  for (const d of snap.docs) {
    documents.push({ path: d.ref.path, data: toJson(d.data()) });
    for (const sub of await d.ref.listCollections()) await walk(sub);
  }
}
for (const c of await db.listCollections()) await walk(c);

writeFileSync(out, JSON.stringify({ format: 'inventra-full-backup', version: 1, exportedAt: new Date().toISOString(), projectId, documents }));
console.log(`Backed up ${documents.length} documents to ${out}`);
