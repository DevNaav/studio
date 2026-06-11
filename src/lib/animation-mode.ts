
'use client';

type AnimationMode = 'on' | 'off';

const STORAGE_KEY = 'animMode';

/**
 * Retrieves the current animation mode from localStorage.
 * @returns 'on' or 'off'.
 */
export function getAnimationMode(): AnimationMode {
  if (typeof window === 'undefined') {
    return 'on'; // Default for server-side rendering
  }
  return (window.localStorage.getItem(STORAGE_KEY) as AnimationMode) || 'on';
}

/**
 * Sets the animation mode, updates the body class, and saves to localStorage.
 * @param mode - The animation mode to set ('on' or 'off').
 */
export function setAnimationMode(mode: AnimationMode) {
  if (typeof window === 'undefined') {
    return;
  }

  // Update body class for global animation control
  if (mode === 'on') {
    document.body.classList.add('animated');
    document.body.classList.remove('no-anim');
  } else {
    document.body.classList.add('no-anim');
    document.body.classList.remove('animated');
  }

  // Persist to localStorage
  window.localStorage.setItem(STORAGE_KEY, mode);
  
  // Toggle visibility for specific animated elements
  const animatedElements = [
    document.getElementById('mascot'),
    document.getElementById('bg-glow'),
  ];
  
  animatedElements.forEach(el => {
    if (el) {
      if (mode === 'on') {
        el.classList.remove('anim-hidden');
        el.classList.add('anim-visible');
        el.setAttribute('aria-hidden', 'false');
      } else {
        el.classList.remove('anim-visible');
        el.classList.add('anim-hidden');
        el.setAttribute('aria-hidden', 'true');
      }
    }
  });
}

/**
 * Initializes the animation mode based on user preference or system settings.
 * This should be called once when the application loads.
 */
export function initializeAnimationMode() {
  if (typeof window === 'undefined') {
    return;
  }

  let initialMode: AnimationMode;
  const savedMode = window.localStorage.getItem(STORAGE_KEY) as AnimationMode;

  if (savedMode) {
    initialMode = savedMode;
  } else {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    initialMode = prefersReducedMotion ? 'off' : 'on';
  }
  
  // Apply the class immediately to prevent FOUC
  if (initialMode === 'off') {
    document.body.classList.add('no-anim');
    document.body.classList.remove('animated');
  } else {
    document.body.classList.add('animated');
    document.body.classList.remove('no-anim');
  }

  setAnimationMode(initialMode);
}

