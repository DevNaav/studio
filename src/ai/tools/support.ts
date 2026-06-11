
'use server';

/**
 * @fileOverview Defines tools related to application support features.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// This tool is now obsolete as there is a dedicated support page.
// It is kept here as an example but is not used by the chat flow.
export const raiseSupportTicket = ai.defineTool(
  {
    name: 'raiseSupportTicket',
    description:
      'Provides the user with instructions on how to raise a support ticket within the Inventra application.',
    inputSchema: z.object({}),
    outputSchema: z.string(),
  },
  async () => {
    return `To raise a support ticket, navigate to the Support page from your user profile menu. You can fill out the form there to submit a new ticket.`;
  }
);
