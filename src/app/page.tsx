'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { doc, onSnapshot } from 'firebase/firestore';
import * as LucideIcons from 'lucide-react';
import {
  ArrowRight, Check, Construction, Loader2, Linkedin, Twitter, Building2, HardHat, Boxes, Truck,
  ReceiptIndianRupee, Factory, FileText, Users, ShieldCheck, Sparkles, Bot, ScanText, ShieldAlert,
  CalendarCheck, AlertTriangle, IndianRupee, Wand2, Rocket, ClipboardList, Wrench,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { LandingPageContent } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Reveal } from '@/components/landing/reveal';
import { ProductPreview } from '@/components/landing/product-preview';
import { Pricing } from '@/components/landing/pricing';
import { cn } from '@/lib/utils';
import { SiteShell } from '@/components/landing/site-shell';
import type { CharacterMood } from '@/components/login-character';

// Interactive 3D character (browser only).
const Character3D = dynamic(() => import('@/components/login-character'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-sky-400/70" />
    </div>
  ),
});

// Icons chosen by name in the Landing Page Editor
const getIcon = (name: string) => {
  const Icon = (LucideIcons as any)[name];
  return Icon ? <Icon className="h-6 w-6" /> : <Construction className="h-6 w-6" />;
};

const defaultContent: LandingPageContent = {
  heroTitle: 'Inventra — Construction & Manufacturing Management, Reimagined',
  heroSubtitle: 'A unified, multi-tenant platform to manage sites, track inventory, run production, streamline finances and get AI-powered insights — all from one secure dashboard.',
  aboutTitle: 'About Inventra',
  aboutDescription: 'Inventra combines construction site management and manufacturing operations into a single platform. We help businesses reduce material waste, improve labour utilisation and accelerate delivery timelines by connecting field data, inventory control and financial workflows.',
  aboutImageUrl: '/login-bg.png',
  features: [
    { icon: 'Construction', title: 'Unified Site Management', text: 'Oversee multiple construction sites and manufacturing units from a single, intuitive dashboard.' },
    { icon: 'Warehouse', title: 'Real-Time Inventory', text: 'Track materials from warehouse to worksite, manage stock levels, and get low-stock alerts.' },
    { icon: 'Bot', title: 'AI-Powered Insights', text: 'Leverage our AI Assistant to analyze project data, model threats, and extract insights from documents.' },
  ],
  solutions: [
    { title: 'Site Management', desc: 'Tasks, schedules, permits & safety checklists' },
    { title: 'Field App', desc: 'Mobile reporting, attendance and asset scanning' },
    { title: 'Inventory & BOM', desc: 'Stock, warehouses, transfers & procurement' },
    { title: 'Manufacturing', desc: 'Work orders, routing, and production planning' },
    { title: 'Analytics', desc: 'Dashboards, KPIs, cost & timeline forecasting' },
    { title: 'Finance', desc: 'Estimates, invoices, payroll & supplier payments' },
    { title: 'AI Tools', desc: 'Document analysis, risk detection & automated insights' },
    { title: 'Integrations', desc: 'APIs, ERPs, accounting systems & IoT sensors' },
  ],
  team: [
    { name: 'Abhinav Goyal', role: 'Co-Founder', imageUrl: '/team/member1.jpg', bio: 'Abhinav leads product and engineering with a passion for building scalable and user-centric solutions.', linkedin: '#', twitter: '#' },
    { name: 'Hardik Bansal', role: 'Co-Founder', imageUrl: '/team/member2.jpg', bio: 'Hardik drives business strategy and customer success, ensuring our partners achieve their goals.', linkedin: '#', twitter: '#' },
  ],
  ctaTitle: 'Ready to streamline your projects?',
  ctaSubtitle: 'Get a personalized demo and see how Inventra can reduce costs and accelerate delivery.',
  privacyPolicyContent: '',
  termsOfServiceContent: '',
  refundPolicyContent: '',
};

