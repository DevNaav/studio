'use server';

/**
 * @fileOverview An AI agent for recommending maintenance tasks based on site conditions.
 *
 * - recommendMaintenanceTasks - A function that handles the maintenance task recommendation process.
 * - RecommendMaintenanceTasksInput - The input type for the recommendMaintenanceTasks function.
 * - RecommendMaintenanceTasksOutput - The return type for the recommendMaintenanceTasks function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecommendMaintenanceTasksInputSchema = z.object({
  siteConditionsSummary: z
    .string()
    .describe('A brief textual summary of the current construction site conditions.'),
  recentInventoryLogs: z
    .string()
    .optional()
    .describe('Summaries of recent inventory logs at the site.'),
  recentExpenseLogs: z
    .string()
    .optional()
    .describe('Summaries of recent expense logs for the site.'),
});
export type RecommendMaintenanceTasksInput = z.infer<typeof RecommendMaintenanceTasksInputSchema>;

const RecommendMaintenanceTasksOutputSchema = z.object({
  recommendedTasks: z
    .array(z.string())
    .describe('A list of recommended maintenance tasks based on the site conditions.'),
  reasoning: z
    .string()
    .describe('The AI agent reasoning for recommending these tasks.'),
});
export type RecommendMaintenanceTasksOutput = z.infer<typeof RecommendMaintenanceTasksOutputSchema>;

export async function recommendMaintenanceTasks(
  input: RecommendMaintenanceTasksInput
): Promise<RecommendMaintenanceTasksOutput> {
  return recommendMaintenanceTasksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recommendMaintenanceTasksPrompt',
  input: {schema: RecommendMaintenanceTasksInputSchema},
  output: {schema: RecommendMaintenanceTasksOutputSchema},
  prompt: `You are an AI assistant that provides recommendations for maintenance tasks on construction sites, in order to improve safety and equipment longevity.

  Based on the current site conditions, recent inventory logs, and expense logs, determine the most relevant maintenance tasks to log or prioritize.

  Current Site Conditions Summary: {{{siteConditionsSummary}}}
  Recent Inventory Logs: {{{recentInventoryLogs}}}
  Recent Expense Logs: {{{recentExpenseLogs}}}

  Consider tasks related to equipment maintenance, safety inspections, material storage, and environmental compliance.

  Return a list of specific maintenance tasks that should be logged or prioritized, along with a brief explanation of your reasoning.
  `,
});

const recommendMaintenanceTasksFlow = ai.defineFlow(
  {
    name: 'recommendMaintenanceTasksFlow',
    inputSchema: RecommendMaintenanceTasksInputSchema,
    outputSchema: RecommendMaintenanceTasksOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
