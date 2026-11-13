'use server';

import { aiEnabled } from '@/ai/require-user';

/** Lets the UI tell "AI is switched off" apart from other errors (server error messages are hidden in production). */
export async function isAiEnabled(): Promise<boolean> {
  return aiEnabled();
}
