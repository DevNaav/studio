
'use client';

import { useEffect, useState, useMemo } from 'react';
import { InventoryItem } from '@/lib/types';
import { onGlobalCollectionSnapshot } from '@/context/site-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';
import { Loader2, Warehouse, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ScrollArea } from './ui/scroll-area';

interface WarehouseSummaryCardProps {
    companyId: string | null | undefined;
}

export function WarehouseSummaryCard({ companyId }: WarehouseSummaryCardProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const unsubInventory = onGlobalCollectionSnapshot<InventoryItem>('inventory', companyId, (items) => {
        setInventory(items.filter(item => item.type === 'Material' && !item.isDeleted && item.siteId === 'main'));
        setLoading(false);
    });

    return () => {
      unsubInventory();
    };
  }, [companyId]);
  
  const warehouseSummary = useMemo(() => {
    const summary: { [key: string]: { name: string; stored: number; totalCost: number; lowStockThreshold?: number; unit?: string; } } = {};

    inventory.forEach(item => {
        const normalizedName = item.name.trim().toLowerCase();
        if (!summary[normalizedName]) {
            summary[normalizedName] = { name: item.name, stored: 0, totalCost: 0 };
        }
    });

    for (const key in summary) {
        const materialItems = inventory.filter(item => item.name.trim().toLowerCase() === key);
        
        const totalStored = materialItems
            .filter(item => item.status === 'Stored')
            .reduce((acc, item) => acc + item.quantity, 0);

        const totalUsed = materialItems
            .filter(item => item.status === 'Used')
            .reduce((acc, item) => acc + item.quantity, 0);

        const storedQuantity = totalStored - totalUsed;
        summary[key].stored = storedQuantity;

        const storedItems = materialItems.filter(item => item.status === 'Stored');
        const totalStoredCost = storedItems.reduce((acc, item) => acc + ((item.pricePerUnit || 0) * item.quantity), 0);
        const totalStoredQuantity = storedItems.reduce((acc, item) => acc + item.quantity, 0);
        const avgPrice = totalStoredQuantity > 0 ? totalStoredCost / totalStoredQuantity : 0;
        
        summary[key].totalCost = storedQuantity * avgPrice;

        const latestEntry = materialItems.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        if (latestEntry) {
            summary[key].unit = latestEntry.unit;
            summary[key].lowStockThreshold = latestEntry.lowStockThreshold;
        }
    }

    return Object.values(summary).filter(item => item.stored > 0.001);
  }, [inventory]);

  return (
     <Card className="tw-neon scroll-anim relative">
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Warehouse /> Warehouse Stock</CardTitle>
            <CardDescription>Current inventory in the main warehouse.</CardDescription>
        </CardHeader>
        <CardContent>
            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : warehouseSummary.length > 0 ? (
                <ScrollArea className="h-48">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Material</TableHead>
                                <TableHead className="text-right">Stock</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {warehouseSummary.map(item => (
                                <TableRow key={item.name} className={item.lowStockThreshold && item.stored <= item.lowStockThreshold ? 'bg-destructive/10' : ''}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        {item.lowStockThreshold && item.stored <= item.lowStockThreshold && (
                                            <AlertTriangle className="h-4 w-4 text-destructive" />
                                        )}
                                        {item.name}
                                    </TableCell>
                                    <TableCell className="text-right">{item.stored.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})} {item.unit}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                    <div className="w-16 h-16 border-2 border-dashed border-primary/50 rounded-lg animate-pulse mb-2" />
                    <p>Warehouse is empty.</p>
                </div>
            )}
        </CardContent>
        <div className="absolute top-4 right-4 text-primary opacity-20">
          <Warehouse className="w-16 h-16" strokeWidth={1.5} />
        </div>
    </Card>
  );
}
