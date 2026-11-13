'use client';

/**
 * Layout for the legal pages (privacy, terms, refund). The text comes from the
 * Landing Page Editor (sanitized HTML) with a built-in default. Adds an
 * "On this page" jump list built from the document's headings.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { doc, onSnapshot } from 'firebase/firestore';
import { ArrowRight, CalendarDays, FileText, LifeBuoy, ReceiptText, ShieldCheck } from 'lucide-react';
import { db } from '@/lib/firebase';
import { sanitizeHtml } from '@/lib/sanitize-html';
import type { LandingPageContent } from '@/lib/types';
import { cn } from '@/lib/utils';

const POLICIES = [
  { href: '/privacy', label: 'Privacy policy', icon: ShieldCheck },
  { href: '/terms', label: 'Terms of service', icon: FileText },
  { href: '/refund', label: 'Refund policy', icon: ReceiptText },
];

type Field = 'privacyPolicyContent' | 'termsOfServiceContent' | 'refundPolicyContent';

const slug = (text: string, i: number) =>
  `${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section'}-${i}`;

export function LegalDocument({
  title, description, field, defaultHtml, lastUpdated, href,
}: {
  title: string;
  description: string;
  field: Field;
  defaultHtml: string;
  lastUpdated: string;
  href: string;
}) {
  const [html, setHtml] = useState(defaultHtml);
  const [toc, setToc] = useState<{ id: string; text: string }[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  const Icon = POLICIES.find((p) => p.href === href)?.icon ?? FileText;

  useEffect(() => {
    return onSnapshot(doc(db, 'site_content', 'landing_page'), (snap) => {
      const value = snap.exists() ? (snap.data() as LandingPageContent)[field] : '';
      // The Landing Page Editor starts these fields with a one-paragraph "…" placeholder;
      // if that's all that was saved, show the full built-in policy instead.
      const isPlaceholder = !!value && value.length < 500 && /\.\.\.\s*<\/p>\s*$/.test(value.trim());
      setHtml(value && !isPlaceholder ? sanitizeHtml(value) : defaultHtml);
    }, (error) => console.error(`Error loading ${field}:`, error));
  }, [field, defaultHtml]);

  // Build the jump list from the headings and highlight the one being read.
  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const headings = [...el.querySelectorAll('h2')];
    headings.forEach((h, i) => { h.id = slug(h.textContent || '', i); });
    setToc(headings.map((h) => ({ id: h.id, text: h.textContent || '' })));
    if (!headings.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-90px 0px -65% 0px' },
    );
    headings.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [html]);

  const date = new Date(lastUpdated).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
      {/* Title band */}
      <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-purple-600 text-white shadow-lg shadow-sky-500/25">
            <Icon className="h-7 w-7" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">Legal</p>
            <h1 className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
          </div>
        </div>
        <p className="mt-5 max-w-2xl text-ink/60">{description}</p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink/5 px-3 py-1.5 text-xs text-ink/60 ring-1 ring-ink/10">
          <CalendarDays className="h-3.5 w-3.5" /> Last updated {date}
        </p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_280px]">
        {/* Document */}
        <article
          ref={articleRef}
          className={cn(
            'animate-in fade-in slide-in-from-bottom-4 fill-mode-both delay-150 duration-700',
            'rounded-3xl bg-surface/80 p-6 shadow-xl shadow-black/5 ring-1 ring-ink/10 backdrop-blur sm:p-10',
            'prose prose-slate max-w-none dark:prose-invert',
            'prose-headings:scroll-mt-28 prose-headings:font-bold prose-headings:tracking-tight',
            'prose-h2:mt-10 prose-h2:border-t prose-h2:border-ink/10 prose-h2:pt-8 first:prose-h2:mt-0 first:prose-h2:border-0 first:prose-h2:pt-0',
            'prose-a:text-sky-600 dark:prose-a:text-sky-300 prose-li:marker:text-sky-500 prose-strong:text-ink',
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Side panel */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {toc.length > 1 && (
            <div className="hidden rounded-2xl bg-surface/70 p-5 ring-1 ring-ink/10 lg:block">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">On this page</p>
              <nav className="mt-3 space-y-1 border-l border-ink/10">
                {toc.map((t) => (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    className={cn(
                      '-ml-px block border-l-2 py-1 pl-3 text-sm transition',
                      active === t.id ? 'border-sky-500 font-medium text-ink' : 'border-transparent text-ink/55 hover:text-ink',
                    )}
                  >
                    {t.text}
                  </a>
                ))}
              </nav>
            </div>
          )}

          <div className="rounded-2xl bg-surface/70 p-5 ring-1 ring-ink/10">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/45">Policies</p>
            <ul className="mt-3 space-y-1">
              {POLICIES.map(({ href: h, label, icon: PIcon }) => (
                <li key={h}>
                  <Link
                    href={h}
                    className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition', h === href ? 'bg-ink/5 font-semibold text-ink' : 'text-ink/60 hover:bg-ink/5 hover:text-ink')}
                    aria-current={h === href ? 'page' : undefined}
                  >
                    <PIcon className="h-4 w-4" /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-sky-500/15 to-purple-600/15 p-5 ring-1 ring-sky-400/20">
            <LifeBuoy className="h-5 w-5 text-sky-600 dark:text-sky-300" />
            <p className="mt-3 font-semibold">Questions about this policy?</p>
            <p className="mt-1 text-sm text-ink/60">Our team is happy to explain anything here.</p>
            <Link href={`/contact?subject=${encodeURIComponent(`Question about our ${title}`)}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200">
              Contact us <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
