'use client';

import { SiteShell } from '@/components/landing/site-shell';

// Contact, privacy, terms and refund pages share the public site's header and footer.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
