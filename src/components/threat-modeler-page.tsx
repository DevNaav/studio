'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShieldAlert, User, Bug, ShieldCheck, AlertTriangle } from 'lucide-react';
import { identifyThreats } from '@/ai/flows/identify-threats-flow';
import { getIdTokenOrThrow } from '@/lib/id-token';
import { isAiEnabled } from '@/app/actions/ai-status';
import { IdentifyThreatsOutput } from '@/lib/threats-types';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  description: z.string().min(50, 'Please provide a more detailed project description (at least 50 characters).'),
});

export function ThreatModelerPage() {
  const [threats, setThreats] = useState<IdentifyThreatsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    setThreats(null);
    try {
      const result = await identifyThreats({ description: values.description }, await getIdTokenOrThrow());
      setThreats(result);
    } catch (error) {
      console.error('Threat modeling failed:', error);
      const enabled = await isAiEnabled().catch(() => true);
      toast({
        variant: 'destructive',
        title: enabled ? 'Analysis Failed' : 'AI is turned off',
        description: enabled
          ? 'Failed to analyze project description. Please try again.'
          : 'AI features are not enabled for this workspace. Everything else works as normal.',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const ThreatList = ({ title, threats, icon }: { title: string, threats: string[], icon: React.ReactNode }) => {
    if (!threats || threats.length === 0) {
      return null;
    }
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">{icon} {title}</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-2 list-disc pl-5">
                    {threats.map((threat, index) => (
                        <li key={index}>{threat}</li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert /> AI Threat Modeler</CardTitle>
          <CardDescription>
            Describe your project, including technologies used, data handled, and user roles. 
            The AI will analyze it and identify potential security threats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Textarea
              {...form.register('description')}
              placeholder="e.g., 'We are building a web application for managing construction site inventory. It uses a Next.js frontend, a Firestore database, and allows site managers to update stock levels. Sensitive data includes material costs and supplier information...'"
              rows={8}
              disabled={isLoading}
            />
            {form.formState.errors.description && (
                <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Analyze for Threats
            </Button>
          </form>
        </CardContent>
      </Card>
      
      {isLoading && (
        <div className="flex items-center justify-center p-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Analyzing project...</p>
        </div>
      )}

      {threats && (
        <Card>
          <CardHeader>
            <CardTitle>Threat Analysis Results</CardTitle>
            <CardDescription>The following potential threats have been identified based on your project description.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ThreatList title="External Threats" threats={threats.external} icon={<User className="text-red-500" />} />
            <ThreatList title="Internal Threats" threats={threats.internal} icon={<AlertTriangle className="text-orange-500" />} />
            <ThreatList title="Malware Threats" threats={threats.malware} icon={<Bug className="text-yellow-500" />} />
            <ThreatList title="Other Threats" threats={threats.other} icon={<ShieldAlert className="text-blue-500" />} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
