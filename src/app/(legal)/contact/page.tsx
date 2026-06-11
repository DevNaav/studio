
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Building, Send, FileUp, Phone, MapPin } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LandingPageContent } from '@/lib/types';


const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const contactFormSchema = z.object({
  name: z.string().min(1, 'Full name is required.'),
  email: z.string().email('Please enter a valid email address.'),
  company: z.string().optional(),
  subject: z.string().min(1, 'Subject is required.'),
  reason: z.enum(['Sales', 'Support', 'Partnership', 'Other']).optional(),
  message: z.string().min(20, 'Message must be at least 20 characters long.'),
  file: z.any()
    .optional()
    .refine((files) => !files || files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (files) => !files || files?.[0]?.type === undefined || ACCEPTED_FILE_TYPES.includes(files?.[0]?.type),
      'Only .pdf, .doc, .docx, .jpg, and .png files are accepted.'
    ),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function ContactPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [content, setContent] = useState({
    title: 'Get in Touch',
    subtitle: 'We’d love to hear from you. Please fill out the form below.'
  });
  const [loading, setLoading] = useState(true);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      company: '',
      subject: '',
      message: '',
      file: undefined,
    },
  });
  
  useEffect(() => {
    const docRef = doc(db, 'site_content', 'landing_page');
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as LandingPageContent;
        setContent({
          title: data.contactTitle || 'Get in Touch',
          subtitle: data.contactSubtitle || 'We’d love to hear from you. Please fill out the form below.'
        });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function onSubmit(values: ContactFormValues) {
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // In a real app, you would handle file upload here and get a URL.
    // For now, we'll just log the file name.
    const payload = {
      ...values,
      fileUrl: values.file?.[0]?.name ? `uploads/${values.file[0].name}` : undefined,
    };
    delete (payload as any).file;

    console.log('Form Submitted. API Payload:', JSON.stringify(payload, null, 2));

    setIsSubmitting(false);
    setIsSuccess(true);
    form.reset();
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-16 sm:py-24">
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground">{content.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{content.subtitle}</p>
      </div>

      <Card className="bg-card/50 border border-white/10 p-6 sm:p-8 shadow-lg backdrop-blur-sm rounded-2xl">
        <CardContent className="p-0">
          {isSuccess ? (
            <div className="text-center rounded-lg bg-primary/10 border border-primary/20 p-8">
              <h3 className="text-2xl font-bold text-primary-foreground">Thank You!</h3>
              <p className="mt-2 text-muted-foreground">Your message has been sent successfully. We will get back to you shortly.</p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Your Name" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="company" render={({ field }) => (
                  <FormItem><FormLabel>Company (Optional)</FormLabel><FormControl><Input placeholder="Your Company" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField control={form.control} name="subject" render={({ field }) => (
                    <FormItem><FormLabel>Subject</FormLabel><FormControl><Input placeholder="Inquiry about..." {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="reason" render={({ field }) => (
                    <FormItem><FormLabel>Reason for Contact</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Sales">Sales Inquiry</SelectItem>
                        <SelectItem value="Support">Technical Support</SelectItem>
                        <SelectItem value="Partnership">Partnership</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="message" render={({ field }) => (
                  <FormItem><FormLabel>Message</FormLabel><FormControl><Textarea rows={6} placeholder="Your message..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="file" render={({ field: { onChange, ...fieldProps } }) => (
                  <FormItem><FormLabel>Attachment (Optional)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <FileUp className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input type="file" className="pl-10" onChange={(e) => onChange(e.target.files)} {...fieldProps} />
                    </div>
                  </FormControl><FormMessage /></FormItem>
                )} />

                <div className="text-center pt-4">
                  <div className="text-xs text-muted-foreground mb-4">This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.</div>
                  <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send Message
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
      
      <div className="mt-16 text-center text-muted-foreground">
        <h3 className="font-semibold text-lg text-foreground">Contact Alternatives</h3>
        <div className="mt-4 flex flex-col sm:flex-row justify-center items-center gap-x-8 gap-y-2 text-sm">
            <a href="mailto:support@inventra.com" className="flex items-center gap-2 hover:text-foreground transition-colors"><Mail className="h-4 w-4"/> support@inventra.com</a>
            <a href="tel:+1234567890" className="flex items-center gap-2 hover:text-foreground transition-colors"><Phone className="h-4 w-4"/> +1 (234) 567-890</a>
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4"/> 123 Innovation Dr, Tech City</p>
        </div>
      </div>
    </div>
  );
}
