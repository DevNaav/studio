/**
 * Server-only guard for the AI server actions.
 *
 * Every AI flow costs money per call, so each one must be called by a signed-in
 * user. The browser sends its Firebase ID token; we verify it here with the
 * Firebase Admin SDK (verifying a token only needs the project ID, no service
 * account key) and apply a simple per-user rate limit.
 */
import { getAuth } from 'firebase-admin/auth';
import { ADMIN_PROJECT_ID, getAdminApp } from '@/lib/firebase-admin';
import { effectivePlan } from '@/lib/plans';
import type { Company } from '@/lib/types';

function adminAuth() {
  return getAuth(getAdminApp());
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// Per-user sliding-window rate limit. In-memory is enough while App Hosting
// runs a single instance (apphosting.yaml: maxInstances: 1); move this to
// Firestore or Redis if you scale out.
const WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 20;
const calls = new Map<string, number[]>();

function checkRateLimit(uid: string) {
  const now = Date.now();
  const recent = (calls.get(uid) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_CALLS_PER_WINDOW) {
    calls.set(uid, recent);
    throw new AuthError('Too many AI requests. Please wait a minute and try again.');
  }
  recent.push(now);
  calls.set(uid, recent);
}

/** Verifies the caller's Firebase ID token and rate-limits them. Returns the user's uid. */
export async function requireUser(idToken: string | undefined | null): Promise<string> {
  if (!idToken || typeof idToken !== 'string') {
    throw new AuthError('You must be signed in to use AI features.');
  }
  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(idToken)).uid;
  } catch {
    throw new AuthError('Your session has expired. Please sign in again.');
  }
  checkRateLimit(uid);
  await requireAiPlan(uid, idToken);
  return uid;
}

// --- Plan check: AI is a Business-plan feature (a trial counts as Business). ---
// The company is read with the caller's own token (Firestore REST), so the security
// rules apply and no admin credentials are needed. Results are cached for 5 minutes.
const planCache = new Map<string, { ok: boolean; at: number }>();

async function readDoc(path: string, idToken: string) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${ADMIN_PROJECT_ID}/databases/(default)/documents/${path}`,
    { headers: { Authorization: `Bearer ${idToken}` }, cache: 'no-store' },
  );
  return res.ok ? ((await res.json()).fields ?? {}) : null;
}

async function requireAiPlan(uid: string, idToken: string) {
  const cached = planCache.get(uid);
  if (cached && Date.now() - cached.at < 5 * 60_000) {
    if (!cached.ok) throw new AuthError(AI_PLAN_MESSAGE);
    return;
  }
  const profile = await readDoc(`users/${encodeURIComponent(uid)}`, idToken);
  const role = profile?.role?.stringValue;
  const companyId = profile?.companyId?.stringValue;
  let ok = false;
  if (role === 'SuperAdmin' && !companyId) {
    ok = true;
  } else if (companyId) {
    const company = await readDoc(`companies/${encodeURIComponent(companyId)}`, idToken);
    const status = company?.subscriptionStatus?.stringValue as Company['subscriptionStatus'] | undefined;
    const endDate = company?.subscriptionEndDate?.stringValue;
    const current = (status === 'Active' || status === 'Trial') && (!endDate || new Date(endDate) > new Date());
    ok = current && effectivePlan({ planId: company?.planId?.stringValue as Company['planId'], subscriptionStatus: status! }).premiumFeatures;
  }
  planCache.set(uid, { ok, at: Date.now() });
  if (!ok) throw new AuthError(AI_PLAN_MESSAGE);
}

const AI_PLAN_MESSAGE = 'AI features are part of the Business plan. Upgrade under Subscription to use them.';

/** True when a Gemini API key is configured. Without one, AI features are switched off. */
export function aiEnabled(): boolean {
  return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY);
}

/** Like requireUser, but first checks that AI is switched on (no Gemini key = no AI, no cost). */
export async function requireAiUser(idToken: string | undefined | null): Promise<string> {
  if (!aiEnabled()) {
    throw new AuthError('AI features are turned off for this workspace. Everything else works as normal.');
  }
  return requireUser(idToken);
}
