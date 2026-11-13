import DOMPurify from 'dompurify';

/**
 * Cleans HTML loaded from Firestore before it is rendered with
 * dangerouslySetInnerHTML, removing scripts, event handlers and other markup
 * that could run code. Only call this in the browser (e.g. inside useEffect or
 * a Firestore listener); on the server it returns an empty string.
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return '';
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