// Real modules from the app, shown as a bento grid.
const MODULES = [
  {
    icon: Building2, title: 'Sites & projects', span: 'lg:col-span-2',
    text: 'Construction sites and manufacturing units side by side — tasks, site summaries, completion, defect liability and warranty tracking.',
    visual: 'sites',
  },
  { icon: HardHat, title: 'Labour & attendance', text: 'Daily attendance, wage and contract labour, food-cost splitting, payments ledger and ID proofs.' },
  { icon: Boxes, title: 'Inventory & warehouse', text: 'Stock in and out, transfers between sites, tools, material orders and low-stock thresholds.' },
  { icon: Truck, title: 'Machines & equipment', text: 'Owned, on EMI or rented — fuel and maintenance logs, machine attendance and rental billing.' },
  { icon: ReceiptIndianRupee, title: 'Expenses & reports', text: 'Categorised expenses, charts and one-click PDF reports for every site and unit.' },
  { icon: Factory, title: 'Sales & manufacturing', text: 'Production units, sales and transfers, with payment tracking against every sale.' },
  { icon: Wrench, title: 'Warranty & defect liability', text: 'Track warranties, retention money and post-handover repair costs after a site is completed.' },
  {
    icon: FileText, title: 'Documents with AI', span: 'lg:col-span-2',
    text: 'Upload bills, permits and contracts. Inventra’s AI reads each document and writes a short summary you can search later.',
    visual: 'doc',
  },
  { icon: Users, title: 'Team & roles', text: 'Invite your team, assign roles and sites, and keep everyone on the same page.' },
  { icon: ShieldCheck, title: 'Secure by design', text: 'Each company’s data is isolated and access-controlled, and files are only reachable through signed links.' },
];

const STEPS = [
  { icon: Rocket, title: 'Create your workspace', text: 'Sign up with your company name — your 2-month free trial starts instantly.' },
  { icon: Building2, title: 'Add sites & your team', text: 'Set up construction sites or manufacturing units and invite managers, engineers and accountants.' },
  { icon: ClipboardList, title: 'Track everything daily', text: 'Log attendance, materials, machines and expenses — dashboards and reports update live.' },
];

const AI_FEATURES = [
  { icon: Bot, title: 'AI Assistant', text: 'Ask how to do anything in Inventra and get step-by-step answers, any time.' },
  { icon: ScanText, title: 'Document reading', text: 'Every uploaded bill or permit gets an automatic AI summary.' },
  { icon: ShieldAlert, title: 'Threat Modeler', text: 'Describe your setup and get a list of security and safety risks to address.' },
];

const BUILT_FOR = ['Construction companies', 'Civil contractors', 'Manufacturing units', 'Precast & RMC plants', 'Warehouses', 'Equipment rental'];

const FAQS = [
  { q: 'Is there a free trial?', a: 'Yes. Every new company gets a 2-month free trial with all Premium features, including the AI Assistant.' },
  { q: 'Can I manage both construction sites and manufacturing units?', a: 'Yes. Inventra handles construction sites and manufacturing units in the same workspace, each with its own labour, inventory, machines, expenses and reports.' },
  { q: 'Can my whole team use it?', a: 'Yes. Invite team members, give them roles and assign them to specific sites. The Basic plan includes up to 10 users; Premium is unlimited.' },
  { q: 'Does it work on mobile?', a: 'Yes. Inventra runs in any modern browser, so site managers can use it on their phones on site.' },
  { q: 'Is my data secure?', a: 'Each company’s data is isolated by strict database security rules, sign-in is handled by Firebase Authentication, and uploaded files are only reachable through signed links.' },
  { q: 'What does the AI actually do?', a: 'The AI Assistant answers questions about using Inventra, uploaded documents get an automatic summary, and the Threat Modeler lists risks for the setup you describe.' },
];

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: React.ReactNode; subtitle?: string }) {
  return (
    <Reveal className="mx-auto mb-14 max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-ink/60">{subtitle}</p>}
    </Reveal>
  );
}

