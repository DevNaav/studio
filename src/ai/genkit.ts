
import {genkit} from 'genkit';
import {retry} from 'genkit/model/middleware';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * "-latest" aliases are kept current by Google, so the app won't break when a
 * specific model version is retired (as gemini-2.0-flash and 2.5-flash were).
 * Flash-Lite answers in a few seconds; switch to 'googleai/gemini-flash-latest'
 * for higher-quality answers if its latency is acceptable.
 */
export const DEFAULT_MODEL = 'googleai/gemini-flash-lite-latest';

export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  // Default model for every prompt/flow that doesn't name one.
  model: DEFAULT_MODEL,
});

/** Retries brief "model overloaded / rate limited" errors from the Gemini API. */
export const aiMiddleware = [
  retry({ maxRetries: 2, initialDelayMs: 1000, statuses: ['UNAVAILABLE', 'RESOURCE_EXHAUSTED', 'DEADLINE_EXCEEDED'] }),
];
