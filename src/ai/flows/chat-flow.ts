
'use server';
/**
 * @fileOverview A conversational chat AI agent.
 *
 * - chat - A function that handles the conversational chat process.
 * - ChatInput - The input type for the chat function.
 * - ChatMessage - A single message in the chat history.
 */

import { ai, aiMiddleware } from '@/ai/genkit';
import { createNewSite } from '@/ai/tools/site';
import { requireUser, AuthError } from '@/ai/require-user';
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

const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_MESSAGES = 40;

export async function chat(input: ChatInput, idToken: string): Promise<string> {
  try {
    await requireUser(idToken);
    if (typeof input?.message !== 'string' || input.message.length > MAX_MESSAGE_CHARS) {
      return 'Your message is too long. Please shorten it and try again.';
    }
    const trimmed = { ...input, history: (input.history ?? []).slice(-MAX_HISTORY_MESSAGES) };
    const output = await chatFlow(trimmed);
    return output;
  } catch (error) {
    if (error instanceof AuthError) return error.message;
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
      
      use: aiMiddleware,
      
      messages: [
        {
          role: 'system',
          content: [
            {
              text: `You are an expert assistant for an application called Inventra.
Your role is to help users understand how to use the application.
Use the tools provided to answer user questions.
${sites && sites.length > 0 ? `The user currently has these active construction/manufacturing projects in their account: ${sites.join(', ')}.` : 'The user currently has no active construction/manufacturing projects in their account.'}
Only mention projects from this list; never invent project names.`,
            },
          ],
        },
        ...history.map((msg) => ({
          role: msg.role,
          content: [{ text: msg.content }],
        })),
        { role: 'user', content: [{ text: message }] },
      ],
      tools: [createNewSite],
    });

    return response.text;
  }
);
