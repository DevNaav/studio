
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Logo } from '@/components/ui/logo';

const countryCodes = [
    { code: "+91", name: "India" },
    { code: "+1", name: "United States" },
    { code: "+44", name: "United Kingdom" },
    { code: "+61", name: "Australia" },
    { code: "+81", name: "Japan" },
    { code: "+49", name: "Germany" },
    { code: "+33", name: "France" },
    { code: "+86", name: "China" },
    { code: "+7", name: "Russia" },
    { code: "+55", name: "Brazil" },
    { code: "+27", name: "South Africa" },
    { code: "+971", name: "United Arab Emirates" },
    { code: "+65", name: "Singapore" },
];

const signUpSchema = z.object({
  name: z.string().min(2, { message: 'Please enter your name.' }),
  companyName: z.string().min(2, { message: 'Please enter your company name.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  countryCode: z.string({ required_error: 'Country code is required.'}),
  mobileNumber: z.string().min(5, { message: 'Please enter a valid mobile number.' }).regex(/^\d{5,15}$/, 'Mobile number must be between 5 and 15 digits.'),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});


export default function SignUpPage() {
  const { user, signUp, authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useState(() => {
    if (user) {
        router.push('/app');
    }
  });

  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', companyName: '', email: '', password: '', mobileNumber: '', countryCode: '+91' },
  });

  const onSubmit = async (values: z.infer<typeof signUpSchema>) => {
    setIsLoading(true);
    try {
      await signUp(values.email, values.password, values.name, values.companyName, `${values.countryCode}${values.mobileNumber}`);
      router.push('/app');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: error.message || 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (authLoading || user) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
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
          <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
          <CardDescription>Get started with Inventra for free.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <fieldset disabled={isLoading}>
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Your Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="companyName" render={({ field }) => (
                        <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input placeholder="Acme Construction" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="name@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormItem>
                        <FormLabel>Mobile Number</FormLabel>
                        <div className="flex gap-2">
                          <FormField
                            control={form.control}
                            name="countryCode"
                            render={({ field }) => (
                                <FormItem className="w-28">
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Code" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {countryCodes.map(({ code, name }) => (
                                                <SelectItem key={code} value={code}>
                                                    {code} ({name})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name="mobileNumber"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormControl>
                                    <Input
                                        placeholder="Your mobile number"
                                        {...field}
                                    />
                                    </FormControl>
                                </FormItem>
                            )}
                            />
                        </div>
                        <FormMessage>{form.formState.errors.mobileNumber?.message}</FormMessage>
                    </FormItem>
                    <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Password</FormLabel>
                            <div className="relative">
                                <FormControl>
                                    <Input 
                                        type={showPassword ? 'text' : 'password'} 
                                        placeholder="••••••••" 
                                        {...field}
                                        className="pr-10"
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
                    className={cn(
                        "w-full !mt-6 text-primary-foreground font-bold",
                    )}
                    disabled={isLoading}
                  >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Account
                  </Button>
                </form>
            </Form>
            
            <p className="mt-4 text-center text-xs text-muted-foreground">
                Already have an account?{' '}
                <a href="#" className="underline" onClick={(e) => { e.preventDefault(); router.push('/login'); }}>
                    Sign in
                </a>
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
