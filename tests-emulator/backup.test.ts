import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { exportCompanyData } from '@/lib/backup';

const projectId = 'demo-inventra';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
let env: RulesTestEnvironment;
const dir = mkdtempSync(join(tmpdir(), 'inventra-backup-'));

const seed = {
  'companies/c1': { name: 'Goyals', ownerId: 'u1', subscriptionStatus: 'Active', planId: 'premium-annually' },
  'companies/c2': { name: 'Other Co', ownerId: 'u9', subscriptionStatus: 'Active', planId: 'basic-annually' },
  'users/u1': { uid: 'u1', name: 'Admin', role: 'Admin', companyId: 'c1' },
  'users/u9': { uid: 'u9', name: 'Other', role: 'Admin', companyId: 'c2' },
  'sites/s1': { companyId: 'c1', name: 'lakhowal', budget: 10000000, status: 'Active' },
  'inventory/i1': { companyId: 'c1', siteId: 's1', name: 'Cement', status: 'Bought', quantity: 105, unit: 'BAGS', pricePerUnit: 350, createdAt: Timestamp.fromDate(new Date('2025-10-28T05:30:00Z')) },
  'sales/x1': { companyId: 'c1', siteId: 's1', salePrice: 48000, amountPaid: 18000, paymentHistory: [{ amount: 18000, date: '2026-09-20', method: 'Cash' }] },
  'labors/l1': { companyId: 'c1', siteId: 's1', name: 'gurbir', wageType: 'Monthly', wage: 22000 },
  'sites/s9': { companyId: 'c2', name: 'not ours' },
  'companies/c1/activity/a1': { companyId: 'c1', actorUid: 'u1', summary: 'Added task', at: Timestamp.fromDate(new Date('2026-11-14T22:17:00Z')) },
} as Record<string, Record<string, unknown>>;

function runScript(script: string, args: string[]) {
  return execFileSync('node', [join('scripts', script), ...args], {
    env: { ...process.env, FIREBASE_PROJECT_ID: projectId, FIRESTORE_EMULATOR_HOST: `${host}:${port}` },
    encoding: 'utf8',
  });
}

async function readAll(paths: string[]) {
  const out: Record<string, unknown> = {};
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore() as unknown as Firestore;
    for (const p of paths) {
      const s = await getDoc(doc(db, p));
      out[p] = s.exists() ? s.data() : null;
    }
  });
  return out;
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(port), rules: readFileSync('firestore.rules', 'utf8') } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore() as unknown as Firestore;
    for (const [p, data] of Object.entries(seed)) await setDoc(doc(db, p), data);
  });
});
afterAll(async () => { await env?.cleanup(); });

describe('company backup (Settings > Download backup)', () => {
  it("an admin's backup holds all of their company's records and nothing of other companies", async () => {
    const db = env.authenticatedContext('u1').firestore() as unknown as Firestore;
    const backup = await exportCompanyData(db, 'c1');
    expect(backup.companyName).toBe('Goyals');
    expect(backup.collections.sites.map(d => d.id)).toEqual(['s1']);
    expect(backup.collections.inventory[0].data.createdAt).toEqual({ __timestamp: '2025-10-28T05:30:00.000Z' });
    expect(backup.collections.users.map(d => d.id)).toEqual(['u1']);
    expect(backup.companySubcollections.activity).toHaveLength(1);
    writeFileSync(join(dir, 'company.json'), JSON.stringify(backup));
  });

  it('restoring after the data is lost puts every record back exactly', async () => {
    const paths = Object.keys(seed).filter(p => !p.includes('c2') && !p.endsWith('u9') && !p.endsWith('s9'));
    const before = await readAll(paths);
    await env.clearFirestore();
    expect(Object.values(await readAll(paths)).every(v => v === null)).toBe(true);

    expect(runScript('restore-backup.mjs', [join(dir, 'company.json')])).toMatch(/Dry run/); // nothing written without --yes
    expect(Object.values(await readAll(paths)).every(v => v === null)).toBe(true);

    runScript('restore-backup.mjs', [join(dir, 'company.json'), '--yes']);
    expect(await readAll(paths)).toEqual(before);
  });

  it('by default a restore never changes records that still exist', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore() as unknown as Firestore, 'labors/l1'), { companyId: 'c1', siteId: 's1', name: 'gurbir', wageType: 'Monthly', wage: 25000 });
    });
    expect(runScript('restore-backup.mjs', [join(dir, 'company.json'), '--yes'])).toMatch(/Restored 0 documents/);
    expect((await readAll(['labors/l1']))['labors/l1']).toMatchObject({ wage: 25000 });
    runScript('restore-backup.mjs', [join(dir, 'company.json'), '--yes', '--overwrite']);
    expect((await readAll(['labors/l1']))['labors/l1']).toMatchObject({ wage: 22000 });
  });
});

describe('nightly full backup', () => {
  it('backs up every company (including sub-collections) and restores it', async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore() as unknown as Firestore;
      for (const [p, data] of Object.entries(seed)) await setDoc(doc(db, p), data);
    });
    const file = join(dir, 'full.json');
    expect(runScript('backup-all.mjs', [file])).toMatch(new RegExp(`Backed up ${Object.keys(seed).length} documents`));
    const before = await readAll(Object.keys(seed));
    await env.clearFirestore();
    runScript('restore-backup.mjs', [file, '--yes']);
    expect(await readAll(Object.keys(seed))).toEqual(before);
  });
});
