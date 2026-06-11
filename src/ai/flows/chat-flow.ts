
'use server';
/**
 * @fileOverview A conversational chat AI agent.
 *
 * - chat - A function that handles the conversational chat process.
 * - ChatInput - The input type for the chat function.
 * - ChatMessage - A single message in the chat history.
 */

import { ai } from '@/ai/genkit';
import { createNewSite, getProjectList } from '@/ai/tools/site';
import { z } from 'genkit';

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

const ChatInputSchema = z.object({
  history: z.array(ChatMessageSchema),
  message: z.string().describe("The user's message."),
  sites: z.array(z.string()).optional().describe("Active user sites or project names."),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

export async function chat(input: ChatInput): Promise<string> {
  try {
    const output = await chatFlow(input);
    return output;
  } catch (error) {
    console.error('Error in chat flow:', error);
    return 'Sorry, an unexpected error occurred. Please try again later.';
  }
}

const chatFlow = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: z.string(),
  },
  async ({ history, message, sites }) => {
    const response = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      messages: [
        {
          role: 'system',
          content: [
            {
              text: `You are an expert assistant for an application called Inventra.
Your role is to help users understand how to use the application.
Use the tools provided to answer user questions.
${sites && sites.length > 0 ? `The user currently has these active construction/manufacturing projects in their account: ${sites.join(', ')}.` : ''}`,
            },
          ],
        },
        ...history.map((msg) => ({
          role: msg.role,
          content: [{ text: msg.content }],
        })),
        { role: 'user', content: [{ text: message }] },
      ],
      tools: [createNewSite, getProjectList],
    });

    return response.text;
  }
);
