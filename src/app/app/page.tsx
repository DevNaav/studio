
'use client';

import { SidebarProvider } from '@/components/ui/sidebar';
import { AppClient } from '@/app/app-client';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import ClientLayout from '../client-layout';

export default function AppPage() {
  // Data fetching is now handled on the client side to avoid server-side bottlenecks.
  // The initial empty arrays will be populated by client-side hooks.
  return (
    <ClientLayout>
      <SidebarProvider>
        <Suspense
          fallback={
            <div className="flex h-screen w-full items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          }
        >
          <AppClient initialAllCompanies={[]} initialSites={[]} />
        </Suspense>
      </SidebarProvider>
    </ClientLayout>
  );
}
