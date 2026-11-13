'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const schema = z.object({
  name: z.string().min(2, { message: 'Please enter your name.' }),
  companyName: z.string().min(2, { message: 'Please enter your company name.' }),
  mobileNumber: z
    .string()
    .regex(/^\+?\d{5,15}$/, 'Enter 5–15 digits, optionally starting with +.')
    .optional()
    .or(z.literal('')),
});

/**
 * Shown to a signed-in user who has no profile yet — e.g. the first time
 * someone uses "Sign in with Google". Creates their trial company and profile.
 */
export function CompleteProfile() {
  const { user, completeProfile, logout } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.displayName ?? '', companyName: '', mobileNumber: '' },
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setSubmitting(true);
    try {
      await completeProfile(values.name, values.companyName, values.mobileNumber || undefined);
    } catch (error: any) {
      console.error('Profile setup failed:', error);
      toast({ variant: 'destructive', title: 'Setup failed', description: error?.message || 'Please try again.' });
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Finish setting up your account</CardTitle>
          <CardDescription>
            You&apos;re signed in as {user?.email}. Tell us about your company to start your free trial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name</FormLabel>
                  <FormControl><Input autoComplete="name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl><Input placeholder="Acme Construction" autoComplete="organization" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="mobileNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile Number (optional)</FormLabel>
                  <FormControl><Input placeholder="+919876543210" inputMode="tel" autoComplete="tel" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create my company
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => logout()}>
                Use a different account
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