function GradientText({ children }: { children: React.ReactNode }) {
  return <span className="bg-gradient-to-r from-sky-600 via-cyan-500 to-purple-600 dark:from-sky-400 dark:via-cyan-300 dark:to-purple-400 bg-clip-text text-transparent">{children}</span>;
}

/** Splits "Brand — Rest of title" so the part after the dash gets the gradient. */
function HeroTitle({ title }: { title: string }) {
  const [first, ...rest] = title.split(/\s+—\s+/);
  if (!rest.length) return <>{title}</>;
  return <>{first} — <GradientText>{rest.join(' — ')}</GradientText></>;
}

function FloatingCard({ className, icon: Icon, tone, title, value }: {
  className: string; icon: React.ElementType; tone: string; title: string; value: string;
}) {
  return (
    <div className={cn('absolute z-10 hidden animate-float items-center gap-2.5 rounded-2xl bg-surface/85 px-3 py-2.5 shadow-xl shadow-black/40 ring-1 ring-ink/10 backdrop-blur-md sm:flex', className)}>
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', tone)}><Icon className="h-4 w-4" /></span>
      <span>
        <span className="block text-[11px] text-ink/50">{title}</span>
        <span className="block whitespace-nowrap text-[13px] font-semibold text-ink">{value}</span>
      </span>
    </div>
  );
}

