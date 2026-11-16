
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { Inter, Source_Code_Pro } from 'next/font/google';
import { AuthProvider } from '@/context/auth-context';
import { SITE_URL } from '@/lib/site';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-source-code-pro',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Inventra',
  description: 'Construction Site Management App to track inventory, expenses, and labor.',
  // Link previews on WhatsApp, LinkedIn, etc.
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Inventra',
    title: 'Inventra: construction and manufacturing management',
    description: 'Track sites, labour, materials, machines, sales and payments in one place.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${sourceCodePro.variable}`}>
      <head>
          <meta name="description" content="A comprehensive construction management application to track site inventory, log expenses, manage labor, and generate reports." />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
