
'use server';

/**
 * @fileOverview An AI agent for identifying security threats in a project.
 *
 * - identifyThreats - A function that handles the threat identification process.
 */

import { ai, aiMiddleware } from '@/ai/genkit';
import { requireAiUser as requireUser } from '@/ai/require-user';
import { z } from 'genkit';
import {
  IdentifyThreatsInputSchema,
  IdentifyThreatsOutputSchema,
  type IdentifyThreatsInput,
  type IdentifyThreatsOutput,
} from '@/lib/threats-types';

export async function identifyThreats(
  input: IdentifyThreatsInput,
  idToken: string
): Promise<IdentifyThreatsOutput> {
  await requireUser(idToken);
  return identifyThreatsFlow(input);
}

const prompt = ai.definePrompt({
  use: aiMiddleware,
  name: 'identifyThreatsPrompt',
  input: { schema: IdentifyThreatsInputSchema },
  output: { schema: IdentifyThreatsOutputSchema },
  prompt: `You are a cybersecurity expert specializing in threat modeling for construction and management projects.
  
  Analyze the following project description and identify potential security threats. Categorize the threats into the following groups:
  - external: Threats from outside the organization (e.g., hackers, industrial espionage).
  - internal: Threats from within the organization (e.g., disgruntled employees, accidental data leaks).
  - malware: Threats from malicious software (e.g., ransomware on project management systems, spyware).
  - other: Any other relevant threats.

  Focus on risks relevant to a construction management environment, such as data security for blueprints, financial data, employee information, and physical site security.

  Project Description:
  {{{description}}}
  `,
});

const identifyThreatsFlow = ai.defineFlow(
  {
    name: 'identifyThreatsFlow',
    inputSchema: IdentifyThreatsInputSchema,
    outputSchema: IdentifyThreatsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
