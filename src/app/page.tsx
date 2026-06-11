
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle, Construction, Warehouse, Bot, Loader2, Linkedin, Twitter } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import HumanCharacter from '@/components/HumanCharacter';
import ClientLayout from './client-layout';
import * as LucideIcons from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LandingPageContent } from '@/lib/types';

// Helper to get icon component from string
const getIcon = (name: string) => {
  const Icon = (LucideIcons as any)[name];
  return Icon ? <Icon className="h-6 w-6" /> : <Construction className="h-6 w-6" />;
}

function FeatureCard({ title, text, iconName }: { title: string; text: string, iconName: string }) {
  return (
    <div className="rounded-2xl bg-card/50 border border-white/10 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:-translate-y-1 scroll-anim">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {getIcon(iconName)}
      </div>
      <h5 className="font-semibold text-foreground">{title}</h5>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function SolutionCard({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="rounded-2xl bg-card/50 border border-border p-6 transition-all duration-300 hover:border-primary/50 hover:-translate-y-1 scroll-anim">
      <h4 className="font-semibold text-foreground">{title}</h4>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-4">
        <Link href="/contact" className="text-sm text-primary hover:underline flex items-center gap-1">
          Learn more <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

function TeamMemberCard({ name, role, imageUrl, bio, linkedin, twitter }: { name: string, role: string, imageUrl: string, bio: string, linkedin?: string, twitter?: string }) {
  return (
    <div className="group relative rounded-2xl bg-card/50 border border-border p-6 transition-all duration-300 hover:border-primary/50 hover:-translate-y-1 scroll-anim overflow-hidden flex flex-col items-center text-center">
        <div className="relative w-32 h-32 shrink-0">
          <Image
            src={imageUrl}
            alt={name}
            width={128}
            height={128}
            className="rounded-full object-cover border-4 border-primary/10 transition-transform duration-300 group-hover:scale-110"
            data-ai-hint="person business"
          />
        </div>
        <div className="mt-4">
          <h4 className="font-semibold text-lg text-foreground">{name}</h4>
          <p className="text-sm text-primary/80">{role}</p>
        </div>
      <div className="absolute inset-0 bg-card/90 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <p className="text-sm text-muted-foreground">{bio}</p>
        <div className="flex gap-4 mt-4 justify-center sm:justify-start">
            {linkedin && (
              <a href={linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Linkedin className="h-5 w-5" />
              </a>
            )}
            {twitter && (
              <a href={twitter} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
            )}
          </div>
      </div>
    </div>
  )
}


const defaultContent: LandingPageContent = {
  heroTitle: 'Inventra — Construction & Manufacturing Management, Reimagined',
  heroSubtitle: 'A unified, multi-tenant platform to manage sites, track inventory, run production, streamline finances and get AI-powered insights — all from one secure dashboard.',
  aboutTitle: 'About Inventra',
  aboutDescription: 'Inventra combines construction site management and manufacturing operations into a single platform. We help businesses reduce material waste, improve labour utilisation and accelerate delivery timelines by connecting field data, inventory control and financial workflows.',
  aboutImageUrl: '/about/about.jpg',
  features: [
    { icon: 'Construction', title: 'Unified Site Management', text: 'Oversee multiple construction sites and manufacturing units from a single, intuitive dashboard.' },
    { icon: 'Warehouse', title: 'Real-Time Inventory', text: 'Track materials from warehouse to worksite, manage stock levels, and get low-stock alerts.' },
    { icon: 'Bot', title: 'AI-Powered Insights', text: 'Leverage our AI Assistant to analyze project data, model threats, and extract insights from documents.' }
  ],
  solutions: [
    { title: "Site Management", desc: "Tasks, schedules, permits & safety checklists" },
    { title: "Field App", desc: "Mobile reporting, attendance and asset scanning" },
    { title: "Inventory & BOM", desc: "Stock, warehouses, transfers & procurement" },
    { title: "Manufacturing", desc: "Work orders, routing, and production planning" },
    { title: "Analytics", desc: "Dashboards, KPIs, cost & timeline forecasting" },
    { title: "Finance", desc: "Estimates, invoices, payroll & supplier payments" },
    { title: "AI Tools", desc: "Document analysis, risk detection & automated insights" },
    { title: "Integrations", desc: "APIs, ERPs, accounting systems & IoT sensors" }
  ],
  team: [
    { name: 'Abhinav Goyal', role: 'Co-Founder', imageUrl: '/team/member1.jpg', bio: 'Abhinav leads product and engineering with a passion for building scalable and user-centric solutions.', linkedin: '#', twitter: '#' },
    { name: 'Hardik Bansal', role: 'Co-Founder', imageUrl: '/team/member2.jpg', bio: 'Hardik drives business strategy and customer success, ensuring our partners achieve their goals.', linkedin: '#', twitter: '#' }
  ],
  ctaTitle: 'Ready to streamline your projects?',
  ctaSubtitle: 'Get a personalized demo and see how Inventra can reduce costs and accelerate delivery.',
  privacyPolicyContent: '',
  termsOfServiceContent: '',
  refundPolicyContent: ''
};

export default function InventraLanding() {
  const router = useRouter();
  const [content, setContent] = useState<LandingPageContent>(defaultContent);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'site_content', 'landing_page');
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const firestoreData = doc.data() as LandingPageContent;
        // Merge data, but prioritize local default image URLs if Firestore has picsum URLs
        const mergedTeam = (firestoreData.team || []).map((member, index) => {
          const defaultMember = defaultContent.team[index];
          if (member.imageUrl && member.imageUrl.includes('picsum.photos') && defaultMember) {
            return { ...member, imageUrl: defaultMember.imageUrl };
          }
          return member;
        });
  
        const mergedContent = { 
          ...defaultContent, 
          ...firestoreData,
          team: mergedTeam,
        };

        if (firestoreData.aboutImageUrl && firestoreData.aboutImageUrl.includes('picsum.photos')) {
          mergedContent.aboutImageUrl = defaultContent.aboutImageUrl;
        }

        setContent(mergedContent);

      } else {
        setContent(defaultContent);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching landing page content:", error);
      setContent(defaultContent);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ClientLayout>
      <div className="min-h-screen bg-background text-foreground font-body antialiased">
        <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
          <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Logo />
              <div className="font-semibold text-lg text-foreground">Inventra</div>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300">About</a>
              <a href="#solutions" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300">Solutions</a>
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300">Features</a>
              <a href="#team" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300">Team</a>
              <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-300">Contact</Link>
            </nav>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => router.push('/login')}>Login</Button>
              <Button onClick={() => router.push('/signup')} className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-300 shadow-lg shadow-primary/20">Sign Up</Button>
            </div>
          </div>
        </header>

        <main className="relative z-10">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-32 text-center">
              <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight text-foreground scroll-anim">{content.heroTitle}</h1>
              <p className="mt-6 max-w-3xl mx-auto text-muted-foreground text-lg scroll-anim">{content.heroSubtitle}</p>

              <div className="mt-10 flex items-center justify-center gap-4 scroll-anim">
                <Button size="lg" onClick={() => router.push('/signup')} className="bg-primary text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-105 duration-300 shadow-lg shadow-primary/20">Start 2-Month Free Trial</Button>
                <Button asChild size="lg" variant="outline" className="bg-transparent border-border hover:bg-accent hover:text-accent-foreground transition-colors duration-300">
                  <a href="#solutions">Learn More</a>
                </Button>
              </div>
          </div>
          
          <div className="mx-auto max-w-6xl px-6">
              <div className="rounded-2xl bg-card/10 p-2 border-border/10 shadow-xl scroll-anim [animation-delay:0.2s] backdrop-blur-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-full w-full">
                      <div className="flex justify-center items-center h-full min-h-[150px] p-4">
                           <div className="typewriter-container">
                              <p className="typewriter text-xl md:text-2xl font-bold">Hello there!</p>
                              <p className="typewriter text-xl md:text-2xl font-bold">Welcome to Inventra.</p>
                              <p className="typewriter text-xl md:text-2xl font-bold">Let's build something great.</p>
                              <p className="typewriter text-xl md:text-2xl font-bold">Manage your projects with ease.</p>
                          </div>
                      </div>
                      <div className="h-64 md:h-96 w-full">
                        <HumanCharacter />
                      </div>
                  </div>
              </div>
          </div>
        </main>

        <section id="about" className="mx-auto max-w-6xl px-6 py-12 sm:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="scroll-anim">
              <h2 className="text-3xl font-extrabold text-foreground">{content.aboutTitle}</h2>
              <p className="mt-4 text-muted-foreground">{content.aboutDescription}</p>

              <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
                <li className="flex items-start gap-3"><CheckCircle className="h-5 w-5 text-primary shrink-0" /> Multi-site & multi-tenant support</li>
                <li className="flex items-start gap-3"><CheckCircle className="h-5 w-5 text-primary shrink-0" /> Real-time field reporting (mobile)</li>
                <li className="flex items-start gap-3"><CheckCircle className="h-5 w-5 text-primary shrink-0" /> Inventory, procurement & BOMs</li>
                <li className="flex items-start gap-3"><CheckCircle className="h-5 w-5 text-primary shrink-0" /> Billing, payroll & invoices</li>
              </ul>

              <div className="mt-8 flex gap-4">
                <Button asChild variant="outline" className="bg-background border-border hover:bg-accent transition-colors duration-300">
                  <a href="#solutions">Our Solutions</a>
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/contact">Schedule a demo</Link>
                </Button>
              </div>
            </div>

            <div className="relative h-80 rounded-2xl overflow-hidden border border-border/50 scroll-anim [animation-delay:0.2s]">
              <Image
                src={content.aboutImageUrl}
                alt="Construction site"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                data-ai-hint="construction site architecture"
              />
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 py-12 sm:py-24 bg-secondary/20 rounded-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-foreground">Powerful Features for Modern Operations</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">Everything you need to streamline your construction and manufacturing projects, all in one place.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {content.features.map(feature => (
              <FeatureCard 
                key={feature.title}
                title={feature.title} 
                text={feature.text}
                iconName={feature.icon}
              />
            ))}
          </div>
        </section>
        
        <section id="solutions" className="mx-auto max-w-7xl px-6 py-12 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-foreground">One Platform, Endless Solutions</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">Modular solutions designed to work together — pick the modules you need and scale as your business grows.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
             {content.solutions.map(solution => (
              <SolutionCard 
                key={solution.title}
                title={solution.title}
                desc={solution.desc}
              />
            ))}
          </div>
        </section>

        <section id="team" className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-foreground">Meet the Team</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">The minds behind Inventra, dedicated to revolutionizing the industry.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 justify-center">
            {content.team.map(member => (
              <TeamMemberCard key={member.name} {...member} />
            ))}
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-5xl px-6 py-12 sm:py-24">
          <div className="rounded-2xl bg-gradient-to-br from-primary/90 to-primary p-8 sm:p-12 border border-primary/30 text-center scroll-anim">
            <h4 className="text-2xl sm:text-3xl font-extrabold text-primary-foreground">{content.ctaTitle}</h4>
            <p className="mt-4 text-primary-foreground/80 max-w-xl mx-auto">{content.ctaSubtitle}</p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={() => router.push('/signup')} className="bg-background text-foreground hover:bg-background/90 w-full sm:w-auto transition-transform hover:scale-105 duration-300">Start 2-Month Free Trial</Button>
              <Button asChild size="lg" variant="outline" className="bg-transparent text-primary-foreground border-primary-foreground/50 hover:bg-primary-foreground/10 w-full sm:w-auto transition-colors duration-300">
                <Link href="/contact">Contact Sales</Link>
              </Button>
            </div>
          </div>
        </section>

        <footer className="border-t border-border/50 mt-24">
          <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-3">
              <Logo />
              <div>
                <div className="font-semibold text-foreground">Inventra</div>
                <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} Inventra — All rights reserved</div>
              </div>
            </Link>

            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors duration-300">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors duration-300">Terms</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors duration-300">Contact</Link>
            </div>
          </div>
        </footer>
      </div>
    </ClientLayout>
  );
}
