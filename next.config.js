
// Security headers sent with every page and API response.
const securityHeaders = [
  // Always use HTTPS (2 years, including subdomains).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Don't let browsers guess file types (stops uploaded files being run as scripts).
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Nobody can show this site inside a frame (clickjacking).
  { key: 'X-Frame-Options', value: 'DENY' },
  // Only send the site name, not full URLs (which can contain signed file links), to other sites.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Turn off browser features the app never uses.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  // Isolate the window from other sites, but still allow the Google sign-in pop-up.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  // Restrictions that don't affect scripts or styles: no plugins, no <base> hijacking,
  // forms only post to this site, no framing.
  { key: 'Content-Security-Policy', value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  images: {
    // Uploaded files are served from /api/files/... with a ?sig= query string.
    localPatterns: [
      { pathname: '/api/files/**' },
      { pathname: '/**', search: '' },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com'
      }
    ],
  },
  experimental: {
    // Other experimental features can go here
  },
};

export default nextConfig;
