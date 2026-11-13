/**
 * Server-only guard for the AI server actions.
 *
 * Every AI flow costs money per call, so each one must be called by a signed-in
 * user. The browser sends its Firebase ID token; we verify it here with the
 * Firebase Admin SDK (verifying a token only needs the project ID, no service
 * account key) and apply a simple per-user rate limit.
 */
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from '@/lib/firebase-admin';

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
  return uid;
}

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
