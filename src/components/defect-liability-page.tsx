'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Site, DefectLiability, Expense, MaintenanceLog } from '@/lib/types';
import { onGlobalCollectionSnapshot, addDocWithSiteId, updateDocWithId, softDeleteDocWithId, useSite, onSubCollectionSnapshot } from '@/context/site-context';
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
import { format, isPast, isWithinInterval, addDays, differenceInDays, endOfDay, isAfter, isBefore } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { AddLiabilityExpenseDialog } from './add-liability-expense-dialog';

interface DefectLiabilityPageProps {
    companyId: string | null | undefined;
}

export function DefectLiabilityPage({ companyId }: DefectLiabilityPageProps) {
    const { sites, setSelectedSiteId, setActiveView } = useSite();
    const [liabilities, setLiabilities] = useState<DefectLiability[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedLiability, setSelectedLiability] = useState<DefectLiability | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
    const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
    const [liabilityForExpense, setLiabilityForExpense] = useState<DefectLiability | null>(null);
    const { toast } = useToast();
    
    useEffect(() => {
        if (!companyId) {
            setIsLoading(false);
            return;
        }
        
        let loadedCollections = 0;
        const totalCollections = 3;

        const checkLoading = () => {
            loadedCollections++;
            if(loadedCollections === totalCollections) {
                setIsLoading(false);
            }
        }

        const unsubLiabilities = onGlobalCollectionSnapshot<DefectLiability>('defect_liabilities', companyId, (data) => {
            setLiabilities(data.filter(l => !l.isDeleted));
            checkLoading();
        });

        // Fetch all expenses to filter later
        const unsubExpenses = onGlobalCollectionSnapshot<Expense>('expenses', companyId, (data) => {
             setExpenses(data);
             checkLoading();
        });

        const unsubMaintenance = onGlobalCollectionSnapshot<MaintenanceLog>('maintenance_logs', companyId, (data) => {
            setMaintenanceLogs(data);
            checkLoading();
        });

        return () => {
            unsubLiabilities();
            unsubExpenses();
            unsubMaintenance();
        };
    }, [companyId]);
    
    const { activeLiabilities, expiringSoon, expiredLiabilities } = useMemo(() => {
        const today = new Date();
        const sixtyDaysFromNow = addDays(today, 60);

        const active = liabilities.filter(l => !isPast(endOfDay(new Date(l.endDate))));
        const expiring = active.filter(l => isWithinInterval(new Date(l.endDate), { start: today, end: sixtyDaysFromNow }));
        const expired = liabilities.filter(l => isPast(endOfDay(new Date(l.endDate))));
        
        return { activeLiabilities: active, expiringSoon: expiring, expiredLiabilities: expired };
    }, [liabilities]);

    const handleOpenDeleteDialog = (liability: DefectLiability) => {
        setSelectedLiability(liability);
        setIsDeleteDialogOpen(true);
    };
    
    const handleSiteNavigation = (siteId: string) => {
        setSelectedSiteId(siteId);
        setActiveView('sites');
    }

    const handleDeleteConfirm = async () => {
        if (selectedLiability) {
            await softDeleteDocWithId('defect_liabilities', selectedLiability.id);
            toast({ title: "Liability Record Deleted" });
        }
        setIsDeleteDialogOpen(false);
    };

    const getSiteName = (siteId: string) => sites.find(s => s.id === siteId)?.name || 'Unknown Site';
    
    const getExpensesForLiability = (liability: DefectLiability) => {
        return expenses.filter(e => e.siteId === liability.siteId && new Date(e.date) >= new Date(liability.completionDate) && new Date(e.date) <= new Date(liability.endDate));
    }
    
    const getMaintenanceExpenseForLiability = (liability: DefectLiability) => {
        return maintenanceLogs
            .filter(log => {
                // Only maintenance that was charged to this site (logs record the machine's site when created).
                if (log.siteId !== liability.siteId || log.costAllocation === 'General Expenses') return false;
                
                const logDate = new Date(log.scheduledDate);
                const completionDate = new Date(liability.completionDate);
                const liabilityEndDate = new Date(liability.endDate);

                return isAfter(logDate, completionDate) && isBefore(logDate, liabilityEndDate);
            })
            .reduce((sum, log) => sum + (log.cost || 0), 0);
    }
    
    const handleReleaseRetention = async (e: React.MouseEvent, liability: DefectLiability) => {
        e.stopPropagation(); // Prevent row click from firing
        try {
            await updateDocWithId('defect_liabilities', liability.id, {
                retentionReleased: true,
                releasedAt: new Date().toISOString(),
            });
            toast({ title: 'Retention Released', description: `Retention for ${getSiteName(liability.siteId)} has been marked as released.`});
        } catch(e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update retention status.' });
        }
    }

    const handleOpenExpenseDialog = (liability: DefectLiability) => {
        setLiabilityForExpense(liability);
        setIsExpenseDialogOpen(true);
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
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShieldCheck />Defect Liability</CardTitle>
                    <CardDescription>Monitor defect liability periods and retention amounts for all your completed projects.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" defaultValue={['Expiring Soon (within 60 days)', 'Active']}>
                         {activeLiabilities.length > 0 && (
                            <AccordionItem value="Active">
                                <AccordionTrigger className="text-lg font-semibold"><CheckCircle className="h-5 w-5 mr-2 text-green-500"/>Active ({activeLiabilities.length})</AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Site</TableHead>
                                                <TableHead>Completion Date</TableHead>
                                                <TableHead>Time Left</TableHead>
                                                <TableHead>Retention Amount</TableHead>
                                                <TableHead>Maintenance Expense</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {activeLiabilities.map(l => (
                                                <TableRow key={l.id} className="cursor-pointer" onClick={() => handleSiteNavigation(l.siteId)}>
                                                    <TableCell>{getSiteName(l.siteId)}</TableCell>
                                                    <TableCell>{format(new Date(l.completionDate), 'PPP')}</TableCell>
                                                    <TableCell>{differenceInDays(endOfDay(new Date(l.endDate)), new Date())} days</TableCell>
                                                    <TableCell>₹{l.retentionAmount.toLocaleString()}</TableCell>
                                                    <TableCell>₹{getMaintenanceExpenseForLiability(l).toLocaleString()}</TableCell>
                                                    <TableCell>{l.retentionReleased ? 'Released' : 'Held'}</TableCell>
                                                     <TableCell className="text-right">
                                                        {!l.retentionReleased && <Button size="sm" onClick={(e) => handleReleaseRetention(e, l)}>Release Retention</Button>}
                                                     </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                         )}
                          {expiredLiabilities.length > 0 && (
                             <AccordionItem value="Expired">
                                <AccordionTrigger className="text-lg font-semibold"><XCircle className="h-5 w-5 mr-2 text-red-500"/>Expired ({expiredLiabilities.length})</AccordionTrigger>
                                <AccordionContent>
                                     <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Site</TableHead>
                                                <TableHead>End Date</TableHead>
                                                <TableHead>Retention Amount</TableHead>
                                                <TableHead>Maintenance Expense</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {expiredLiabilities.map(l => (
                                                <TableRow key={l.id} className="cursor-pointer" onClick={() => handleSiteNavigation(l.siteId)}>
                                                    <TableCell>{getSiteName(l.siteId)}</TableCell>
                                                    <TableCell>{format(new Date(l.endDate), 'PPP')}</TableCell>
                                                    <TableCell>₹{l.retentionAmount.toLocaleString()}</TableCell>
                                                    <TableCell>₹{getMaintenanceExpenseForLiability(l).toLocaleString()}</TableCell>
                                                    <TableCell>{l.retentionReleased ? `Released on ${l.releasedAt ? format(new Date(l.releasedAt), 'PPP') : 'N/A'}` : 'Held'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                          )}
                           {liabilities.map(l => (
                            <AccordionItem key={`details-${l.id}`} value={`details-${l.id}`}>
                                <AccordionTrigger>{getSiteName(l.siteId)} Details</AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-4">
                                        {l.shiftedMaterials && l.shiftedMaterials.destinations && (
                                            <div>
                                                <h4 className="font-semibold">Shifted Materials</h4>
                                                <p>Shifting Cost: <span className="font-mono">₹{l.shiftedMaterials.shiftingCost.toLocaleString()}</span></p>
                                                {Object.entries(l.shiftedMaterials.destinations).map(([destination, items]) => (
                                                  <div key={destination} className="mt-2">
                                                      <h5 className="font-medium">To: {destination}</h5>
                                                      <Table>
                                                          <TableHeader><TableRow><TableHead>Material</TableHead><TableHead>Quantity</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                                                          <TableBody>
                                                              {items.map((item, idx) => (
                                                                  <TableRow key={idx}><TableCell>{item.name}</TableCell><TableCell>{item.quantity}</TableCell><TableCell>{item.status}</TableCell></TableRow>
                                                              ))}
                                                          </TableBody>
                                                      </Table>
                                                  </div>
                                                ))}
                                            </div>
                                        )}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="font-semibold">Expenses during Liability Period</h4>
                                                <Button size="sm" variant="outline" onClick={() => handleOpenExpenseDialog(l)}>
                                                    <Plus className="mr-2 h-4 w-4" /> Log Maintenance Expense
                                                </Button>
                                            </div>
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {getExpensesForLiability(l).length > 0 ? getExpensesForLiability(l).map(exp => (
                                                        <TableRow key={exp.id}>
                                                            <TableCell>{exp.date}</TableCell>
                                                            <TableCell>{exp.description}</TableCell>
                                                            <TableCell className="text-right">₹{exp.amount.toLocaleString()}</TableCell>
                                                        </TableRow>
                                                    )) : <TableRow><TableCell colSpan={3} className="text-center">No expenses logged during this period.</TableCell></TableRow>}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>

            <DeleteConfirmationDialog 
                open={isDeleteDialogOpen} 
                onOpenChange={setIsDeleteDialogOpen} 
                onConfirm={handleDeleteConfirm}
                title="Delete Defect Liability Record"
                description={`Are you sure you want to delete this record for ${getSiteName(selectedLiability?.siteId || '')}? This action cannot be undone.`}
            />

            {liabilityForExpense && companyId && (
              <AddLiabilityExpenseDialog
                open={isExpenseDialogOpen}
                onOpenChange={setIsExpenseDialogOpen}
                liability={liabilityForExpense}
                companyId={companyId}
              />
            )}
        </>
    );
}
