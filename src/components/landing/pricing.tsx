'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ENTERPRISE_CONTACT, PLANS, TRIAL_DAYS, inr } from '@/lib/plans';

// Plans and prices come from src/lib/plans.ts (the same list the app and payments use).

export function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <div>
      <div className="mx-auto mb-10 flex w-fit items-center gap-1 rounded-full bg-ink/5 p-1 ring-1 ring-ink/10">
        {[
          { label: 'Monthly', value: false },
          { label: 'Annually', value: true },
        ].map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => setAnnual(opt.value)}
            className={cn(
              'rounded-full px-5 py-2 text-sm font-medium transition',
              annual === opt.value ? 'bg-ink text-page shadow' : 'text-ink/70 hover:text-ink',
            )}
            aria-pressed={annual === opt.value}
          >
            {opt.label}
            {opt.value && <span className="ml-1.5 text-xs text-emerald-600 dark:text-emerald-400">2 months free</span>}
          </button>
        ))}
      </div>

      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              'relative flex flex-col rounded-3xl p-8 ring-1 transition hover:-translate-y-1',
              plan.highlighted
                ? 'bg-gradient-to-b from-sky-500/15 to-purple-600/10 ring-sky-400/40 shadow-2xl shadow-sky-500/10'
                : 'bg-ink/[0.04] ring-ink/10',
            )}
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-8 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-500 to-purple-600 px-3 py-1 text-xs font-semibold text-white">
                <Sparkles className="h-3 w-3" /> Most popular
              </span>
            )}
            <h3 className="text-xl font-bold">{plan.name}</h3>
            <p className="mt-1 text-sm text-ink/55">{plan.blurb}</p>
            <p className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold tracking-tight">{inr(annual ? plan.annually : plan.monthly)}</span>
              <span className="text-sm text-ink/50">/{annual ? 'year' : 'month'} + GST</span>
            </p>
            {annual && <p className="mt-1 text-xs text-ink/40">≈ {inr(Math.round(plan.annually / 12))} per month, 2 months free</p>}
            <ul className="mt-6 flex-1 space-y-3 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-ink/80">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className={cn(
                'mt-8 inline-flex h-12 items-center justify-center rounded-xl text-sm font-semibold transition',
                plan.highlighted
                  ? 'bg-gradient-to-r from-sky-500 to-purple-600 text-white shadow-lg shadow-sky-500/25 hover:brightness-110'
                  : 'bg-ink/10 text-ink hover:bg-ink/15',
              )}
            >
              Start {TRIAL_DAYS}-day free trial
            </Link>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-ink/50">
        Every new company gets a {TRIAL_DAYS}-day free trial with everything in Business. No card needed. Prices exclude 18% GST.
      </p>
      <p className="mt-2 text-center text-sm text-ink/70">
        More than 50 users or need something custom?{' '}
        <Link href={ENTERPRISE_CONTACT} className="font-semibold underline underline-offset-4 hover:text-ink">Talk to us about Enterprise</Link>
      </p>
    </div>
  );
}
