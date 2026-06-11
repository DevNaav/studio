
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

export const getProjectList = ai.defineTool(
  {
    name: 'getProjectList',
    description: 'Retrieves a list of all construction sites and manufacturing units.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      projects: z.array(z.string()).describe('A list of project names.'),
    }),
  },
  async () => {
    // In a real implementation, you would fetch this from Firestore.
    // For now, we'll return a mock list.
    console.log('Fetching project list...');
    return {
      projects: ['Downtown Tower', 'Metropolis Bridge', 'Riverside Manufacturing'],
    };
  }
);
