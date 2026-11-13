'use client';

import { Check, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useThemePreference, LIGHT_THEME, DARK_THEME, type ThemePreference } from '@/lib/theme';

const OPTIONS: { value: ThemePreference; label: string; hint: string; icon: React.ElementType }[] = [
  { value: 'system', label: 'System', hint: 'Match my device', icon: Monitor },
  { value: LIGHT_THEME, label: 'Light', hint: 'Construction', icon: Sun },
  { value: DARK_THEME, label: 'Dark', hint: 'Glacial Cyan', icon: Moon },
  { value: 'dark', label: 'Synthwave', hint: 'Dark, neon pink', icon: Palette },
];

/** Quick light/dark switch for the dashboard header. */
export function ThemeMenu() {
  const [pref, setPref, applied] = useThemePreference();
  const isLight = applied === 'construction' || applied === 'default';
  const TriggerIcon = pref === 'system' ? Monitor : isLight ? Sun : Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme" title="Theme">
          <TriggerIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map(({ value, label, hint, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setPref(value)} className="gap-3">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">
              <span className="block text-sm">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
            {pref === value && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
