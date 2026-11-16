/**
 * The public address of the site, used for invoices, emails, link previews and Google's
 * sitemap. Set NEXT_PUBLIC_SITE_URL in Vercel (e.g. https://inventra.co.in) once the
 * domain is connected; until then the Vercel address is used.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studio-mu-two-89.vercel.app').replace(/\/+$/, '');

/** "inventra.co.in" — the address without https:// for printing on invoices and emails. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');
