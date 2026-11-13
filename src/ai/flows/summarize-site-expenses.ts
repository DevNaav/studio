'use server';

/**
 * @fileOverview An AI agent for summarizing construction site expenses.
 *
 * - summarizeSiteExpenses - A function that handles the expense summarization process.
 * - SummarizeSiteExpensesInput - The input type for the summarizeSiteExpenses function.
 * - SummarizeSiteExpensesOutput - The return type for the summarizeSiteExpenses function.
 */

import { ai, aiMiddleware } from '@/ai/genkit';
import { requireAiUser as requireUser } from '@/ai/require-user';
import {z} from 'genkit';

const SummarizeSiteExpensesInputSchema = z.object({
  expenses: z
    .string()
    .describe('A list of expenses for the site, typically in a string format (e.g., CSV or JSON).'),
});
export type SummarizeSiteExpensesInput = z.infer<typeof SummarizeSiteExpensesInputSchema>;

const SummarizeSiteExpensesOutputSchema = z.object({
  summary: z
    .string()
    .describe('A concise summary of the most important expense patterns and totals.'),
  majorCostDrivers: z
    .array(z.string())
    .describe('A list of the top 3-5 categories or items driving costs.'),
  potentialSavings: z
    .array(z.string())
    .describe('A list of actionable suggestions for potential cost savings.'),
});
export type SummarizeSiteExpensesOutput = z.infer<typeof SummarizeSiteExpensesOutputSchema>;

export async function summarizeSiteExpenses(
  input: SummarizeSiteExpensesInput,
  idToken: string
): Promise<SummarizeSiteExpensesOutput> {
  await requireUser(idToken);
  return summarizeSiteExpensesFlow(input);
}

const prompt = ai.definePrompt({
  use: aiMiddleware,
  name: 'summarizeSiteExpensesPrompt',
  input: {schema: SummarizeSiteExpensesInputSchema},
  output: {schema: SummarizeSiteExpensesOutputSchema},
  prompt: `You are an expert financial analyst for a construction company.
  Your task is to analyze a list of site expenses and provide a clear, actionable summary.

  Analyze the following expenses:
  {{{expenses}}}

  Based on this data, identify the major cost drivers and suggest potential areas for savings.
  Provide a brief overall summary, a list of the main cost drivers, and a list of saving opportunities.
  `,
});

const summarizeSiteExpensesFlow = ai.defineFlow(
  {
    name: 'summarizeSiteExpensesFlow',
    inputSchema: SummarizeSiteExpensesInputSchema,
    outputSchema: SummarizeSiteExpensesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
