'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Factory } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Site } from '@/lib/types';
import { SalesPage } from './sales-page';
import { ManufacturingSummary } from './manufacturing-summary';

interface ManufacturingPageProps {
  companyId: string | null | undefined;
}

export function ManufacturingPage({ companyId }: ManufacturingPageProps) {
  // This component is now a hub. Data fetching and display are delegated
  // to the summary and sales components. We'll pass the 'manufacturing'
  // siteId to them to scope their data.
  const manufacturingSiteId = 'manufacturing';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Factory /> Manufacturing & Sales</CardTitle>
          <CardDescription>
            Track production activities, material consumption, and sales.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="sales">Sales & Transfers</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
           <ManufacturingSummary companyId={companyId} />
        </TabsContent>
        <TabsContent value="sales">
           <SalesPage companyId={companyId} siteId={manufacturingSiteId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
