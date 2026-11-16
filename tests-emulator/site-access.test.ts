import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, type Firestore } from 'firebase/firestore';

const projectId = 'demo-inventra-rules';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
let env: RulesTestEnvironment;

const seed: Record<string, Record<string, unknown>> = {
  'companies/c1': { name: 'Goyals', ownerId: 'admin', subscriptionStatus: 'Active', planId: 'premium-annually' },
  'companies/c2': { name: 'Other', ownerId: 'other', subscriptionStatus: 'Active', planId: 'premium-annually' },
  'users/admin': { uid: 'admin', role: 'Admin', companyId: 'c1' },
  'users/pm': { uid: 'pm', role: 'Project Manager', companyId: 'c1' },
  'users/sm': { uid: 'sm', role: 'Site Manager', companyId: 'c1', assignedSites: ['s1'] },
  'users/foreman': { uid: 'foreman', role: 'Foreman', companyId: 'c1' },
  'users/other': { uid: 'other', role: 'Admin', companyId: 'c2' },
  'sites/s1': { companyId: 'c1', name: 'lakhowal' },
  'sites/s2': { companyId: 'c1', name: 'amritsar' },
  'inventory/i1': { companyId: 'c1', siteId: 's1', name: 'Cement' },
  'inventory/i2': { companyId: 'c1', siteId: 's2', name: 'Steel' },
  'inventory/w1': { companyId: 'c1', siteId: 'main', name: 'Blue drum' },
  'expenses/e2': { companyId: 'c1', siteId: 's2', amount: 5000 },
  'labors/l1': { companyId: 'c1', siteId: 's1', name: 'gurbir' },
  'labors/l2': { companyId: 'c1', siteId: 's2', name: 'teji' },
  'attendances/a1': { companyId: 'c1', siteId: 's1', laborId: 'l1', date: '2026-11-16', status: 'Present' },
  'machines/m1': { companyId: 'c1', name: 'JCB', assignedSiteId: 's2' },
  'documents/d0': { companyId: 'c1', siteId: '', name: 'Company PAN' },
  'maintenance_logs/ml': { companyId: 'c1', machineId: 'm1', cost: 900, siteId: 's2' },
  'maintenance_logs/ml0': { companyId: 'c1', machineId: 'm1', cost: 100 }, // no site
};

const db = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const companyWide = (fs: Firestore, name: string) => query(collection(fs, name), where('companyId', '==', 'c1'));
const scoped = (fs: Firestore, name: string, sites: string[]) =>
  query(collection(fs, name), where('companyId', '==', 'c1'), where('siteId', 'in', [...sites, 'main', '']));

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(port), rules: readFileSync('firestore.rules', 'utf8') } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const fs = ctx.firestore() as unknown as Firestore;
    for (const [p, data] of Object.entries(seed)) await setDoc(doc(fs, p), data);
  });
});
afterAll(async () => { await env?.cleanup(); });

describe('Admins and Project Managers see every site', () => {
  for (const uid of ['admin', 'pm']) {
    it(`${uid}: reads any site and loads company-wide lists`, async () => {
      await assertSucceeds(getDoc(doc(db(uid), 'inventory/i2')));
      const snap = await assertSucceeds(getDocs(companyWide(db(uid), 'inventory')));
      expect(snap.size).toBe(3);
    });
    it(`${uid}: can add records to any site`, async () => {
      await assertSucceeds(setDoc(doc(db(uid), `expenses/new-${uid}`), { companyId: 'c1', siteId: 's2', amount: 1 }));
    });
  }
});

describe('a Site Manager assigned to site 1', () => {
  it('reads site 1, the warehouse, company-level records and machines', async () => {
    await assertSucceeds(getDoc(doc(db('sm'), 'inventory/i1')));
    await assertSucceeds(getDoc(doc(db('sm'), 'inventory/w1')));
    await assertSucceeds(getDoc(doc(db('sm'), 'documents/d0')));
    await assertSucceeds(getDoc(doc(db('sm'), 'machines/m1')));
    await assertSucceeds(getDocs(companyWide(db('sm'), 'machines'))); // machines are company-wide
    await assertSucceeds(getDoc(doc(db('sm'), 'sites/s2'))); // site names stay visible
  });

  it("cannot read another site's records", async () => {
    await assertFails(getDoc(doc(db('sm'), 'inventory/i2')));
    await assertFails(getDoc(doc(db('sm'), 'expenses/e2')));
    await assertFails(getDoc(doc(db('sm'), 'labors/l2')));
    await assertFails(getDoc(doc(db('sm'), 'maintenance_logs/ml')));
  });

  it('no list query can reach another site, however it is written', async () => {
    for (const name of ['inventory', 'expenses', 'labors', 'maintenance_logs', 'attendances']) {
      await assertFails(getDocs(companyWide(db('sm'), name)));
      await assertFails(getDocs(query(collection(db('sm'), name), where('companyId', '==', 'c1'), where('siteId', '==', 's2'))));
      await assertFails(getDocs(query(collection(db('sm'), name), where('companyId', '==', 'c1'), where('siteId', 'in', ['s1', 's2']))));
    }
  });

  it('a company-wide list is refused, but the app\'s site-limited list works', async () => {
    await assertFails(getDocs(companyWide(db('sm'), 'inventory')));
    const snap = await assertSucceeds(getDocs(scoped(db('sm'), 'inventory', ['s1'])));
    expect(snap.docs.map(d => d.id).sort()).toEqual(['i1', 'w1']);
  });

  it('per-site lists and the attendance lookup work', async () => {
    await assertSucceeds(getDocs(query(collection(db('sm'), 'labors'), where('companyId', '==', 'c1'), where('siteId', '==', 's1'))));
    await assertSucceeds(getDocs(query(collection(db('sm'), 'attendances'),
      where('companyId', '==', 'c1'), where('siteId', '==', 's1'), where('laborId', '==', 'l1'), where('date', '==', '2026-11-16'))));
  });

  it('can add and edit records on site 1 only', async () => {
    await assertSucceeds(setDoc(doc(db('sm'), 'expenses/sm-ok'), { companyId: 'c1', siteId: 's1', amount: 10 }));
    await assertFails(setDoc(doc(db('sm'), 'expenses/sm-bad'), { companyId: 'c1', siteId: 's2', amount: 10 }));
    await assertSucceeds(updateDoc(doc(db('sm'), 'inventory/i1'), { name: 'Cement OPC' }));
    await assertFails(updateDoc(doc(db('sm'), 'inventory/i2'), { name: 'hacked' }));
  });

  it("cannot move a record into a site they can't see", async () => {
    await assertFails(updateDoc(doc(db('sm'), 'inventory/i1'), { siteId: 's2' }));
  });

  it('cannot give themselves more sites', async () => {
    await assertFails(updateDoc(doc(db('sm'), 'users/sm'), { assignedSites: ['s1', 's2'] }));
  });
});

describe('a Foreman with no sites assigned', () => {
  it('sees only the warehouse and company-level records', async () => {
    await assertFails(getDoc(doc(db('foreman'), 'inventory/i1')));
    const snap = await assertSucceeds(getDocs(scoped(db('foreman'), 'inventory', [])));
    expect(snap.docs.map(d => d.id)).toEqual(['w1']);
  });
});

describe('other companies', () => {
  it("can't read or write this company's records", async () => {
    await assertFails(getDoc(doc(db('other'), 'inventory/i1')));
    await assertFails(getDocs(companyWide(db('other'), 'inventory')));
    await assertFails(setDoc(doc(db('other'), 'expenses/x'), { companyId: 'c1', siteId: 's1', amount: 1 }));
  });
});
