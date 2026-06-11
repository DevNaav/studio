
'use client';

import * as React from 'react';
import { useEffect } from 'react';
import useLocalStorage from '@/hooks/use-local-storage';
import { initializeAnimationMode } from '@/lib/animation-mode';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [themeName] = useLocalStorage('theme', 'futuristic');
  
  useEffect(() => {
    // --- Theme ---
    const body = document.body;
    body.classList.remove('dark', 'construction', 'futuristic', 'default');
    if (themeName !== 'default') {
      body.classList.add(themeName);
    }

    // --- Animation ---
    // This now runs only on the client, after hydration.
    initializeAnimationMode();
  }, [themeName]);

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
