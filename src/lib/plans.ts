/**
 * The single price list for Inventra. Every screen (website, onboarding, subscription,
 * payment) reads from here, and a payment server should too, so prices can't drift apart.
 *
 * Plan ids are what's stored on companies ("basic-annually" etc.), so they never change:
 * 'basic' is shown as "Growth" and 'premium' as "Business".
 */
import type { BillingCycle, Company, PlanId } from '@/lib/types';

export const TRIAL_DAYS = 30;
/** Larger teams talk to us (Enterprise). */
export const ENTERPRISE_CONTACT = '/contact';

export interface PlanDefinition {
  id: PlanId;
  name: string;
  blurb: string;
  monthly: number;   // Rs. per month (the amount charged)
  annually: number;  // Rs. per year (two months free)
  maxSites: number | null;  // active sites + manufacturing units; null = unlimited
  maxUsers: number;          // team members including the admin
  premiumFeatures: boolean;  // AI Assistant, AI document reading, Activity log
  highlighted?: boolean;
  features: string[];
}

export const PLANS: PlanDefinition[] = [
  {
    id: 'starter',
    name: 'Starter',
    blurb: 'For a contractor running one site.',
    monthly: 999,
    annually: 9999,
    maxSites: 1,
    maxUsers: 3,
    premiumFeatures: false,
    features: ['1 active site', 'Up to 3 users', 'Labour, attendance & payslips', 'Materials, expenses & machines', 'In-app alerts'],
  },
  {
    id: 'basic',
    name: 'Growth',
    blurb: 'For growing contractors running a few sites.',
    monthly: 2499,
    annually: 24999,
    maxSites: 5,
    maxUsers: 10,
    premiumFeatures: false,
    highlighted: true,
    features: ['Up to 5 active sites', 'Up to 10 users', 'Everything in Starter', 'Sales, customer ledger & statements', 'PDF reports & payslips'],
  },
  {
    id: 'premium',
    name: 'Business',
    blurb: 'For companies running many sites and units.',
    monthly: 5999,
    annually: 59999,
    maxSites: null,
    maxUsers: 50,
    premiumFeatures: true,
    features: ['Unlimited sites', 'Up to 50 users', 'Everything in Growth', 'Activity log (who changed what)', 'AI Assistant & AI document reading', 'Priority support'],
  },
];

export const planById = (id: PlanId | string | undefined | null): PlanDefinition | undefined =>
  PLANS.find(p => p.id === id);

export const priceFor = (plan: PlanDefinition, cycle: BillingCycle) => (cycle === 'annually' ? plan.annually : plan.monthly);

export const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** The plan whose limits apply right now. A trial gets the full Business plan. */
export function effectivePlan(company: Pick<Company, 'planId' | 'subscriptionStatus'> | undefined | null): PlanDefinition {
  if (!company || company.subscriptionStatus === 'Trial') return planById('premium')!;
  return planById(company.planId?.split('-')[0]) ?? planById('premium')!;
}
