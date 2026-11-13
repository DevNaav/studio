'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// Same plans and prices as the in-app subscription page.
const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    blurb: 'For growing contractors running a few sites.',
    monthly: 2999,
    annually: 29999,
    features: ['Up to 5 sites', 'Up to 10 users', 'Labor, inventory, machines & expenses', 'PDF reports', 'Email support'],
  },
  {
    id: 'premium',
    name: 'Premium',
    blurb: 'For companies running many sites and units.',
    monthly: 5999,
    annually: 59999,
    highlighted: true,
    features: ['Unlimited sites', 'Unlimited users', 'Every module included', 'AI Assistant & AI document reading', 'Priority support'],
  },
];

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

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
            {opt.value && <span className="ml-1.5 text-xs text-emerald-600 dark:text-emerald-400">save ~17%</span>}
          </button>
        ))}
      </div>

      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
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
                <Sparkles className="h-3 w-3" /> Includes AI
              </span>
            )}
            <h3 className="text-xl font-bold">{plan.name}</h3>
            <p className="mt-1 text-sm text-ink/55">{plan.blurb}</p>
            <p className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold tracking-tight">{inr(annual ? plan.annually : plan.monthly)}</span>
              <span className="text-sm text-ink/50">/{annual ? 'year' : 'month'}</span>
            </p>
            {annual && <p className="mt-1 text-xs text-ink/40">≈ {inr(Math.round(plan.annually / 12))} per month</p>}
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
              Start 2-month free trial
            </Link>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-ink/40">Every new company starts with a free 2-month trial with all Premium features.</p>
    </div>
  );
}
