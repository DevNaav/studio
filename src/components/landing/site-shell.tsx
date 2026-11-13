'use client';

/**
 * Shared chrome for the public site (home, contact, legal pages): background,
 * sticky glass header with mobile menu, and footer. Follows light/dark mode.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { usePublicTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

// Section links point at the home page so they work from every page.
export const SITE_NAV = [
  { label: 'Features', href: '/#features' },
  { label: 'How it works', href: '/#how' },
  { label: 'AI', href: '/#ai' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'FAQ', href: '/#faq' },
];

const LEGAL = [
  { label: 'Privacy policy', href: '/privacy' },
  { label: 'Terms of service', href: '/terms' },
  { label: 'Refund policy', href: '/refund' },
];

export function SiteShell({ children, onCtaHover }: { children: React.ReactNode; onCtaHover?: () => void }) {
  const { themeClass } = usePublicTheme();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const contactActive = pathname === '/contact';

  return (
    <div className={cn(themeClass, 'min-h-screen overflow-x-clip bg-page text-ink antialiased')}>
      {/* Background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at 50% 0%, black 30%, transparent 75%)',
          }}
        />
        <div className="absolute -left-40 top-0 h-[34rem] w-[34rem] animate-drift rounded-full bg-sky-500/20 blur-[130px]" />
        <div className="absolute -right-40 top-40 h-[30rem] w-[30rem] animate-drift rounded-full bg-purple-600/20 blur-[130px] [animation-delay:-7s]" />
      </div>

      {/* Header */}
      <header className={cn('sticky top-0 z-50 transition-all', scrolled ? 'border-b border-ink/10 bg-page/75 backdrop-blur-xl' : 'bg-transparent')}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <button className="rounded-lg p-2 text-ink/80 hover:bg-ink/10 lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
              </SheetTrigger>
              <SheetContent side="left" className={cn(themeClass, 'w-72 border-ink/10 bg-surface text-ink')}>
                <SheetTitle className="mb-6 flex items-center gap-3 text-ink"><Logo className="h-10 w-10" /> Inventra</SheetTitle>
                <nav className="flex flex-col gap-1">
                  {SITE_NAV.map((n) => (
                    <SheetClose asChild key={n.href}>
                      <a href={n.href} className="rounded-lg px-3 py-2.5 text-ink/80 hover:bg-ink/5 hover:text-ink">{n.label}</a>
                    </SheetClose>
                  ))}
                  <SheetClose asChild>
                    <Link href="/contact" className={cn('rounded-lg px-3 py-2.5 hover:bg-ink/5 hover:text-ink', contactActive ? 'bg-ink/5 font-semibold text-ink' : 'text-ink/80')}>Contact</Link>
                  </SheetClose>
                </nav>
              </SheetContent>
            </Sheet>
            <Link href="/" className="flex items-center gap-3">
              <Logo className="h-10 w-10" priority />
              <span className="text-lg font-bold tracking-tight">Inventra</span>
            </Link>
          </div>
          <nav className="hidden items-center gap-6 lg:flex xl:gap-8">
            {SITE_NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-sm text-ink/65 transition hover:text-ink">{n.label}</a>
            ))}
            <Link href="/contact" className={cn('text-sm transition hover:text-ink', contactActive ? 'font-semibold text-ink' : 'text-ink/65')}>Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-ink/85 hover:text-ink">Log in</Link>
            <Link
              href="/signup"
              onMouseEnter={onCtaHover}
              className="hidden rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:brightness-110 sm:inline-flex"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">{children}</main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-ink/10">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <Logo className="h-10 w-10" />
              <span className="text-lg font-bold">Inventra</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-ink/50">Construction and manufacturing management — sites, labour, inventory, machines and money in one place.</p>
          </div>
          <div>
            <p className="text-sm font-semibold">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-ink/55">
              {SITE_NAV.map((n) => <li key={n.href}><a href={n.href} className="hover:text-ink">{n.label}</a></li>)}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">Company</p>
            <ul className="mt-3 space-y-2 text-sm text-ink/55">
              <li><Link href="/contact" className={cn('hover:text-ink', contactActive && 'font-semibold text-ink')}>Contact</Link></li>
              {LEGAL.map((l) => (
                <li key={l.href}><Link href={l.href} className={cn('hover:text-ink', pathname === l.href && 'font-semibold text-ink')}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-ink/5 py-5 text-center text-xs text-ink/40">© {new Date().getFullYear()} Inventra. All rights reserved.</div>
      </footer>
    </div>
  );
}
