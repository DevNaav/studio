'use client';

/**
 * Shared layout for the login and sign-up pages: dark blueprint background,
 * "Back to home" button, the interactive 3D character with a speech bubble,
 * a short pitch, and a glass card holding the form.
 */
import dynamic from 'next/dynamic';
import { usePublicTheme } from '@/lib/theme';
import Link from 'next/link';
import { ArrowLeft, Loader2, type LucideIcon } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import type { CharacterMood } from '@/components/login-character';

// three.js only runs in the browser; load the 3D scene lazily.
const LoginCharacter = dynamic(() => import('@/components/login-character'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-sky-400/70" />
    </div>
  ),
});

interface AuthLayoutProps {
  mood: CharacterMood;
  /** 0–1, makes the character's head follow along while typing. */
  typingProgress: number;
  bubble: string;
  headline: React.ReactNode;
  subline: string;
  features: { icon: LucideIcon; label: string }[];
  /** Card heading and sub-heading. */
  title: string;
  description: string;
  /** Increment to shake the card (e.g. on an error). */
  shakeKey: number;
  children: React.ReactNode;
}

export function AuthLayout({
  mood, typingProgress, bubble, headline, subline, features, title, description, shakeKey, children,
}: AuthLayoutProps) {
  // Light or dark, following the device (or the user's saved choice).
  const { themeClass } = usePublicTheme();
  return (
    <div className={cn(themeClass, 'relative min-h-screen overflow-clip bg-page text-ink')}>
      {/* Background: blueprint grid + drifting colour glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <div aria-hidden className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-sky-500/25 blur-[110px] animate-drift" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-[28rem] w-[28rem] rounded-full bg-purple-600/25 blur-[120px] animate-drift [animation-delay:-7s]" />

      <Link
        href="/"
        className="absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-full bg-ink/5 px-4 py-2 text-sm font-medium text-ink/90 ring-1 ring-ink/15 backdrop-blur-md transition hover:bg-ink/10 sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>

      <main className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-6 px-4 pb-10 pt-20 lg:grid-cols-2 lg:gap-12 lg:py-10">
        {/* Character + intro */}
        <section className="flex flex-col items-center text-center lg:sticky lg:top-10 lg:items-start lg:text-left">
          <div className="relative mx-auto h-[290px] w-full max-w-md sm:h-[340px] lg:mx-0 lg:mb-6 lg:h-[470px]">
            {/* Outer layer centres the bubble; inner layer animates (both use transform). */}
            <div className="absolute inset-x-0 top-0 z-10 flex justify-center px-2">
              <div
                key={bubble}
                role="status"
                aria-live="polite"
                className={cn(
                  'relative max-w-full animate-bubble-in rounded-2xl px-4 py-2 text-center text-sm font-medium shadow-lg ring-1 backdrop-blur-md sm:whitespace-nowrap',
                  mood === 'error' ? 'bg-red-500/15 text-red-700 dark:text-red-200 ring-red-400/40'
                    : mood === 'success' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 ring-emerald-400/40'
                    : 'bg-ink/10 text-ink ring-ink/20',
                )}
              >
                {bubble}
              </div>
            </div>
            {/* 3D view sits below the speech bubble so the bubble never covers the head */}
            <div className="absolute inset-x-0 bottom-0 top-11">
              <LoginCharacter mood={mood} emailProgress={typingProgress} />
            </div>
          </div>

          <div className="hidden lg:block">
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight">{headline}</h2>
            <p className="mt-3 max-w-md text-ink/60">{subline}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {features.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-2 rounded-full bg-ink/5 px-3 py-1.5 text-xs text-ink/80 ring-1 ring-ink/10">
                  <Icon className="h-3.5 w-3.5 text-sky-600 dark:text-sky-300" /> {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Form card */}
        <section className="flex justify-center lg:justify-end">
          <div
            key={shakeKey}
            className={cn(
              'w-full max-w-md rounded-3xl bg-surface/80 dark:bg-white/[0.06] p-7 shadow-2xl shadow-black/40 ring-1 ring-ink/10 backdrop-blur-xl sm:p-9',
              shakeKey > 0 && 'animate-shake',
            )}
          >
            <Link href="/" aria-label="Inventra home" className="mb-7 inline-flex items-center gap-4 transition-opacity hover:opacity-90">
              <Logo className="h-16 w-16 rounded-2xl p-1.5" priority />
              <span className="text-3xl font-extrabold tracking-tight">Inventra</span>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-ink/60">{description}</p>
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}

/** Shared input styling for the dark auth forms. */
export const authInputClass =
  'h-12 rounded-xl border-ink/10 bg-ink/5 pl-10 text-ink placeholder:text-ink/30 focus-visible:ring-sky-400/60';
