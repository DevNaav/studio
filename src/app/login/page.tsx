
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, Eye, EyeOff, Building } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Logo } from '@/components/ui/logo';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 1.96-4.66 1.96-3.88 0-7.04-3.16-7.04-7.04s3.16-7.04 7.04-7.04c2.28 0 4.07.88 4.96 1.76l2.54-2.54C19.6 1.96 16.46 0 12.48 0 5.88 0 .02 5.88.02 12.48s5.86 12.48 12.46 12.48c3.34 0 6.03-1.12 8.01-3.12 2.05-2.05 2.72-5.06 2.72-8.24 0-.76-.07-1.52-.2-2.26h-10.5z" />
    </svg>
);


export default function LoginPage() {
  const { user, logIn, signInWithGoogle, sendPasswordReset, authLoading } = useAuth();
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  
  useEffect(() => {
    if (user) {
      router.push('/app');
    }
  }, [user, router]);


  const onLoginSubmit = async (values: z.infer<typeof loginSchema>) => {
    if (isEmailLoading || isGoogleLoading) return;
    setIsEmailLoading(true);

    try {
      await logIn(values.email, values.password);
      router.push('/app');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message || 'An unexpected error occurred. Please check your credentials or internet connection.',
      });
    } finally {
      setIsEmailLoading(false);
    }
  };


  const handleGoogleSignIn = async () => {
    if (isEmailLoading || isGoogleLoading) return;
    setIsGoogleLoading(true);
    try {
        await signInWithGoogle();
    } catch (error: any) {
      // Error handling is inside the auth-context
    } finally {
        setIsGoogleLoading(false);
    }
  }

  const handleForgotPassword = async () => {
    const email = loginForm.getValues('email');
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Email Required',
        description: 'Please enter your email address in the email field first.',
      });
      loginForm.setFocus('email');
      return;
    }

    try {
      await sendPasswordReset(email);
      toast({
        title: 'Password Reset Email Sent',
        description: `An email has been sent to ${email} with instructions to reset your password.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Could not send password reset email. Please try again.',
      });
    }
  };
  
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (authLoading || user) {
      return (
          <div className="flex h-screen w-full items-center justify-center bg-background">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
      )
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4">
      <Image
        src="/login-bg.png"
        alt="Background"
        fill
        className="absolute inset-0 object-cover w-full h-full -z-10 brightness-50"
      />
      <div className="absolute inset-0 bg-black/30 -z-10" />
      <div className="mb-8 text-center z-10 flex items-center gap-3">
        <Logo />
        <h1 className="text-5xl font-bold text-white">Inventra</h1>
      </div>
      <Card id="login-card" className="w-full max-w-sm z-10 bg-card/80 backdrop-blur-sm shadow-soft">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome Back!</CardTitle>
          <CardDescription>Sign in to your account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <fieldset disabled={isEmailLoading || isGoogleLoading}>
                    <FormField control={loginForm.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input className="focus:ring-primary/80" type="email" placeholder="name@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={loginForm.control} name="password" render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Password</FormLabel>
                            <button type="button" className="text-xs text-primary hover:underline" onClick={handleForgotPassword}>
                              Forgot password?
                            </button>
                          </div>
                          <div className="relative">
                            <FormControl>
                                <Input 
                                    className="focus:ring-primary/80 pr-10" 
                                    type={showPassword ? 'text' : 'password'} 
                                    placeholder="••••••••" 
                                    {...field} 
                                />
                            </FormControl>
                            <Button 
                                type="button"
                                variant="ghost" 
                                size="icon" 
                                className="absolute inset-y-0 right-0 h-full px-3"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                    )} />
                </fieldset>
                <Button
                type="submit" 
                className="w-full !mt-6 text-primary-foreground font-bold"
                disabled={isEmailLoading || isGoogleLoading}
                aria-disabled={isEmailLoading}
                aria-busy={isEmailLoading}
                >
                    {isEmailLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isEmailLoading ? 'Signing In...' : 'Sign In'}
                </Button>
                </form>
            </Form>
            
            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                    </span>
                </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isEmailLoading || isGoogleLoading}>
                {isGoogleLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <GoogleIcon className="mr-2 h-4 w-4" />
                )}
                Sign in with Google
            </Button>
            <p className="mt-4 text-center text-xs text-muted-foreground">
                Don't have an account?{' '}
                <a href="#" className="underline" onClick={(e) => { e.preventDefault(); router.push('/signup'); }}>
                    Create one
                </a>
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
