

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { InventoryItem, inventoryStatuses, Site } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Warehouse, AlertTriangle, Loader2, Edit, Trash2, HardHat, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { onGlobalCollectionSnapshot, addDocToGlobalCollection, addDocWithSiteId, updateDocWithId, softDeleteDocWithId, useSite } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import { Separator } from './ui/separator';
import Papa from 'papaparse';
import { writeBatch, doc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

const formSchema = z.object({
  name: z.string({ required_error: "Please select a material." }).min(1, { message: 'Please select a material.' }),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  pricePerUnit: z.coerce.number().min(0, 'Price must be a positive number').optional(),
  unit: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  lowStockThreshold: z.coerce.number().min(0).optional(),
});

const newMaterialFormSchema = z.object({
  newMaterialName: z.string().min(2, 'Material name must be at least 2 characters.'),
  subType: z.string().optional(),
});

const transferFormSchema = z.object({
    siteId: z.string().min(1, 'Please select a site.'),
    quantity: z.coerce.number().min(1, 'Quantity must be greater than 0'),
    transportCost: z.coerce.number().min(0).optional(),
    transferAs: z.enum(['Material', 'Tool'], { required_error: 'You must select a transfer type.'}),
});


interface WarehousePageProps {
  companyId: string | null | undefined;
}

export function WarehousePage({ companyId }: WarehousePageProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNewMaterialDialogOpen, setIsNewMaterialDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemToTransfer, setItemToTransfer] = useState<{ name: string; stored: number; } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { sites } = useSite();

  useEffect(() => {
    if (!companyId) return;

    const unsubInventory = onGlobalCollectionSnapshot<InventoryItem>('inventory', companyId, (items) => {
        setInventory(items.filter(item => item.type === 'Material' && !item.isDeleted));
    });

    return () => {
      unsubInventory();
    };
  }, [companyId]);

  const warehouseSummary = useMemo(() => {
    const summary: { [key: string]: { name: string; stored: number; totalCost: number; lowStockThreshold?: number; unit?: string; } } = {};
    
    const warehouseItems = inventory.filter(item => item.siteId === 'main');
    
    warehouseItems.forEach(item => {
        if (!summary[item.name]) {
            summary[item.name] = { name: item.name, stored: 0, totalCost: 0, unit: item.unit };
        }
        
        if (item.status === 'Stored') {
            summary[item.name].stored += item.quantity;
            if(item.pricePerUnit) {
                summary[item.name].totalCost += item.pricePerUnit * item.quantity;
            }
        } else if (item.status === 'Used') {
            summary[item.name].stored -= item.quantity;
            const priceToDeduct = item.pricePerUnit || (summary[item.name].totalCost / summary[item.name].stored) || 0;
            if(isFinite(priceToDeduct)){
                summary[item.name].totalCost -= priceToDeduct * item.quantity;
            }
        }

        if(item.lowStockThreshold) {
            summary[item.name].lowStockThreshold = item.lowStockThreshold;
        }
        if(item.unit) {
            summary[item.name].unit = item.unit;
        }
    });

    return Object.values(summary).filter(item => item.stored > 0);
  }, [inventory]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      quantity: 1,
      pricePerUnit: 0,
      unit: '',
      date: new Date().toISOString().split('T')[0],
      lowStockThreshold: 0,
    },
  });

  const newMaterialForm = useForm<z.infer<typeof newMaterialFormSchema>>({ 
    resolver: zodResolver(newMaterialFormSchema),
    defaultValues: {
      newMaterialName: '',
      subType: '',
    }
  });

  const transferForm = useForm<z.infer<typeof transferFormSchema>>({ resolver: zodResolver(transferFormSchema) });

  const handleOpenDialog = (item: InventoryItem | null = null) => {
    setSelectedItem(item);
    form.reset(item ? {
        name: item.name,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit || 0,
        date: item.date,
        lowStockThreshold: item.lowStockThreshold || 0,
        unit: item.unit || '',
    } : {
        name: '',
        quantity: 1,
        pricePerUnit: 0,
        unit: '',
        date: new Date().toISOString().split('T')[0],
        lowStockThreshold: 0,
    });
    setIsDialogOpen(true);
  };

  const handleOpenTransferDialog = (item: { name: string; stored: number; }) => {
    setItemToTransfer(item);
    transferForm.reset({ siteId: undefined, quantity: 1, transportCost: 0, transferAs: 'Material' });
    setIsTransferDialogOpen(true);
  };

  const handleOpenDeleteDialog = (item: { name: string; stored: number }) => {
    const latestItem = inventory
      .filter(i => i.name === item.name && i.siteId === 'main')
      .sort((a,b) => new Date(b.date).getTime() - (new Date(a.date).getTime()))[0];
    if (latestItem) {
      setSelectedItem(latestItem);
      setIsDeleteDialogOpen(true);
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not find the item to delete.",
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (selectedItem) {
      await softDeleteDocWithId('inventory', selectedItem.id);
      toast({ title: "Item Deleted", description: `"${selectedItem.name}" has been marked as deleted.` });
    }
    setIsDeleteDialogOpen(false);
    setSelectedItem(null);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!companyId) return;
    setIsSubmitting(true);
    const itemData = {
      ...values,
      siteId: 'main', // Warehouse specific
      type: 'Material' as const,
      status: 'Stored' as const,
    };
    try {
        if (selectedItem) {
            await updateDocWithId('inventory', selectedItem.id, itemData);
            toast({ title: 'Material Updated' });
        } else {
            await addDocToGlobalCollection('inventory', companyId, itemData);
            toast({ title: 'Material Added to Warehouse' });
        }
        setIsDialogOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save material.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const onNewMaterialSubmit = async (values: z.infer<typeof newMaterialFormSchema>) => {
    if (!companyId) return;
    setIsSubmitting(true);
    try {
      const finalName = values.subType ? `${values.newMaterialName} (${values.subType})` : values.newMaterialName;
      await addDocToGlobalCollection('inventory', companyId, {
        name: finalName,
        type: 'Material',
        status: 'Stored',
        quantity: 0,
        siteId: 'main',
        date: new Date().toISOString().split('T')[0],
      });
      toast({ title: 'New Material Type Added' });
      setIsNewMaterialDialogOpen(false);
      newMaterialForm.reset();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add new material type.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onTransferSubmit = async (values: z.infer<typeof transferFormSchema>) => {
    if (!companyId || !itemToTransfer) return;
    setIsSubmitting(true);
    const batch = writeBatch(db);
    const date = new Date().toISOString().split('T')[0];
    
    // Calculate average price from warehouse stock
    const warehouseStockItems = inventory.filter(item => item.siteId === 'main' && item.name === itemToTransfer.name && item.status === 'Stored' && item.pricePerUnit);
    const totalCost = warehouseStockItems.reduce((acc, item) => acc + (item.pricePerUnit! * item.quantity), 0);
    const totalQuantity = warehouseStockItems.reduce((acc, item) => acc + item.quantity, 0);
    const avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
    
    // 1. "Use" material from warehouse inventory
    const usedRecordRef = doc(collection(db, 'inventory'));
    batch.set(usedRecordRef, {
        companyId,
        siteId: 'main',
        name: itemToTransfer.name,
        type: 'Material',
        status: 'Used',
        quantity: values.quantity,
        date: date,
        pricePerUnit: avgPrice, // Log price at time of use
        description: `Transferred to site ${sites.find(s => s.id === values.siteId)?.name || 'Unknown'} as ${values.transferAs}`,
        isDeleted: false,
    });
    
    // 2. Add to destination site
    if (values.transferAs === 'Material') {
      const boughtRecordRef = doc(collection(db, 'inventory'));
      batch.set(boughtRecordRef, {
          companyId,
          siteId: values.siteId,
          name: itemToTransfer.name,
          type: 'Material',
          status: 'Bought',
          quantity: values.quantity,
          pricePerUnit: avgPrice, // Carry over the average price
          date: date,
          description: `Transferred from Warehouse`,
          isDeleted: false,
      });
    } else { // Transfer as Tool
      const toolRecordRef = doc(collection(db, 'tools'));
      batch.set(toolRecordRef, {
        companyId,
        siteId: values.siteId,
        name: itemToTransfer.name,
        quantity: values.quantity,
        status: 'Good', // Default status for new tools
        price: avgPrice, // Store the value as price
        isDeleted: false,
      });
    }


    // 3. Log transport cost as an expense for the destination site
    if (values.transportCost && values.transportCost > 0) {
      const expenseRecordRef = doc(collection(db, 'expenses'));
      batch.set(expenseRecordRef, {
        companyId,
        siteId: values.siteId,
        description: `Transport cost for ${itemToTransfer.name} from warehouse`,
        category: 'Transport',
        amount: values.transportCost,
        date: date,
        isDeleted: false,
      });
    }
    
    try {
        await batch.commit();
        toast({ title: 'Transfer Successful', description: `${values.quantity} units of ${itemToTransfer.name} moved to site.` });
        setIsTransferDialogOpen(false);
    } catch(e) {
        console.error('Transfer failed:', e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to transfer material.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    const dataToExport = warehouseSummary.map(({ name, stored, totalCost, lowStockThreshold, unit }) => ({
        'Material Name': name,
        'Stock Quantity': `${stored} ${unit || ''}`.trim(),
        'Total Stock Value': totalCost.toFixed(2),
        'Low Stock Threshold': lowStockThreshold || 'Not set',
    }));
    // Papa.unparse is synchronous and returns the CSV text (it has no "complete" callback).
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'warehouse-summary.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!companyId) return <Card><CardHeader><CardTitle>Warehouse</CardTitle><CardDescription>Select a company to view the warehouse.</CardDescription></CardHeader></Card>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Warehouse /> Warehouse Inventory</CardTitle>
            <CardDescription>Central inventory for all materials not assigned to a specific site.</CardDescription>
          </div>
           <div className="flex gap-2">
            <Button onClick={() => setIsNewMaterialDialogOpen(true)} variant="outline">Add Material Type</Button>
            <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" /> Add Stock</Button>
          </div>
        </CardHeader>
        <CardContent>
           <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={warehouseSummary.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export Summary
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Total Stock Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouseSummary.length > 0 ? (
                warehouseSummary.map((item) => (
                  <TableRow key={item.name} className={item.lowStockThreshold && item.stored <= item.lowStockThreshold ? 'bg-destructive/10' : ''}>
                    <TableCell className="font-medium flex items-center gap-2">
                      {item.lowStockThreshold && item.stored <= item.lowStockThreshold && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                      {item.name}
                    </TableCell>
                    <TableCell>{item.stored.toLocaleString()} {item.unit}</TableCell>
                    <TableCell>₹{item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right space-x-2">
                       <Button variant="outline" size="sm" onClick={() => handleOpenTransferDialog(item)}>
                        <HardHat className="mr-2 h-4 w-4" /> Transfer to Site
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                          const latestItem = inventory.filter(i => i.name === item.name && i.siteId === 'main').sort((a,b) => new Date(b.date).getTime() - (new Date(a.date).getTime()))[0];
                          if(latestItem) handleOpenDialog(latestItem);
                        }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(item)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">Warehouse is empty.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Add/Edit Stock Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Edit' : 'Add'} Material to Warehouse</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Material</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a material" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Array.from(new Set(inventory.map(i => i.name))).map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="unit" render={({ field }) => (<FormItem><FormLabel>Unit (e.g., bags, tons)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="pricePerUnit" render={({ field }) => (<FormItem><FormLabel>Price per Unit (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (<FormItem><FormLabel>Low Stock Threshold (Optional)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* New Material Type Dialog */}
       <Dialog open={isNewMaterialDialogOpen} onOpenChange={setIsNewMaterialDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Add New Material Type</DialogTitle>
                <DialogDescription>
                    Create a new type of material that can be tracked across all sites.
                </DialogDescription>
            </DialogHeader>
            <Form {...newMaterialForm}>
                <form onSubmit={newMaterialForm.handleSubmit(onNewMaterialSubmit)} className="space-y-4 py-4">
                    <FormField
                        control={newMaterialForm.control}
                        name="newMaterialName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>New Material Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., Copper Wiring" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={newMaterialForm.control}
                        name="subType"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Sub-type (Optional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., 2.5mm, Red" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsNewMaterialDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Add Type
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
      
      {/* Transfer Dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer {itemToTransfer?.name}</DialogTitle>
            <DialogDescription>Move stock from the warehouse to a construction site.</DialogDescription>
          </DialogHeader>
          <Form {...transferForm}>
            <form onSubmit={transferForm.handleSubmit(onTransferSubmit)} className="space-y-4">
               <div className="p-4 bg-muted rounded-md text-sm">
                    Available in warehouse: <span className="font-bold">{itemToTransfer?.stored.toLocaleString()}</span>
                </div>
              <FormField control={transferForm.control} name="siteId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Destination Site</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a site" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {sites.filter(s => s.status !== 'Completed').map(site => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={transferForm.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity to Transfer</FormLabel>
                  <FormControl><Input type="number" max={itemToTransfer?.stored} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
               <FormField control={transferForm.control} name="transferAs" render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel>Transfer as</FormLabel>
                        <FormControl>
                            <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex space-x-4"
                            >
                            <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="Material" /></FormControl>
                                <FormLabel className="font-normal">Material</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="Tool" /></FormControl>
                                <FormLabel className="font-normal">Tool</FormLabel>
                            </FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
              <FormField control={transferForm.control} name="transportCost" render={({ field }) => (
                <FormItem>
                  <FormLabel>Transport Cost (₹) (Optional)</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g. 500" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsTransferDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm Transfer</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Warehouse Item"
        description={`Are you sure you want to delete this warehouse item? This will only remove the last entry and might not clear the stock if there are multiple entries.`}
      />
    </div>
  );
}
