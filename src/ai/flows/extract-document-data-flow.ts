
'use server';

/**
 * @fileOverview An AI flow for extracting and summarizing text from a document image.
 *
 * - extractDocumentData - A function that handles the document data extraction process.
 * - ExtractDocumentDataInput - The input type for the extractDocumentData function.
 * - ExtractDocumentDataOutput - The return type for the extractDocumentData function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractDocumentDataInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "An image of a document, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractDocumentDataInput = z.infer<typeof ExtractDocumentDataInputSchema>;

const ExtractDocumentDataOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the document\'s content.'),
});
export type ExtractDocumentDataOutput = z.infer<typeof ExtractDocumentDataOutputSchema>;

export async function extractDocumentData(
  input: ExtractDocumentDataInput
): Promise<ExtractDocumentDataOutput> {
  return extractDocumentDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractDocumentDataPrompt',
  input: { schema: ExtractDocumentDataInputSchema },
  output: { schema: ExtractDocumentDataOutputSchema },
  prompt: `You are an expert document analyst. Your task is to extract all text from the provided document image and then create a concise summary of its content.

Focus on the most important information present in the document.

Document Image: {{media url=documentDataUri}}`,
});

const extractDocumentDataFlow = ai.defineFlow(
  {
    name: 'extractDocumentDataFlow',
    inputSchema: ExtractDocumentDataInputSchema,
    outputSchema: ExtractDocumentDataOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
