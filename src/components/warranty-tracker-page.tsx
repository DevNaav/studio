
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Site, Warranty, WarrantyType } from '@/lib/types';
import { onGlobalCollectionSnapshot, addDocWithSiteId, updateDocWithId, softDeleteDocWithId, useSite } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Plus, ShieldCheck, Edit, Trash2, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import { format, isPast, isWithinInterval, addDays, differenceInDays, endOfDay } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { AddWarrantyDialog } from './add-warranty-dialog';

const formSchema = z.object({
  siteId: z.string().min(1, 'Please select a site.'),
  startDate: z.string().min(1, 'Start date is required.'),
  endDate: z.string().min(1, 'End date is required.'),
  notes: z.string().optional(),
}).refine(data => new Date(data.endDate) > new Date(data.startDate), {
    message: "End date must be after start date.",
    path: ["endDate"],
});


interface WarrantyTrackerPageProps {
    companyId: string | null | undefined;
}

export function WarrantyTrackerPage({ companyId }: WarrantyTrackerPageProps) {
    const { sites, updateSite } = useSite();
    const [warranties, setWarranties] = useState<Warranty[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedWarranty, setSelectedWarranty] = useState<Warranty | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const { userProfile } = useAuth();
    const company = userProfile?.companyId ? { name: userProfile.name } : null;

    useEffect(() => {
        if (!companyId) {
            setIsLoading(false);
            return;
        }

        const unsubWarranties = onGlobalCollectionSnapshot<Warranty>('warranties', companyId, (data) => {
            setWarranties(data.filter(w => !w.isDeleted));
            setIsLoading(false);
        });

        return () => {
            unsubWarranties();
        };
    }, [companyId]);
    
    const { activeWarranties, expiringSoon, expiredWarranties } = useMemo(() => {
        const today = new Date();
        const sixtyDaysFromNow = addDays(today, 60);

        const active = warranties.filter(w => !isPast(endOfDay(new Date(w.endDate))));
        const expiring = active.filter(w => isWithinInterval(new Date(w.endDate), { start: today, end: sixtyDaysFromNow }));
        const expired = warranties.filter(w => isPast(endOfDay(new Date(w.endDate))));
        
        return { activeWarranties: active, expiringSoon: expiring, expiredWarranties: expired };
    }, [warranties]);

    useEffect(() => {
        expiredWarranties.forEach(warranty => {
            const site = sites.find(s => s.id === warranty.siteId);
            // Only update if the site exists and is currently in 'Warranty Pending' status
            if (site && site.status === 'Warranty Pending') {
                updateSite({ ...site, status: 'Completed' });
                toast({
                    title: "Site Status Updated",
                    description: `Warranty for "${site.name}" has expired. Site status is now "Completed".`
                });
            }
        });
    }, [expiredWarranties, sites, updateSite, toast]);

    const handleOpenDialog = (warranty: Warranty | null = null) => {
        setSelectedWarranty(warranty);
        setIsDialogOpen(true);
    };

    const handleOpenDeleteDialog = (warranty: Warranty) => {
        setSelectedWarranty(warranty);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (selectedWarranty) {
            await softDeleteDocWithId('warranties', selectedWarranty.id);
            toast({ title: "Warranty Deleted" });
        }
        setIsDeleteDialogOpen(false);
    };

    const getSiteName = (siteId: string) => sites.find(s => s.id === siteId)?.name || 'Unknown Site';

    const WarrantyList = ({ title, warranties, icon, defaultOpen = false }: { title: string, warranties: Warranty[], icon: React.ReactNode, defaultOpen?: boolean }) => {
        if (warranties.length === 0) return null;
        return (
            <AccordionItem value={title}>
                <AccordionTrigger className="text-lg font-semibold">{icon}{title} ({warranties.length})</AccordionTrigger>
                <AccordionContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead>Site</TableHead>
                                <TableHead>Purchase Date</TableHead>
                                <TableHead>End Date</TableHead>
                                <TableHead>Time Left</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {warranties.map(w => {
                                const daysLeft = differenceInDays(endOfDay(new Date(w.endDate)), new Date());
                                return (
                                    <TableRow key={w.id}>
                                        <TableCell>{w.productName}</TableCell>
                                        <TableCell>{w.vendorInfo}</TableCell>
                                        <TableCell>{getSiteName(w.siteId)}</TableCell>
                                        <TableCell>{format(new Date(w.purchaseDate), 'PPP')}</TableCell>
                                        <TableCell>{format(new Date(w.endDate), 'PPP')}</TableCell>
                                        <TableCell>{daysLeft >= 0 ? `${daysLeft} days` : 'Expired'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(w)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(w)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </AccordionContent>
            </AccordionItem>
        );
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2"><ShieldCheck />Warranty Tracker</CardTitle>
                        <CardDescription>Monitor warranties for all your construction projects.</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" /> Add Warranty</Button>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" defaultValue={['Expiring Soon (within 60 days)', 'Active']}>
                        <WarrantyList title="Expiring Soon (within 60 days)" warranties={expiringSoon} icon={<AlertTriangle className="h-5 w-5 mr-2 text-orange-500"/>} defaultOpen />
                        <WarrantyList title="Active" warranties={activeWarranties.filter(w => !expiringSoon.includes(w))} icon={<CheckCircle className="h-5 w-5 mr-2 text-green-500"/>} defaultOpen />
                        <WarrantyList title="Expired" warranties={expiredWarranties} icon={<XCircle className="h-5 w-5 mr-2 text-red-500"/>} />
                    </Accordion>
                </CardContent>
            </Card>

            <AddWarrantyDialog
              isOpen={isDialogOpen}
              onOpenChange={setIsDialogOpen}
              sites={sites}
              companyId={companyId}
              existingWarranty={selectedWarranty}
            />

            <DeleteConfirmationDialog 
                open={isDeleteDialogOpen} 
                onOpenChange={setIsDeleteDialogOpen} 
                onConfirm={handleDeleteConfirm}
                title="Delete Warranty"
                description={`Are you sure you want to delete this warranty for ${selectedWarranty?.productName}? This action cannot be undone.`}
            />
        </>
    );
}

    