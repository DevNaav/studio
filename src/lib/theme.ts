'use client';

/**
 * Dashboard theme preference.
 *
 * 'system' (the default) follows the device's light/dark setting and switches
 * live when it changes. The other values are the existing named themes.
 * The choice is stored in localStorage and every listener (page wrapper,
 * Settings, header menu) stays in sync through a custom event.
 */
import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'futuristic' | 'construction' | 'dark' | 'default';
export type AppliedTheme = Exclude<ThemePreference, 'system'>;

/** Theme used for "System" when the device is in light / dark mode. */
export const LIGHT_THEME: AppliedTheme = 'construction';
export const DARK_THEME: AppliedTheme = 'futuristic';

const STORAGE_KEY = 'theme';
const CHANGE_EVENT = 'inventra-theme-change';
const THEME_CLASSES: AppliedTheme[] = ['dark', 'construction', 'futuristic', 'default'];
const VALID: ThemePreference[] = ['system', ...THEME_CLASSES];

// Bump to reset everyone's saved theme once (v2: introduced "System", the new default).
const PREFS_VERSION = '2';
const VERSION_KEY = 'themeVersion';

export function getThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    if (window.localStorage.getItem(VERSION_KEY) !== PREFS_VERSION) {
      // Themes saved before "System" existed would otherwise override the device setting forever.
      window.localStorage.setItem(STORAGE_KEY, 'system');
      window.localStorage.setItem(VERSION_KEY, PREFS_VERSION);
    }
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    return stored && VALID.includes(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function setThemePreference(pref: ThemePreference) {
  try {
    window.localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* storage blocked (private mode) — still apply for this session */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: pref }));
}

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(pref: ThemePreference): AppliedTheme {
  if (pref !== 'system') return pref;
  return systemPrefersDark() ? DARK_THEME : LIGHT_THEME;
}

/** Puts the theme's class on <body> (the CSS variables for each theme hang off these classes). */
export function applyThemeClass(theme: AppliedTheme) {
  const body = document.body;
  body.classList.remove(...THEME_CLASSES);
  if (theme !== 'default') body.classList.add(theme);
  // Lets native controls (scrollbars, date pickers) match.
  document.documentElement.style.colorScheme = theme === 'construction' || theme === 'default' ? 'light' : 'dark';
}

/**
 * Current preference + the theme actually applied. Re-renders when the user
 * picks a theme anywhere in the app or when the device switches light/dark.
 */
export function useThemePreference(): [ThemePreference, (p: ThemePreference) => void, AppliedTheme] {
  const [pref, setPref] = useState<ThemePreference>('system');
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    setPref(getThemePreference());
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(media.matches);

    const onMedia = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    const onChange = (e: Event) => setPref((e as CustomEvent<ThemePreference>).detail);
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) setPref(getThemePreference()); };

    media.addEventListener('change', onMedia);
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage); // other tabs
    return () => {
      media.removeEventListener('change', onMedia);
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const applied: AppliedTheme = pref === 'system' ? (systemDark ? DARK_THEME : LIGHT_THEME) : pref;
  const update = useCallback((p: ThemePreference) => setThemePreference(p), []);
  return [pref, update, applied];
}

/**
 * Theme for the public pages (home, login, sign-up). Follows the same
 * preference as the dashboard: light when the applied theme is a light one.
 * Returns the wrapper class and keeps <body> (used by pop-ups like dropdowns
 * and toasts) on a matching neutral theme.
 */
export function usePublicTheme() {
  const [, , applied] = useThemePreference();
  const isLight = applied === 'construction' || applied === 'default';
  useEffect(() => {
    applyThemeClass(isLight ? 'default' : 'futuristic');
  }, [isLight]);
  return { isLight, themeClass: isLight ? 'public-light' : 'public-dark dark' };
}
