
'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, Eye, EyeOff, ArrowRight, Mail, Lock, HardHat, Boxes, BrainCircuit } from 'lucide-react';
import Link from 'next/link';
import { AuthLayout, authInputClass } from '@/components/auth-layout';
import type { CharacterMood } from '@/components/login-character';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
    <path fill="#FBBC05" d="M5.29 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.1z" />
    <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.6l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75z" />
  </svg>
);

const BUBBLE: Record<CharacterMood, string> = {
  idle: 'Hi there! Ready to build something great today?',
  email: 'Typing your email… looking good!',
  password: "Don't worry, I'm not looking 🙈",
  peek: 'Oops… I might have peeked 👀',
  error: "Hmm, that didn't work. Try again?",
  success: 'Welcome back! 🎉 Taking you in…',
};

const FEATURES = [
  { icon: HardHat, label: 'Sites & labour' },
  { icon: Boxes, label: 'Inventory & machines' },
  { icon: BrainCircuit, label: 'AI insights' },
];

export default function LoginPage() {
  const { user, logIn, signInWithGoogle, sendPasswordReset } = useAuth();
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [reaction, setReaction] = useState<'error' | 'success' | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const celebrating = useRef(false);
  const reactionTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();
  const { toast } = useToast();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const emailValue = loginForm.watch('email');

  // Already signed in (e.g. returning visitor): go straight to the app,
  // unless we're playing the success animation first.
  useEffect(() => {
    if (user && !celebrating.current) router.push('/app');
  }, [user, router]);

  useEffect(() => () => clearTimeout(reactionTimer.current), []);

  const react = (r: 'error' | 'success', ms: number) => {
    clearTimeout(reactionTimer.current);
    setReaction(r);
    if (r === 'error') setShakeKey(k => k + 1);
    reactionTimer.current = setTimeout(() => setReaction(null), ms);
  };

  const mood: CharacterMood =
    reaction ?? (focused === 'password' ? (showPassword ? 'peek' : 'password') : focused === 'email' ? 'email' : 'idle');

  const onLoginSubmit = async (values: z.infer<typeof loginSchema>) => {
    if (isEmailLoading || isGoogleLoading) return;
    setIsEmailLoading(true);
    try {
      celebrating.current = true;
      await logIn(values.email, values.password);
      setFocused(null);
      react('success', 5000);
      setTimeout(() => router.push('/app'), 1100); // let the celebration play
    } catch (error: any) {
      celebrating.current = false;
      react('error', 1800);
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message || 'An unexpected error occurred. Please check your credentials or internet connection.',
      });
      setIsEmailLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isEmailLoading || isGoogleLoading) return;
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = loginForm.getValues('email');
    if (!email) {
      toast({ variant: 'destructive', title: 'Email Required', description: 'Please enter your email address in the email field first.' });
      loginForm.setFocus('email');
      return;
    }
    try {
      await sendPasswordReset(email);
      toast({ title: 'Password Reset Email Sent', description: `An email has been sent to ${email} with instructions to reset your password.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not send password reset email. Please try again.' });
    }
  };

  const busy = isEmailLoading || isGoogleLoading;

  return (
    <AuthLayout
      mood={mood}
      typingProgress={Math.min((emailValue?.length ?? 0) / 28, 1)}
      bubble={BUBBLE[mood]}
      headline={<>Run every site from{' '}<span className="bg-gradient-to-r from-sky-600 via-cyan-500 to-purple-600 dark:from-sky-400 dark:via-cyan-300 dark:to-purple-400 bg-clip-text text-transparent">one dashboard</span>.</>}
      subline="Projects, labour, inventory, machines and AI insights — all in one secure workspace."
      features={FEATURES}
      title="Welcome back"
      description="Sign in to manage your projects."
      shakeKey={shakeKey}
    >
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit, () => react('error', 1500))} className="mt-7 space-y-5">
                <fieldset disabled={busy} className="space-y-5">
                  <FormField control={loginForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-ink/80">Email</FormLabel>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
                        <FormControl>
                          <Input
                            type="email"
                            autoComplete="email"
                            placeholder="name@company.com"
                            className={authInputClass}
                            {...field}
                            onFocus={() => setFocused('email')}
                            onBlur={() => { field.onBlur(); setFocused(f => (f === 'email' ? null : f)); }}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={loginForm.control} name="password" render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-ink/80">Password</FormLabel>
                        <button type="button" className="text-xs font-medium text-sky-600 dark:text-sky-300 hover:text-sky-700 dark:hover:text-sky-200 hover:underline" onClick={handleForgotPassword}>
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
                        <FormControl>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            placeholder="Enter your password"
                            className={`${authInputClass} pr-11`}
                            {...field}
                            onFocus={() => setFocused('password')}
                            onBlur={() => { field.onBlur(); setFocused(f => (f === 'password' ? null : f)); }}
                          />
                        </FormControl>
                        <button
                          type="button"
                          // Keep focus in the password field so the character stays in "password" mode.
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setShowPassword(v => !v)}
                          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink/50 transition hover:text-ink"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                </fieldset>

                <Button
                  type="submit"
                  disabled={busy}
                  aria-busy={isEmailLoading}
                  className="group h-12 w-full rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 text-base font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:brightness-110"
                >
                  {isEmailLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isEmailLoading ? 'Signing in…' : 'Sign in'}
                  {!isEmailLoading && <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />}
                </Button>
              </form>
            </Form>

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-ink/40">
              <span className="h-px flex-1 bg-ink/10" /> or <span className="h-px flex-1 bg-ink/10" />
            </div>

            <Button
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="h-12 w-full rounded-xl border-ink/15 bg-ink/5 text-ink hover:bg-ink/10 hover:text-ink"
            >
              {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon className="mr-2 h-4 w-4" />}
              Continue with Google
            </Button>

            <p className="mt-6 text-center text-sm text-ink/60">
              New to Inventra?{' '}
              <Link href="/signup" className="font-semibold text-sky-600 dark:text-sky-300 hover:text-sky-700 dark:hover:text-sky-200 hover:underline">
                Start your free trial
              </Link>
            </p>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink/35">
              <ShieldCheck className="h-3.5 w-3.5" /> Secured with Firebase Authentication
            </p>
    </AuthLayout>
  );
}