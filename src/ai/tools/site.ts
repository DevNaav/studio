
'use server';

/**
 * @fileOverview Defines tools related to application site features.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const createNewSite = ai.defineTool(
  {
    name: 'createNewSite',
    description:
      'Provides the user with instructions on how to create a new site within the Inventra application.',
    inputSchema: z.object({}),
    outputSchema: z.string(),
  },
  async () => {
    return `To create a new site, click on the "+ New Site" button in the card at the bottom-left of the sidebar. This will open a dialog where you can enter the site's name, location, and other details.`;
  }
);
