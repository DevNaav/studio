'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface CompanyLogoTileProps {
  name: string;
  logoUrl?: string | null;
  className?: string;
}

/**
 * Company logo shown in the dashboard header. Logos are displayed whole
 * (object-contain) on a light rounded tile so any shape or colour reads
 * clearly on the dark theme; without a logo, the company initials are shown.
 */
export function CompanyLogoTile({ name, logoUrl, className }: CompanyLogoTileProps) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

  const showLogo = !!logoUrl && !failed;

  return (
    <div
      className={cn(
        'relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl sm:h-16 sm:w-16',
        'shadow-lg shadow-primary/20 ring-1 ring-white/15 transition-transform duration-300 hover:scale-105',
        showLogo ? 'bg-white p-1.5' : 'bg-gradient-to-br from-primary to-accent',
        className,
      )}
      title={name}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed /api/files link, shown as-is
        <img
          src={logoUrl!}
          alt={`${name} logo`}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-xl font-bold text-primary-foreground sm:text-2xl">{initials}</span>
      )}
    </div>
  );
}
