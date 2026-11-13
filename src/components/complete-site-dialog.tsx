
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Site, InventoryItem, Machine, Labor, Company, DefectLiability, ShiftedMaterialStatus, RentedMaterial, Tool, ToolStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Loader2 } from 'lucide-react';
import { getSubCollection, onGlobalCollectionSnapshot, addDocToGlobalCollection, onSubCollectionSnapshot } from '@/context/site-context';
import { ReleaseAssetsDialog } from './release-assets-dialog';
import { writeBatch, doc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/context/site-context';
import { todayISO } from '@/lib/utils';
import { logActivity } from '@/lib/activity-log';

const formSchema = z.object({
  completionDate: z.string().min(1, 'Completion date is required.'),
  endDate: z.string().min(1, 'End date is required.'),
  retentionAmount: z.coerce.number().min(0, "Retention amount must be a non-negative number."),
  notes: z.string().optional(),
}).refine(data => new Date(data.endDate) > new Date(data.completionDate), {
    message: "End date must be after completion date.",
    path: ["endDate"],
});


interface CompleteSiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: Site;
  company?: Company;
}

export function CompleteSiteDialog({ open, onOpenChange, site, company }: CompleteSiteDialogProps) {
  const [view, setView] = useState<'liability' | 'release_assets'>('liability');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const { sites } = useSite();
  
  const [materialsToMove, setMaterialsToMove] = useState<InventoryItem[]>([]);
  const [machinesToRelease, setMachinesToRelease] = useState<Machine[]>([]);
  const [laborersToRelease, setLaborersToRelease] = useState<Labor[]>([]);
  const [rentedMaterialsToRelease, setRentedMaterialsToRelease] = useState<RentedMaterial[]>([]);
  const [toolsToMove, setToolsToMove] = useState<Tool[]>([]);
  
  const [liabilityData, setLiabilityData] = useState<z.infer<typeof formSchema> | null>(null);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        completionDate: todayISO(),
        endDate: '',
        retentionAmount: 0,
        notes: '',
    }
  });
  
  useEffect(() => {
    if (open) {
      setView('liability');
      form.reset({
        completionDate: todayISO(),
        endDate: '',
        retentionAmount: (site.budget || 0) * 0.10, // Default to 10% of budget
        notes: '',
      });
    }
  }, [open, form, site.budget]);


  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
        setView('liability');
        setLiabilityData(null);
    }, 300);
  };
  
  
  const onLiabilitySubmit = async (values: z.infer<typeof formSchema>) => {
    if (!userProfile?.companyId) return;
    setLiabilityData(values);
    setIsSubmitting(true);
    
    try {
        const siteInventory = await getSubCollection<InventoryItem>('inventory', userProfile.companyId, site.id);
        const stockSummary: { [key: string]: { name: string; quantity: number; pricePerUnit?: number } } = {};
        
        siteInventory.forEach(item => {
            if (item.type !== 'Material' || item.isDeleted) return;
            const normalizedName = item.name.trim().toLowerCase();
            if (!stockSummary[normalizedName]) {
                stockSummary[normalizedName] = { name: item.name, quantity: 0, pricePerUnit: item.pricePerUnit };
            }
            if (item.status === 'Bought' || item.status === 'Stored') {
                stockSummary[normalizedName].quantity += item.quantity;
            } else if (item.status === 'Used') {
                stockSummary[normalizedName].quantity -= item.quantity;
            }
            if (item.pricePerUnit) stockSummary[normalizedName].pricePerUnit = item.pricePerUnit;
        });

        const stock = Object.values(stockSummary).filter(item => item.quantity > 0.001);
        setMaterialsToMove(stock.map(s => ({...s, id: '', companyId: '', siteId: site.id, type: 'Material', status: 'Stored', date: '' })));

        const siteTools = await getSubCollection<Tool>('tools', userProfile.companyId, site.id);
        setToolsToMove(siteTools.filter(t => !t.isDeleted));

        const unsubMachines = onGlobalCollectionSnapshot<Machine>('machines', userProfile.companyId, (allMachines) => {
            setMachinesToRelease(allMachines.filter(m => m.assignedSiteId === site.id));
        });

        const unsubLaborers = onGlobalCollectionSnapshot<Labor>('labors', userProfile.companyId, (allLaborers) => {
            setLaborersToRelease(allLaborers.filter(l => l.siteId === site.id));
        });

        const unsubRented = onSubCollectionSnapshot<RentedMaterial>('rented_materials', userProfile.companyId, site.id, (allRented) => {
            setRentedMaterialsToRelease(allRented.filter(r => r.status === 'Active'));
        });
        
        setView('release_assets');

        setTimeout(() => {
            unsubMachines();
            unsubLaborers();
            unsubRented();
        }, 1000);

    } catch (error) {
        console.error("Error checking assets:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not retrieve site assets."});
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const onFinalize = async (assetData: { materialTransfers: { name: string; quantity: number; destinationSiteId: string; status: ShiftedMaterialStatus }[]; toolTransfers: { name: string; quantity: number; destinationSiteId: string; status: ToolStatus }[]; shiftingCost: number }) => {
    if (!userProfile?.companyId || !liabilityData) return;
    const companyId = userProfile.companyId;
    setIsSubmitting(true);
    
    try {
        const batch = writeBatch(db);
        const date = todayISO();

        // 1. Update site status to 'Completed'
        const siteRef = doc(db, 'sites', site.id);
        batch.update(siteRef, { status: 'Completed' });

        const { materialTransfers, toolTransfers, shiftingCost } = assetData;
        const shiftedItemsByDestination = materialTransfers.reduce((acc, transfer) => {
            const destName = transfer.destinationSiteId === 'warehouse' 
                ? 'Warehouse' 
                : sites.find(s => s.id === transfer.destinationSiteId)?.name || 'Unknown Site';

            if (!acc[destName]) {
                acc[destName] = [];
            }
            acc[destName].push({ name: transfer.name, quantity: transfer.quantity, status: transfer.status });
            return acc;
        }, {} as { [key: string]: { name: string; quantity: number; status: ShiftedMaterialStatus }[] });

        const shiftedToolsByDestination = toolTransfers.reduce((acc, transfer) => {
            const destName = transfer.destinationSiteId === 'warehouse' 
                ? 'Warehouse' 
                : sites.find(s => s.id === transfer.destinationSiteId)?.name || 'Unknown Site';

            if (!acc[destName]) {
                acc[destName] = [];
            }
            acc[destName].push({ name: transfer.name, quantity: transfer.quantity, status: transfer.status });
            return acc;
        }, {} as { [key: string]: { name: string; quantity: number; status: ToolStatus }[] });

        
        // 2. Add Defect Liability record
        const liabilityRef = doc(collection(db, 'defect_liabilities'));
        const newLiability: Omit<DefectLiability, 'id'> = {
            companyId: companyId,
            siteId: site.id,
            responsibleParty: company?.name || 'Self',
            completionDate: liabilityData.completionDate,
            endDate: liabilityData.endDate,
            retentionAmount: liabilityData.retentionAmount,
            retentionReleased: false,
            isDeleted: false,
            notes: liabilityData.notes,
            shiftedMaterials: {
                destinations: shiftedItemsByDestination,
                shiftingCost: shiftingCost
            },
            shiftedTools: {
                destinations: shiftedToolsByDestination,
            }
        };
        batch.set(liabilityRef, newLiability);
        
        // 3. Handle Material Transfers
        materialTransfers.forEach(transfer => {
            const { name, quantity, destinationSiteId } = transfer;

            if (quantity > 0) {
                const usedRecordRef = doc(collection(db, 'inventory'));
                batch.set(usedRecordRef, {
                    companyId: companyId, siteId: site.id, name: name, type: 'Material',
                    status: 'Used', quantity: quantity, date, description: `Transferred on site completion to ${destinationSiteId}.`
                });

                const destinationId = destinationSiteId === 'warehouse' ? 'main' : destinationSiteId;
                const storedRecordRef = doc(collection(db, 'inventory'));
                batch.set(storedRecordRef, {
                    companyId: companyId, siteId: destinationId, name: name, type: 'Material',
                    status: 'Stored', quantity: quantity, date,
                    description: `Transferred from ${site.name}`
                });
            }
        });
        
        // Handle Tool Transfers
        toolTransfers.forEach(transfer => {
            const { name, quantity, destinationSiteId } = transfer;

            if (quantity > 0) {
                // Remove from old site
                 const oldToolRef = doc(collection(db, 'tools'));
                 batch.set(oldToolRef, {
                    companyId, siteId: site.id, name, quantity: -quantity, status: transfer.status,
                    description: `Transferred on site completion to ${destinationSiteId}.`
                 });

                // Add to new site/warehouse
                const destinationId = destinationSiteId === 'warehouse' ? 'main' : destinationSiteId;
                const newToolRef = doc(collection(db, 'tools'));
                 batch.set(newToolRef, {
                    companyId, siteId: destinationId, name, quantity, status: transfer.status,
                    description: `Transferred from ${site.name}`
                 });
            }
        });


        // 4. Handle Machine, Laborer, and Rented Material Release
        machinesToRelease.forEach(machine => {
            const machineRef = doc(db, 'machines', machine.id);
            batch.update(machineRef, { assignedSiteId: null, assignmentDate: null });
        });
        laborersToRelease.forEach(laborer => {
            const laborRef = doc(db, 'labors', laborer.id);
            batch.update(laborRef, { siteId: 'unassigned' });
        });
        rentedMaterialsToRelease.forEach(item => {
            const itemRef = doc(db, 'rented_materials', item.id);
            batch.update(itemRef, { status: 'Returned', returnDate: date });
        });


        // 5. Log shifting cost
        if (shiftingCost > 0) {
            const expenseData: any = {
                companyId,
                siteId: site.id, // Attribute cost to the source site
                description: `Asset shifting from ${site.name}`,
                category: 'Transport',
                amount: shiftingCost,
                date,
            }
            const expenseRef = doc(collection(db, 'expenses'));
            batch.set(expenseRef, expenseData);
        }
        
        await batch.commit();
        logActivity({
            companyId, siteId: site.id, action: 'update', entity: 'sites', entityId: site.id, label: site.name,
            summary: `Completed site "${site.name}" and moved its materials and tools`,
        });
        
        toast({
            title: "Site Completion Process Finalized!",
            description: `${site.name} is now 'Completed' and is being tracked for Defect Liability.`
        });
        handleClose();

    } catch (e) {
        console.error("Finalization failed:", e);
        toast({ variant: "destructive", title: "Error", description: "Could not finalize the site completion." });
    } finally {
        setIsSubmitting(false);
    }
  }


  if (!open) return null;

  if (view === 'release_assets') {
    return (
        <ReleaseAssetsDialog
            open={true}
            onOpenChange={handleClose}
            sourceSite={site}
            materialsToMove={materialsToMove}
            machinesToRelease={machinesToRelease}
            laborersToRelease={laborersToRelease}
            rentedMaterialsToRelease={rentedMaterialsToRelease}
            toolsToMove={toolsToMove}
            onAssetsReleased={onFinalize}
        />
    )
  }

  return (
    <Dialog open={open && view === 'liability'} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Step 1: Defect Liability for {site.name}</DialogTitle>
          <DialogDescription>
            Log the defect liability details. This will mark the site as 'Completed' and create a new liability tracking record.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onLiabilitySubmit)} className="space-y-4 py-4">
                 <fieldset disabled={isSubmitting} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="completionDate" render={({ field }) => (<FormItem><FormLabel>Completion Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="endDate" render={({ field }) => (<FormItem><FormLabel>Liability End Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <FormField control={form.control} name="retentionAmount" render={({ field }) => (<FormItem><FormLabel>Retention Amount (10%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Add any notes about the liability period..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                </fieldset>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Next: Release Assets
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
