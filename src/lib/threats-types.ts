
import { z } from 'genkit';

export const IdentifyThreatsInputSchema = z.object({
  description: z
    .string()
    .describe(
      'A description of the project or system to be analyzed for threats.'
    ),
});
export type IdentifyThreatsInput = z.infer<typeof IdentifyThreatsInputSchema>;

export const IdentifyThreatsOutputSchema = z.object({
  external: z
    .array(z.string())
    .describe(
      'A list of potential threats from external actors like hackers or competitors.'
    ),
  internal: z
    .array(z.string())
    .describe(
      'A list of potential threats from insiders, such as employees or contractors.'
    ),
  malware: z
    .array(z.string())
    .describe(
      'A list of potential threats related to malware, like ransomware or spyware.'
    ),
  other: z
    .array(z.string())
    .describe(
      'A list of any other potential security threats not covered by the other categories.'
    ),
});
export type IdentifyThreatsOutput = z.infer<typeof IdentifyThreatsOutputSchema>;
