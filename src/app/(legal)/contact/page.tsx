'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { addDoc, collection, doc, onSnapshot } from 'firebase/firestore';
import {
  ArrowRight, Briefcase, Building2, CheckCircle2, Copy, Handshake, LifeBuoy, Loader2, Mail, MapPin,
  MessageSquare, Phone, Send, User,
} from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { LandingPageContent } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Contact details shown on the page. Leave phone/address empty until you have
 * real ones — empty values are simply not shown.
 */
const CONTACT = {
  email: 'support@inventra.com',
  phone: '', // e.g. '+91 98765 43210'
  address: '', // e.g. 'Office address, City, State'
};

const REASONS = [
  { value: 'Sales', label: 'Sales & demo', icon: Briefcase },
  { value: 'Support', label: 'Support', icon: LifeBuoy },
  { value: 'Partnership', label: 'Partnership', icon: Handshake },
  { value: 'Other', label: 'Something else', icon: MessageSquare },
] as const;

const contactFormSchema = z.object({
  name: z.string().min(1, 'Full name is required.').max(100),
  email: z.string().email('Please enter a valid email address.').max(200),
  company: z.string().max(200).optional(),
  subject: z.string().min(1, 'Subject is required.').max(200),
  reason: z.enum(['Sales', 'Support', 'Partnership', 'Other']).optional(),
  message: z.string().min(20, 'Message must be at least 20 characters long.').max(5000, 'Message is too long (max 5000 characters).'),
  // Hidden "honeypot" field: real visitors never see or fill it; spam bots usually do.
  website: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

const inputClass = 'h-12 rounded-xl border-ink/10 bg-ink/[0.03] text-ink placeholder:text-ink/35 focus-visible:ring-sky-400/60';
const iconClass = 'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40';

export default function ContactPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [content, setContent] = useState({
    title: 'Get in Touch',
    subtitle: 'We’d love to hear from you. Tell us about your sites and we’ll get back to you.',
  });

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { name: '', email: '', company: '', subject: '', reason: 'Sales', message: '', website: '' },
  });
  const messageLength = form.watch('message')?.length ?? 0;
  const reason = form.watch('reason');

  // Prefill the subject when arriving from an "Ask about …" link (?subject=...).
  useEffect(() => {
    const subject = new URLSearchParams(window.location.search).get('subject');
    if (subject) form.setValue('subject', subject.slice(0, 200));
  }, [form]);

  // Title/subtitle from the Contact Page Editor (defaults show immediately).
  useEffect(() => {
    return onSnapshot(doc(db, 'site_content', 'landing_page'), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as LandingPageContent;
      setContent((c) => ({ title: data.contactTitle || c.title, subtitle: data.contactSubtitle || c.subtitle }));
    }, (error) => console.error('Error loading contact content:', error));
  }, []);

  async function onSubmit(values: ContactFormValues) {
    setIsSubmitting(true);
    try {
      // Bots fill the hidden field; pretend success without saving anything.
      if (!values.website) {
        await addDoc(collection(db, 'contact_messages'), {
          name: values.name,
          email: values.email,
          company: values.company || '',
          subject: values.subject,
          reason: values.reason || 'Other',
          message: values.message,
          status: 'New',
          createdAt: new Date().toISOString(),
        });
      }
      setIsSuccess(true);
      form.reset();
    } catch (error) {
      console.error('Contact form submission failed:', error);
      toast({ variant: 'destructive', title: 'Message not sent', description: `Something went wrong. Please email us at ${CONTACT.email} instead.` });
    } finally {
      setIsSubmitting(false);
    }
  }

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard not available */ }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
      {/* Title */}
      <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 fill-mode-both text-center duration-700">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">Contact</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{content.title}</h1>
        <p className="mt-4 text-lg text-ink/60">{content.subtitle}</p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        {/* Left: ways to reach us */}
        <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both space-y-5 delay-100 duration-700">
          <div className="rounded-3xl bg-surface/80 p-6 shadow-xl shadow-black/5 ring-1 ring-ink/10 backdrop-blur">
            <p className="text-sm font-semibold">Reach us directly</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-2xl bg-ink/[0.03] p-3 ring-1 ring-ink/5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300"><Mail className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink/50">Email</p>
                  <a href={`mailto:${CONTACT.email}`} className="block truncate font-medium hover:text-sky-600 dark:hover:text-sky-300">{CONTACT.email}</a>
                </div>
                <button type="button" onClick={copyEmail} className="rounded-lg p-2 text-ink/50 transition hover:bg-ink/5 hover:text-ink" aria-label="Copy email address">
                  {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              {CONTACT.phone && (
                <a href={`tel:${CONTACT.phone.replace(/\s+/g, '')}`} className="flex items-center gap-3 rounded-2xl bg-ink/[0.03] p-3 ring-1 ring-ink/5 transition hover:ring-sky-400/40">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"><Phone className="h-5 w-5" /></span>
                  <div><p className="text-xs text-ink/50">Phone</p><p className="font-medium">{CONTACT.phone}</p></div>
                </a>
              )}
              {CONTACT.address && (
                <div className="flex items-center gap-3 rounded-2xl bg-ink/[0.03] p-3 ring-1 ring-ink/5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-300"><MapPin className="h-5 w-5" /></span>
                  <div><p className="text-xs text-ink/50">Office</p><p className="font-medium">{CONTACT.address}</p></div>
                </div>
              )}
            </div>
          </div>

          {[
            { icon: Briefcase, tone: 'bg-sky-500/15 text-sky-600 dark:text-sky-300', title: 'See Inventra on your sites', text: 'Book a walkthrough tailored to your projects, team size and modules.' },
            { icon: LifeBuoy, tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300', title: 'Already a customer?', text: 'Open a ticket from Help & Support inside the app to track it from start to finish.' },
            { icon: Handshake, tone: 'bg-purple-500/15 text-purple-600 dark:text-purple-300', title: 'Partners & resellers', text: 'Suppliers, consultants and integrators — let’s build something together.' },
          ].map(({ icon: Icon, tone, title, text }) => (
            <div key={title} className="flex gap-4 rounded-2xl bg-surface/60 p-5 ring-1 ring-ink/10">
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone)}><Icon className="h-5 w-5" /></span>
              <div><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-ink/60">{text}</p></div>
            </div>
          ))}

          <p className="px-1 text-sm text-ink/50">
            Looking for answers fast? Check the <Link href="/#faq" className="font-medium text-sky-600 hover:underline dark:text-sky-300">FAQ</Link> or start a{' '}
            <Link href="/signup" className="font-medium text-sky-600 hover:underline dark:text-sky-300">free trial</Link>.
          </p>
        </div>

        {/* Right: form */}
        <div className="order-first animate-in fade-in slide-in-from-bottom-4 fill-mode-both delay-200 duration-700 lg:order-none">
          <div className="rounded-3xl bg-surface/80 p-6 shadow-xl shadow-black/5 ring-1 ring-ink/10 backdrop-blur sm:p-8">
            {isSuccess ? (
              <div className="flex flex-col items-center py-12 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                  <CheckCircle2 className="h-9 w-9" />
                </span>
                <h2 className="mt-5 text-2xl font-bold">Message sent!</h2>
                <p className="mt-2 max-w-sm text-ink/60">Thanks for reaching out. We’ll reply to your email as soon as we can.</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => setIsSuccess(false)} className="inline-flex h-11 items-center justify-center rounded-xl bg-ink/5 px-5 text-sm font-semibold ring-1 ring-ink/10 transition hover:bg-ink/10">
                    Send another message
                  </button>
                  <Link href="/" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 px-5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:brightness-110">
                    Back to home <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="relative space-y-5">
                  <div>
                    <p className="mb-2.5 text-sm font-medium text-ink/80">What can we help with?</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Reason for contact">
                      {REASONS.map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={reason === value}
                          onClick={() => form.setValue('reason', value)}
                          className={cn(
                            'flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium ring-1 transition',
                            reason === value
                              ? 'bg-sky-500/10 text-sky-700 ring-sky-500/50 dark:text-sky-200'
                              : 'bg-ink/[0.03] text-ink/60 ring-ink/10 hover:text-ink hover:ring-ink/20',
                          )}
                        >
                          <Icon className="h-4 w-4" /> {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-ink/80">Full name</FormLabel>
                        <div className="relative"><User className={iconClass} />
                          <FormControl><Input placeholder="Your name" autoComplete="name" className={cn(inputClass, 'pl-10')} {...field} /></FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-ink/80">Email</FormLabel>
                        <div className="relative"><Mail className={iconClass} />
                          <FormControl><Input type="email" placeholder="you@company.com" autoComplete="email" className={cn(inputClass, 'pl-10')} {...field} /></FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField control={form.control} name="company" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-ink/80">Company <span className="text-ink/40">(optional)</span></FormLabel>
                        <div className="relative"><Building2 className={iconClass} />
                          <FormControl><Input placeholder="Your company" autoComplete="organization" className={cn(inputClass, 'pl-10')} {...field} /></FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="subject" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-ink/80">Subject</FormLabel>
                        <FormControl><Input placeholder="What’s it about?" className={inputClass} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="message" render={({ field }) => (
                    <FormItem>
                      <div className="flex items-baseline justify-between">
                        <FormLabel className="text-ink/80">Message</FormLabel>
                        <span className={cn('text-xs', messageLength > 5000 ? 'text-red-500' : 'text-ink/40')}>{messageLength}/5000</span>
                      </div>
                      <FormControl>
                        <Textarea rows={6} placeholder="Tell us about your sites, team size, or what you need help with…" className="rounded-xl border-ink/10 bg-ink/[0.03] text-ink placeholder:text-ink/35 focus-visible:ring-sky-400/60" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Spam trap (hidden from people) */}
                  <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                    <label>Website<input type="text" tabIndex={-1} autoComplete="off" {...form.register('website')} /></label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:brightness-110 disabled:opacity-70"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                    {isSubmitting ? 'Sending…' : 'Send message'}
                  </button>
                  <p className="text-center text-xs text-ink/40">We only use your details to reply to this message.</p>
                </form>
              </Form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
