
'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff, ArrowRight, User, Building2, Mail, Lock, Phone, Gift, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { AuthLayout, authInputClass } from '@/components/auth-layout';
import type { CharacterMood } from '@/components/login-character';

const countryCodes = [
  { code: '+91', name: 'India' },
  { code: '+1', name: 'United States' },
  { code: '+44', name: 'United Kingdom' },
  { code: '+61', name: 'Australia' },
  { code: '+81', name: 'Japan' },
  { code: '+49', name: 'Germany' },
  { code: '+33', name: 'France' },
  { code: '+86', name: 'China' },
  { code: '+7', name: 'Russia' },
  { code: '+55', name: 'Brazil' },
  { code: '+27', name: 'South Africa' },
  { code: '+971', name: 'United Arab Emirates' },
  { code: '+65', name: 'Singapore' },
];

const signUpSchema = z.object({
  name: z.string().min(2, { message: 'Please enter your name.' }),
  companyName: z.string().min(2, { message: 'Please enter your company name.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  countryCode: z.string({ required_error: 'Country code is required.' }),
  mobileNumber: z.string().min(5, { message: 'Please enter a valid mobile number.' }).regex(/^\d{5,15}$/, 'Mobile number must be between 5 and 15 digits.'),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});
type SignUpValues = z.infer<typeof signUpSchema>;
type Field = 'name' | 'companyName' | 'email' | 'mobileNumber' | 'password';

const FEATURES = [
  { icon: Gift, label: '2-month free trial' },
  { icon: Users, label: 'Invite your team' },
  { icon: Sparkles, label: 'AI assistant included' },
];

const firstWord = (s: string) => s.trim().split(/\s+/)[0] ?? '';

export default function SignUpPage() {
  const { user, signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<Field | null>(null);
  const [reaction, setReaction] = useState<'error' | 'success' | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const celebrating = useRef(false);
  const reactionTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', companyName: '', email: '', password: '', mobileNumber: '', countryCode: '+91' },
  });
  const values = form.watch();

  // Already signed in: go to the app (unless the success animation is playing).
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
    reaction ??
    (focused === 'password' ? (showPassword ? 'peek' : 'password') : focused ? 'email' : 'idle');

  const name = firstWord(values.name || '');
  const company = (values.companyName || '').trim();
  const bubble = (() => {
    if (reaction === 'error') return 'A few details need a quick fix ✍️';
    if (reaction === 'success') return `Welcome aboard${name ? `, ${name}` : ''}! 🎉 Setting things up…`;
    switch (focused) {
      case 'name': return name.length >= 2 ? `Nice to meet you, ${name}! 👋` : "Hi! What's your name?";
      case 'companyName':
        if (company.length < 2) return 'Which company are you building?';
        return company.length > 22 ? 'What a great company name! 🏗️' : `${company}, great name! 🏗️`;
      case 'email': return 'Where should we send your updates? 📬';
      case 'mobileNumber': return 'Only for important alerts, promise 📱';
      case 'password': return showPassword ? 'Oops… I might have peeked 👀' : "Make it strong — I won't look 🙈";
      default: return "Let's set up your workspace in a minute!";
    }
  })();

  const focusedLength = focused && focused !== 'password' ? String(values[focused] ?? '').length : 0;

  const onSubmit = async (v: SignUpValues) => {
    setIsLoading(true);
    try {
      celebrating.current = true;
      await signUp(v.email, v.password, v.name, v.companyName, `${v.countryCode}${v.mobileNumber}`);
      setFocused(null);
      react('success', 5000);
      setTimeout(() => router.push('/app'), 1200); // let the celebration play
    } catch (error: any) {
      celebrating.current = false;
      react('error', 1800);
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: error.message || 'An unexpected error occurred. Please try again.',
      });
      setIsLoading(false);
    }
  };

  const focusProps = (field: Field, onBlur: () => void) => ({
    onFocus: () => setFocused(field),
    onBlur: () => { onBlur(); setFocused(f => (f === field ? null : f)); },
  });

  const iconClass = 'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40';

  return (
    <AuthLayout
      mood={mood}
      typingProgress={Math.min(focusedLength / 24, 1)}
      bubble={bubble}
      headline={<>Start building{' '}<span className="bg-gradient-to-r from-sky-600 via-cyan-500 to-purple-600 dark:from-sky-400 dark:via-cyan-300 dark:to-purple-400 bg-clip-text text-transparent">smarter</span> today.</>}
      subline="Create your company workspace in under a minute. No card needed for the free trial."
      features={FEATURES}
      title="Create your account"
      description="Start your 2-month free trial."
      shakeKey={shakeKey}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, () => react('error', 1500))} className="mt-7 space-y-4">
          <fieldset disabled={isLoading} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-ink/80">Your name</FormLabel>
                  <div className="relative">
                    <User className={iconClass} />
                    <FormControl>
                      <Input placeholder="John Doe" autoComplete="name" className={authInputClass} {...field} {...focusProps('name', field.onBlur)} />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-ink/80">Company</FormLabel>
                  <div className="relative">
                    <Building2 className={iconClass} />
                    <FormControl>
                      <Input placeholder="Acme Construction" autoComplete="organization" className={authInputClass} {...field} {...focusProps('companyName', field.onBlur)} />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-ink/80">Work email</FormLabel>
                <div className="relative">
                  <Mail className={iconClass} />
                  <FormControl>
                    <Input type="email" placeholder="name@company.com" autoComplete="email" className={authInputClass} {...field} {...focusProps('email', field.onBlur)} />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <FormItem>
              <FormLabel className="text-ink/80">Mobile number</FormLabel>
              <div className="flex gap-2">
                <FormField control={form.control} name="countryCode" render={({ field }) => (
                  <FormItem className="w-[132px] shrink-0">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl border-ink/10 bg-ink/5 text-ink focus:ring-sky-400/60">
                          <SelectValue placeholder="Code" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {countryCodes.map(({ code, name }) => (
                          <SelectItem key={code} value={code}>{code} ({name})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="mobileNumber" render={({ field }) => (
                  <FormItem className="flex-1">
                    <div className="relative">
                      <Phone className={iconClass} />
                      <FormControl>
                        <Input inputMode="numeric" autoComplete="tel-national" placeholder="9876543210" className={authInputClass} {...field} {...focusProps('mobileNumber', field.onBlur)} />
                      </FormControl>
                    </div>
                  </FormItem>
                )} />
              </div>
              <FormMessage>{form.formState.errors.mobileNumber?.message}</FormMessage>
            </FormItem>

            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-ink/80">Password</FormLabel>
                <div className="relative">
                  <Lock className={iconClass} />
                  <FormControl>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                      className={`${authInputClass} pr-11`}
                      {...field}
                      {...focusProps('password', field.onBlur)}
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
            disabled={isLoading}
            aria-busy={isLoading}
            className="group !mt-6 h-12 w-full rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 text-base font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:brightness-110"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoading ? 'Creating your workspace…' : 'Create account'}
            {!isLoading && <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />}
          </Button>
        </form>
      </Form>

      <p className="mt-6 text-center text-sm text-ink/60">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-sky-600 dark:text-sky-300 hover:text-sky-700 dark:hover:text-sky-200 hover:underline">
          Sign in
        </Link>
      </p>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink/35">
        <ShieldCheck className="h-3.5 w-3.5" /> Secured with Firebase Authentication
      </p>
    </AuthLayout>
  );
}