function TeamMemberCard({ name, role, imageUrl, bio, linkedin, twitter }: LandingPageContent['team'][number]) {
  return (
    <div className="group rounded-3xl bg-ink/[0.04] p-6 text-center ring-1 ring-ink/10 transition hover:-translate-y-1 hover:ring-sky-400/40">
      <div className="relative mx-auto h-28 w-28">
        <Image src={imageUrl} alt={name} fill sizes="112px" className="rounded-full object-cover ring-4 ring-sky-400/20 transition group-hover:ring-sky-400/50" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{name}</h3>
      <p className="text-sm text-sky-600 dark:text-sky-300">{role}</p>
      <p className="mt-3 text-sm text-ink/60">{bio}</p>
      <div className="mt-4 flex justify-center gap-3">
        {linkedin && linkedin !== '#' && (
          <a href={linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${name} on LinkedIn`} className="text-ink/50 hover:text-sky-300"><Linkedin className="h-5 w-5" /></a>
        )}
        {twitter && twitter !== '#' && (
          <a href={twitter} target="_blank" rel="noopener noreferrer" aria-label={`${name} on X (Twitter)`} className="text-ink/50 hover:text-sky-300"><Twitter className="h-5 w-5" /></a>
        )}
      </div>
    </div>
  );
}

export default function InventraLanding() {
  const [content, setContent] = useState<LandingPageContent>(defaultContent);
  const [mood, setMood] = useState<CharacterMood>('idle');
  const moodTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Content from the Landing Page Editor; the page shows defaults instantly and updates when it arrives.
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'site_content', 'landing_page'), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as LandingPageContent;
      const team = (data.team || []).map((member, i) =>
        member.imageUrl?.includes('picsum.photos') && defaultContent.team[i] ? { ...member, imageUrl: defaultContent.team[i].imageUrl } : member,
      );
      const merged = { ...defaultContent, ...data, team: team.length ? team : defaultContent.team };
      if (!data.aboutImageUrl || data.aboutImageUrl.includes('picsum.photos') || data.aboutImageUrl === '/about/about.jpg') {
        merged.aboutImageUrl = defaultContent.aboutImageUrl;
      }
      setContent(merged);
    }, (error) => console.error('Error fetching landing page content:', error));
    return () => unsubscribe();
  }, []);

  useEffect(() => () => clearTimeout(moodTimer.current), []);

  // Hovering the main call-to-action makes the character jump for joy.
  const celebrate = () => {
    clearTimeout(moodTimer.current);
    setMood('success');
    moodTimer.current = setTimeout(() => setMood('idle'), 1300);
  };

  return (
    <SiteShell onCtaHover={celebrate}>
        {/* Hero */}
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-2 lg:pb-24 lg:pt-16">
          <div className="text-center lg:text-left">
            <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700">
              <a href="#ai" className="inline-flex items-center gap-2 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/80 ring-1 ring-ink/10 transition hover:bg-ink/10">
                <span className="rounded-full bg-gradient-to-r from-sky-500 to-purple-600 px-2 py-0.5 text-[10px] font-bold text-white">NEW</span>
                AI now reads your site documents <ArrowRight className="h-3 w-3" />
              </a>
            </div>
            <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-100">
              <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                <HeroTitle title={content.heroTitle} />
              </h1>
            </div>
            <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-200">
              <p className="mx-auto mt-6 max-w-xl text-lg text-ink/65 lg:mx-0">{content.heroSubtitle}</p>
            </div>
            <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-300 mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/signup"
                onMouseEnter={celebrate}
                onFocus={celebrate}
                className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 px-7 font-semibold text-white shadow-xl shadow-sky-500/25 transition hover:brightness-110 sm:w-auto"
              >
                Start 2-month free trial <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a href="#how" className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-ink/5 px-7 font-semibold text-ink ring-1 ring-ink/15 transition hover:bg-ink/10 sm:w-auto">
                See how it works
              </a>
            </div>
            <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-500 mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink/55 lg:justify-start">
              {['2-month free trial', 'Set up in minutes', 'Works on phone & desktop'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> {t}</span>
              ))}
            </div>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 delay-200 relative mx-auto h-[380px] w-full max-w-xl sm:h-[460px] lg:h-[540px]">
            <div aria-hidden className="absolute inset-x-8 bottom-6 top-16 rounded-full bg-gradient-to-b from-sky-500/20 to-purple-600/10 blur-3xl" />
            {/* Character in the middle; the floating cards sit in the free space on both sides. */}
            <div className="absolute inset-0">
              <Character3D mood={mood} emailProgress={0} />
            </div>
            <FloatingCard className="left-0 top-[12%]" icon={CalendarCheck} tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" title="Attendance today" value="42 / 45 present" />
            <FloatingCard className="right-0 top-[30%] [animation-delay:-2s]" icon={AlertTriangle} tone="bg-amber-500/15 text-amber-600 dark:text-amber-300" title="Low stock" value="Cement · 12 bags" />
            <FloatingCard className="bottom-[26%] left-0 [animation-delay:-4s]" icon={IndianRupee} tone="bg-sky-500/15 text-sky-600 dark:text-sky-300" title="Expense logged" value="₹18,500 · Diesel" />
            <FloatingCard className="bottom-[8%] right-0 [animation-delay:-3s]" icon={Wand2} tone="bg-purple-500/15 text-purple-600 dark:text-purple-300" title="AI summary ready" value="Invoice #2213" />
          </div>
        </section>

        {/* Built for */}
        <section className="border-y border-ink/5 bg-ink/[0.02] py-6">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-[0.2em] text-ink/40">Built for</p>
          <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
            <div className="flex w-max animate-marquee gap-12 pr-12 motion-reduce:animate-none">
              {[...BUILT_FOR, ...BUILT_FOR].map((label, i) => (
                <span key={i} className="whitespace-nowrap text-lg font-semibold text-ink/45">{label}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Highlights from the editor */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {content.features.map((f, i) => (
              <Reveal key={f.title} delay={i * 100} className="rounded-3xl bg-ink/[0.04] p-7 ring-1 ring-ink/10 transition hover:-translate-y-1 hover:ring-sky-400/40">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 to-purple-600/20 text-sky-600 dark:text-sky-300 ring-1 ring-ink/10">
                  {getIcon(f.icon)}
                </div>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">{f.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Modules bento */}
        <section id="features" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-6">
          <SectionHeading
            eyebrow="Everything in one place"
            title={<>Built around how <GradientText>sites actually run</GradientText></>}
            subtitle="Every module talks to the others — attendance feeds wages, materials feed costs, and every rupee shows up in your reports."
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {MODULES.map(({ icon: Icon, title, text, span, visual }, i) => (
              <Reveal key={title} delay={(i % 4) * 80} className={cn('group relative overflow-hidden rounded-3xl bg-ink/[0.04] p-6 ring-1 ring-ink/10 transition hover:ring-sky-400/40', span)}>
                <div aria-hidden className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-500/10 blur-2xl transition group-hover:bg-sky-500/20" />
                <Icon className="h-6 w-6 text-sky-600 dark:text-sky-300" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">{text}</p>
                {visual === 'sites' && (
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {([['Riverside', 72], ['Green Valley', 45], ['Unit 2', 88]] as const).map(([n, p]) => (
                      <div key={n} className="rounded-xl bg-ink/5 p-3">
                        <p className="truncate text-[11px] text-ink/60">{n}</p>
                        <p className="text-lg font-bold">{p}%</p>
                        <div className="mt-1 h-1 rounded-full bg-ink/10"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-purple-500" style={{ width: `${p}%` }} /></div>
                      </div>
                    ))}
                  </div>
                )}
                {visual === 'doc' && (
                  <div className="mt-5 flex items-start gap-3 rounded-xl bg-ink/5 p-3 text-xs">
                    <FileText className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-ink/10 p-1.5 text-ink/70" />
                    <div className="min-w-0">
                      <p className="font-medium text-ink/85">cement-invoice.pdf</p>
                      <p className="mt-1 flex items-center gap-1 text-purple-600 dark:text-purple-300"><Sparkles className="h-3 w-3" /> AI summary</p>
                      <p className="mt-0.5 text-ink/55">Supplier invoice for 200 bags of OPC 53 cement, total ₹78,000, due in 15 days.</p>
                    </div>
                  </div>
                )}
              </Reveal>
            ))}
          </div>
        </section>

        {/* Product preview */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading
            eyebrow="Your command centre"
            title={<>See every site at a <GradientText>glance</GradientText></>}
            subtitle="Projects, workforce, spending and deadlines on one live dashboard — on your laptop or your phone."
          />
          <Reveal><ProductPreview /></Reveal>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="How it works" title={<>Up and running in <GradientText>three steps</GradientText></>} />
          <div className="relative grid gap-6 md:grid-cols-3">
            <div aria-hidden className="absolute left-[16%] right-[16%] top-8 hidden h-px bg-gradient-to-r from-sky-500/0 via-sky-500/50 to-purple-500/0 md:block" />
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={i * 120} className="relative text-center">
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface ring-1 ring-ink/15">
                  <Icon className="h-7 w-7 text-sky-600 dark:text-sky-300" />
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-purple-600 text-xs font-bold text-white">{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-ink/60">{text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* AI */}
        <section id="ai" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-6">
          <div className="grid items-center gap-12 rounded-[2rem] bg-gradient-to-br from-sky-500/10 via-transparent to-purple-600/15 p-6 ring-1 ring-ink/10 sm:p-10 lg:grid-cols-2 lg:p-14">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600 dark:text-purple-300">Inventra AI</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">An assistant that <GradientText>knows your workflow</GradientText></h2>
              <p className="mt-4 text-ink/60">AI built into the places you already work — not another tool to learn.</p>
              <div className="mt-8 space-y-5">
                {AI_FEATURES.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="flex gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-300 ring-1 ring-purple-400/20"><Icon className="h-5 w-5" /></span>
                    <div><p className="font-semibold">{title}</p><p className="text-sm text-ink/60">{text}</p></div>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div className="rounded-3xl bg-surface/80 p-5 shadow-2xl ring-1 ring-ink/10 backdrop-blur">
                <div className="flex items-center gap-2 border-b border-ink/5 pb-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-purple-600 text-white"><Bot className="h-4 w-4" /></span>
                  <div><p className="text-sm font-semibold">Inventra Assistant</p><p className="text-[11px] text-emerald-600 dark:text-emerald-300">● Online</p></div>
                </div>
                <div className="space-y-3 pt-4 text-sm">
                  <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-sky-500/90 px-4 py-2.5 text-white">How do I move cement from Riverside to Green Valley?</div>
                  <div className="w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-ink/[0.07] px-4 py-3 text-ink/85">
                    Open <b>Riverside</b> → <b>Materials</b>, then choose <b>Move materials</b>. Pick <b>Green Valley</b> as the destination and enter the quantity — stock updates on both sites instantly.
                  </div>
                  <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-sky-500/90 px-4 py-2.5 text-white">Thanks! 🙌</div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="Pricing" title={<>Simple plans, <GradientText>no surprises</GradientText></>} subtitle="Start free for two months. Pick a plan when you’re ready." />
          <Reveal><Pricing /></Reveal>
        </section>

        {/* Solutions from the editor */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="Solutions" title={<>One platform, <GradientText>every module</GradientText></>} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {content.solutions.map((s, i) => (
              <Reveal key={s.title} delay={(i % 4) * 70} className="rounded-2xl bg-ink/[0.03] p-5 ring-1 ring-ink/10 transition hover:-translate-y-0.5 hover:ring-sky-400/40">
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-ink/55">{s.desc}</p>
                <Link href={`/contact?subject=${encodeURIComponent(`Interested in ${s.title}`)}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-300 hover:text-sky-700 dark:hover:text-sky-200">
                  Ask about {s.title} <ArrowRight className="h-3 w-3" />
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* About */}
        <section id="about" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">Our story</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{content.aboutTitle}</h2>
              <p className="mt-5 leading-relaxed text-ink/65">{content.aboutDescription}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#features" className="rounded-xl bg-ink/5 px-5 py-2.5 text-sm font-semibold ring-1 ring-ink/15 hover:bg-ink/10">Explore features</a>
                <Link href="/contact" className="rounded-xl px-5 py-2.5 text-sm font-semibold text-sky-600 dark:text-sky-300 hover:text-sky-700 dark:hover:text-sky-200">Schedule a demo →</Link>
              </div>
            </Reveal>
            <Reveal delay={150} className="relative aspect-[4/3] overflow-hidden rounded-3xl ring-1 ring-ink/10">
              <Image src={content.aboutImageUrl} alt="Construction site illustration" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-page/60 to-transparent" />
            </Reveal>
          </div>
        </section>

        {/* Team */}
        <section id="team" className="mx-auto max-w-4xl scroll-mt-24 px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="Team" title={<>The people behind <GradientText>Inventra</GradientText></>} />
          <div className="grid gap-6 sm:grid-cols-2">
            {content.team.map((m, i) => (
              <Reveal key={m.name} delay={i * 120}><TeamMemberCard {...m} /></Reveal>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          <Reveal>
            <Accordion type="single" collapsible className="space-y-3">
              {FAQS.map((f, i) => (
                <AccordionItem key={f.q} value={`q${i}`} className="rounded-2xl border-0 bg-ink/[0.04] px-5 ring-1 ring-ink/10">
                  <AccordionTrigger className="text-left font-semibold hover:no-underline">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-ink/65">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </section>

        {/* CTA */}
        <section id="contact" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky-600 via-sky-700 to-purple-700 px-6 py-14 text-center text-white shadow-2xl shadow-sky-900/40 sm:px-12">
            <div aria-hidden className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            <div aria-hidden className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-purple-400/20 blur-2xl" />
            <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">{content.ctaTitle}</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-white/80">{content.ctaSubtitle}</p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" onMouseEnter={celebrate} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-7 font-semibold text-slate-900 transition hover:bg-ink/90">
                Start 2-month free trial <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/contact" className="inline-flex h-12 items-center justify-center rounded-xl px-7 font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/10">
                Talk to us
              </Link>
            </div>
          </Reveal>
        </section>
    </SiteShell>
  );
}
