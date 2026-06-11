
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { getAnimationMode, setAnimationMode } from '@/lib/animation-mode';
import { cn } from '@/lib/utils';

export function AnimationToggleSection() {
  const [mode, setMode] = useState< 'on' | 'off'>('on');
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    // Set initial state from localStorage
    setMode(getAnimationMode());

    // Listen for changes from other tabs/windows
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'animMode') {
        setMode(event.newValue as 'on' | 'off');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleModeChange = (newMode: 'on' | 'off') => {
    setAnimationMode(newMode);
    setMode(newMode);
    setAnnouncement(`Animations are now ${newMode === 'on' ? 'enabled' : 'disabled'}.`);
  };

  return (
    <div className="space-y-4">
        <div className="space-y-1">
            <h3 className="text-lg font-semibold">Animation</h3>
            <p className="text-sm text-muted-foreground">
                Control UI animations and transitions across the application.
            </p>
        </div>
        <div className="flex gap-2">
            <Button
                variant={mode === 'on' ? 'default' : 'outline'}
                onClick={() => handleModeChange('on')}
                aria-pressed={mode === 'on'}
                className={cn(mode === 'on' && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
            >
                Animation
            </Button>
            <Button
                variant={mode === 'off' ? 'default' : 'outline'}
                onClick={() => handleModeChange('off')}
                aria-pressed={mode === 'off'}
                className={cn(mode === 'off' && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
            >
                No Animation
            </Button>
        </div>
        <div className="sr-only" aria-live="polite" role="status">
            {announcement}
        </div>
    </div>
  );
}
