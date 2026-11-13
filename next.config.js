
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  output: 'standalone',
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
