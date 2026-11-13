
'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { applyThemeClass, useThemePreference, type AppliedTheme } from '@/lib/theme';
import { initializeAnimationMode } from '@/lib/animation-mode';

export default function ClientLayout({
  children,
  forcedTheme,
}: {
  children: React.ReactNode
  /** Pin a theme regardless of the user's choice (e.g. public pages stay dark). */
  forcedTheme?: AppliedTheme
}) {
  // Follows the user's choice; "System" (the default) follows the device's light/dark mode.
  const [, , appliedTheme] = useThemePreference();
  const themeName = forcedTheme ?? appliedTheme;

  useEffect(() => {
    applyThemeClass(themeName);
  }, [themeName]);

  useEffect(() => {
    // Runs only on the client, after hydration.
    initializeAnimationMode();
  }, []);

  return (
    <>
        <div id="bg-glow">
          <div className="blob b1"></div>
          <div className="blob b2"></div>
          <div className="blob b3"></div>
          <div className="bg-overlay"></div>
        </div>
        <div className="relative z-10">
          {children}
        </div>
    </>
  );
}
