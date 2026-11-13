
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { InventoryItem, inventoryStatuses, Site, BBS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, HardHat, Edit, Trash2, Download, AlertTriangle, IndianRupee, Loader2, Filter, ClipboardList, Box, Droplets, Wind, BrickWall, Layers, Construction, Paintbrush } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import { DeleteConfirmationDialog } from '../delete-confirmation-dialog';
import Papa from 'papaparse';
import { onSubCollectionSnapshot, addDocWithSiteId, updateDocWithId, softDeleteDocWithId, onGlobalCollectionSnapshot, addDocToGlobalCollection } from '@/context/site-context';
import { useSite } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { Textarea } from '../ui/textarea';
import dynamic from 'next/dynamic';
import { serverTimestamp } from 'firebase/firestore';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { todayISO } from '@/lib/utils';

const BbsDialog = dynamic(() => import('../bbs-dialog').then(mod => mod.BbsDialog), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
});


const formSchema = z.object({
  name: z.string({ required_error: "Please select a material." }).min(1, { message: 'Please select a material.' }),
  subType: z.string().optional(),
  status: z.enum(inventoryStatuses, { required_error: "Please select a status." }),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  pricePerUnit: z.coerce.number().min(0, 'Price must be a positive number').optional(),
  vendor: z.string().optional(),
  vendorNumber: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  description: z.string().optional(),
  unit: z.string().optional(),
  lowStockThreshold: z.coerce.number().min(0, 'Low stock threshold must be a positive number').optional(),
});

const newMaterialFormSchema = z.object({
  newMaterialName: z.string().min(2, 'Material name must be at least 2 characters.'),
  subType: z.string().optional(),
});

interface MaterialsTabProps {
  siteId: string;
  companyId?: string | null;
  isManufacturing?: boolean;
}

export function MaterialsTab({ siteId, companyId, isManufacturing = false }: MaterialsTabProps) {
  const [materials, setMaterials] = useState<InventoryItem[]>([]);
  const [allCompanyInventory, setAllCompanyInventory] = useState<InventoryItem[]>([]);
  const [bbsHistory, setBbsHistory] = useState<BBS[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isNewMaterialDialogOpen, setIsNewMaterialDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBbsDialogOpen, setIsBbsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const { sites } = useSite();
  const { userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [materialFilter, setMaterialFilter] = useState<string[]>([]);
  const [vendorFilter, setVendorFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  const { toast } = useToast();
  
  const currentCompanyId = companyId || userProfile?.companyId;
  const collectionName = isManufacturing ? 'manufacturing_inventory' : 'inventory';

  useEffect(() => {
    if (!siteId || !currentCompanyId) return;

    const unsubscribe = onSubCollectionSnapshot<InventoryItem>(collectionName, currentCompanyId, siteId, (data) => {
        const sortedData = data.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if(dateB !== dateA) return dateB - dateA;
            return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
        });
        setMaterials(sortedData.filter(item => item.type === 'Material'));
    });

    const unsubBbs = onSubCollectionSnapshot<BBS>('bbs', currentCompanyId, siteId, setBbsHistory);
    
    return () => {
      unsubscribe();
      unsubBbs();
    };
  }, [siteId, currentCompanyId, collectionName]);
  
  useEffect(() => {
    if (!currentCompanyId) return;
    const unsub = onGlobalCollectionSnapshot<InventoryItem>('inventory', currentCompanyId, (allCompanyItems) => {
      setAllCompanyInventory(allCompanyItems.filter(item => item.type === 'Material' && !item.isDeleted));
    });
    return () => unsub();
  }, [currentCompanyId]);

  const companyMaterials = useMemo(() => {
    const uniqueNames = new Set(allCompanyInventory.map(item => item.name));
    return Array.from(uniqueNames);
  }, [allCompanyInventory]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: ''
    }
  });

  const newMaterialForm = useForm<z.infer<typeof newMaterialFormSchema>>({ 
    resolver: zodResolver(newMaterialFormSchema),
    defaultValues: {
      newMaterialName: '',
      subType: '',
    }
  });

  const selectedMaterialName = form.watch('name');
  const selectedStatus = form.watch('status');
  
  const selectedMaterialData = useMemo(() => {
    if (selectedMaterialName) {
      const allItemsForMaterial = allCompanyInventory
        .filter(item => item.name === selectedMaterialName)
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

      if (allItemsForMaterial.length > 0) {
        // Prioritize finding the most recent entry with a unit.
        const recentWithUnit = allItemsForMaterial.find(item => item.unit);
        if(recentWithUnit) return recentWithUnit;

        // Fallback to the most recent entry that has any of the other fields.
        return allItemsForMaterial.find(item => item.lowStockThreshold || item.pricePerUnit);
      }
    }
    return null;
  }, [selectedMaterialName, allCompanyInventory]);


  useEffect(() => {
    if (selectedItem) {
      form.reset({
        name: selectedItem.name,
        subType: selectedItem.subType || '',
        status: selectedItem.status,
        quantity: selectedItem.quantity,
        pricePerUnit: selectedItem.pricePerUnit || 0,
        vendor: selectedItem.vendor || '',
        vendorNumber: selectedItem.vendorNumber || '',
        date: selectedItem.date,
        description: selectedItem.description || '',
        unit: selectedItem.unit || '',
        lowStockThreshold: selectedItem.lowStockThreshold || 0,
      });
    } else {
      if (isDialogOpen) {
        form.reset({
          name: '',
          subType: '',
          status: '' as any,
          quantity: 1,
          pricePerUnit: 0,
          vendor: '',
          vendorNumber: '',
          date: todayISO(),
          description: '',
          unit: '',
          lowStockThreshold: 0,
        });
      }
    }
  }, [selectedItem, form, isDialogOpen]);

  const handleOpenDialog = (item: InventoryItem | null = null) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  }

  const handleOpenDeleteDialog = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if(selectedItem) {
      await softDeleteDocWithId('inventory', selectedItem.id);
      toast({ title: "Material Deleted", description: `"${selectedItem.name}" has been deleted.` });
    }
    setIsDeleteDialogOpen(false);
    setSelectedItem(null);
  };

  const inventorySummary = useMemo(() => {
    const summary: { [key: string]: { 
        name: string; 
        bought: number; 
        used: number; 
        totalCost: number;
        unit?: string;
        lowStockThreshold?: number;
    } } = {};

    materials.forEach(item => {
        const normalizedName = item.name.trim().toLowerCase();
        if (!summary[normalizedName]) {
            summary[normalizedName] = { 
                name: item.name, 
                bought: 0, 
                used: 0, 
                totalCost: 0,
                lowStockThreshold: item.lowStockThreshold,
            };
        }

        if (item.status === 'Bought') {
            summary[normalizedName].bought += item.quantity;
            summary[normalizedName].totalCost += item.quantity * (item.pricePerUnit || 0);
        } else if (item.status === 'Used') {
            summary[normalizedName].used += item.quantity;
        }
        
        // This is not a great way to handle units, but it's a simple approach.
        // It will take the unit from the last processed item for that material.
        if (item.unit) {
            summary[normalizedName].unit = item.unit;
        }

        if (item.lowStockThreshold) {
          summary[normalizedName].lowStockThreshold = item.lowStockThreshold;
        }
    });

    return Object.values(summary).map(item => {
        const stored = item.bought - item.used;
        return {
            ...item,
            stored,
        };
    });
  }, [materials]);


  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!currentCompanyId) {
      toast({ variant: 'destructive', title: 'Error', description: 'User not associated with a company.' });
      return;
    }
    setIsSubmitting(true);
    const itemData: Partial<InventoryItem> = { 
        name: values.name, 
        subType: values.subType,
        status: values.status,
        quantity: values.quantity, 
        pricePerUnit: values.pricePerUnit,
        vendor: values.vendor,
        vendorNumber: values.vendorNumber,
        date: values.date, 
        type: 'Material' as const, 
        description: values.description,
        unit: values.unit,
        lowStockThreshold: values.lowStockThreshold,
        createdAt: serverTimestamp(),
    };

    if (values.status !== 'Bought') {
      delete itemData.pricePerUnit;
      delete itemData.vendor;
      delete itemData.vendorNumber;
    }

    if (values.status !== 'Used') {
      delete itemData.description;
    }
    
    try {
        if (selectedItem) {
            await updateDocWithId(collectionName, selectedItem.id, { ...selectedItem, ...itemData });
            toast({ title: "Material Updated", description: `"${values.name}" has been updated.` });
        } else {
            await addDocWithSiteId(collectionName, currentCompanyId, siteId, itemData);
            toast({ title: "Material Logged", description: `"${values.name}" has been logged.` });
        }
        setIsDialogOpen(false);
        setSelectedItem(null);
        form.reset();
    } catch(e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save material log.'})
    } finally {
      setIsSubmitting(false);
    }
  };

  const onNewMaterialSubmit = async (values: z.infer<typeof newMaterialFormSchema>) => {
    if (!currentCompanyId) return;
    setIsSubmitting(true);
    const finalName = values.subType ? `${values.newMaterialName} (${values.subType})` : values.newMaterialName;
    const newMaterialData = {
        name: finalName,
        type: 'Material' as const,
        status: 'Stored' as const,
        quantity: 0,
        siteId: siteId, // This is a placeholder record for the name, but needs a siteId to be queryable in some contexts
        createdAt: serverTimestamp(),
    };
    try {
        await addDocToGlobalCollection('inventory', currentCompanyId, newMaterialData);
        toast({ title: "New Material Type Added", description: `"${finalName}" is now available.` });
        setIsNewMaterialDialogOpen(false);
        newMaterialForm.reset();
        form.setValue('name', finalName);
    } catch (e) {
        console.error('Failed to add new material type:', e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to add new material type.' });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const getStatusBadge = (status: InventoryItem['status']) => {
    switch(status) {
        case 'Bought': return 'secondary';
        case 'Used': return 'destructive';
        case 'Stored': return 'default';
    }
  }

  const filteredAndSortedMaterials = useMemo(() => {
    return materials
      .filter(item => 
        (materialFilter.length === 0 || materialFilter.includes(item.name)) &&
        (vendorFilter.length === 0 || (item.vendor && vendorFilter.includes(item.vendor))) &&
        (dateFilter === '' || item.date === dateFilter) &&
        (searchTerm === '' || (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())))
      );
  }, [materials, materialFilter, vendorFilter, dateFilter, searchTerm]);

  const paginatedMaterials = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedMaterials.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedMaterials, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedMaterials.length / itemsPerPage);

  const uniqueVendors = useMemo(() => {
    const vendors = new Set(materials.map(m => m.vendor).filter(Boolean) as string[]);
    return Array.from(vendors);
  }, [materials]);

  const uniqueMaterialNames = useMemo(() => {
    const names = new Set(materials.map(m => m.name));
    return Array.from(names);
  }, [materials]);

  useEffect(() => {
    setCurrentPage(1);
  }, [materialFilter, vendorFilter, dateFilter, itemsPerPage, searchTerm]);

  const exportToCSV = (data: any[], filename: string) => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSummary = () => {
    const dataToExport = inventorySummary.map(({ name, bought, used, stored, lowStockThreshold, totalCost }) => ({
      'Material Name': name,
      'Total Bought Qty': bought,
      'Total Used Qty': used,
      'Remaining Stock Qty': stored,
      'Total Cost': totalCost,
      'Low Stock Threshold': lowStockThreshold,
    }));
    exportToCSV(dataToExport, `materials-summary-${siteId}.csv`);
  };

  const allMaterialOptions = useMemo(() => {
    const combined = new Set([...companyMaterials]);
    return Array.from(combined).sort((a, b) => a.localeCompare(b));
  }, [companyMaterials]);

  const handleClearFilters = () => {
    setMaterialFilter([]);
    setVendorFilter([]);
    setDateFilter('');
    setSearchTerm('');
  }
  
  useEffect(() => {
    if (selectedMaterialData) {
        if (selectedStatus === 'Bought') {
            form.setValue('pricePerUnit', selectedMaterialData.pricePerUnit || 0);
        }
        form.setValue('unit', selectedMaterialData.unit || '');
        form.setValue('lowStockThreshold', selectedMaterialData.lowStockThreshold || 0);
    }
  }, [selectedStatus, selectedMaterialData, form]);

  const getMaterialIcon = (name: string) => {
    const lowerCaseName = name.toLowerCase();
    if (lowerCaseName.includes('cement')) return <Layers className="h-4 w-4 text-muted-foreground" />;
    if (lowerCaseName.includes('sand')) return <Wind className="h-4 w-4 text-muted-foreground" />;
    if (lowerCaseName.includes('water')) return <Droplets className="h-4 w-4 text-muted-foreground" />;
    if (lowerCaseName.includes('brick')) return <BrickWall className="h-4 w-4 text-muted-foreground" />;
    if (lowerCaseName.includes('steel')) return <Construction className="h-4 w-4 text-muted-foreground" />;
    if (lowerCaseName.includes('paint')) return <Paintbrush className="h-4 w-4 text-muted-foreground" />;
    return <Box className="h-4 w-4 text-muted-foreground" />;
  };


  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Materials Log</CardTitle>
            <CardDescription>Track construction materials for this site.</CardDescription>
          </div>
          <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsNewMaterialDialogOpen(true)}>Add New Type</Button>
              <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Log Material</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium flex items-center gap-2"><HardHat /> Materials Summary</h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsBbsDialogOpen(true)}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Make BBS
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportSummary} disabled={inventorySummary.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </div>
              <div>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Item Name</TableHead>
                              <TableHead className="text-center">Total Bought</TableHead>
                              <TableHead className="text-center">Total Used</TableHead>
                              <TableHead className="text-center">Stock</TableHead>
                              <TableHead className="text-right">Total Cost</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {inventorySummary.length > 0 ? (
                              inventorySummary.map(item => {
                                  const isLowStock = item.lowStockThreshold !== undefined && item.stored <= item.lowStockThreshold;
                                  return (
                                  <TableRow key={item.name} className={isLowStock ? 'bg-destructive/10' : ''}>
                                      <TableCell className="font-medium flex items-center gap-2">
                                          {isLowStock && <AlertTriangle className="h-4 w-4 text-destructive" />}
                                          {getMaterialIcon(item.name)}
                                          {item.name}
                                      </TableCell>
                                      <TableCell className="text-center">{item.bought.toLocaleString()} {item.unit}</TableCell>
                                      <TableCell className="text-center">{item.used.toLocaleString()} {item.unit}</TableCell>
                                      <TableCell className="text-center font-bold">{item.stored.toLocaleString()} {item.unit}</TableCell>
                                      <TableCell className="text-right font-semibold">₹{item.totalCost.toLocaleString()}</TableCell>
                                  </TableRow>
                                  )
                              })
                          ) : (
                               <TableRow>
                                  <TableCell colSpan={5} className="text-center h-24">No materials logged yet.</TableCell>
                              </TableRow>
                          )}
                      </TableBody>
                  </Table>
              </div>
          </div>

          <Separator />

           <div>
              <h3 className="text-lg font-medium mb-2">BBS History</h3>
              <div>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Project Name</TableHead>
                              <TableHead>Drawing Number</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">Items</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {bbsHistory.length > 0 ? (
                              bbsHistory.map(bbs => (
                                  <TableRow key={bbs.id}>
                                      <TableCell className="font-medium">{bbs.projectName}</TableCell>
                                      <TableCell>{bbs.drawingNumber}</TableCell>
                                      <TableCell>{bbs.date}</TableCell>
                                      <TableCell className="text-right">{bbs.items.length}</TableCell>
                                  </TableRow>
                              ))
                          ) : (
                               <TableRow>
                                  <TableCell colSpan={4} className="text-center h-24">No BBS saved yet.</TableCell>
                              </TableRow>
                          )}
                      </TableBody>
                  </Table>
              </div>
          </div>
          
          <Separator />
          
          <div>
              <h3 className="text-lg font-medium mb-4">Detailed Log</h3>
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Price Per Unit</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedMaterials.length > 0 ? (
                      paginatedMaterials.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell><Badge variant={getStatusBadge(item.status)}>{item.status}</Badge></TableCell>
                          <TableCell>{item.quantity.toLocaleString()} {item.unit}</TableCell>
                          <TableCell>₹{item.pricePerUnit?.toLocaleString() || 'N/A'}</TableCell>
                          <TableCell>{item.date}</TableCell>
                          <TableCell>{item.vendor || 'N/A'}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{item.description || 'N/A'}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(item)}>
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
                        <TableCell colSpan={8} className="text-center h-24">No materials logged for the selected filters.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
               <div className="flex items-center justify-between gap-4 mt-4">
                  <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsFilterDialogOpen(true)}>
                          <Filter className="mr-2 h-4 w-4" />
                          Filter
                      </Button>
                      <Input
                        placeholder="Search description..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-9 w-48"
                      />
                      {(materialFilter.length > 0 || vendorFilter.length > 0 || dateFilter !== '' || searchTerm !== '') && (
                          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                              Clear
                          </Button>
                      )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                          <span className="text-nowrap">Rows:</span>
                          <Select value={String(itemsPerPage)} onValueChange={(val) => setItemsPerPage(Number(val))}>
                              <SelectTrigger className="w-16 h-9">
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  {[5, 10, 20, 50].map(val => (
                                      <SelectItem key={val} value={String(val)}>{val}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                      <span>Page {totalPages > 0 ? currentPage : 0} of {totalPages}</span>
                      <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>Next</Button>
                      </div>
                  </div>
              </div>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if (!isOpen) { setSelectedItem(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Edit' : 'Log New'} Material</DialogTitle>
            <DialogDescription>Fill in the details of the material transaction.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <fieldset disabled={isSubmitting} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Material Name</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                              <SelectTrigger>
                                  <SelectValue placeholder="Choose an option" />
                              </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              {allMaterialOptions.map(material => (
                                  <SelectItem key={material} value={material}>{material}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., bags, tons"
                            {...field}
                            value={field.value || ''}
                            readOnly={!selectedItem && !!selectedMaterialData?.unit}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                    <FormField
                    control={form.control}
                    name="lowStockThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Low Stock Threshold</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            placeholder="e.g., 10" 
                            {...field}
                            value={field.value ?? 0}
                            readOnly={!selectedItem && !!selectedMaterialData?.lowStockThreshold}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Choose an option"/></SelectTrigger></FormControl>
                    <SelectContent>
                      {inventoryStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem><FormLabel>Quantity</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage /></FormItem>
                )} />

                {selectedStatus === 'Used' && (
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="e.g., Used for foundation work" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {selectedStatus === 'Bought' && (
                  <>
                    <FormField control={form.control} name="pricePerUnit" render={({ field }) => (
                      <FormItem><FormLabel>Price Per Unit (₹) (Optional)</FormLabel>
                      <FormControl><Input type="number" placeholder="e.g., 55.50" {...field} value={field.value || 0} /></FormControl>
                      <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="vendor" render={({ field }) => (
                      <FormItem><FormLabel>Vendor (Optional)</FormLabel>
                      <FormControl><Input placeholder="e.g., Acme Corp" {...field} value={field.value || ''} /></FormControl>
                      <FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="vendorNumber" render={({ field }) => (
                      <FormItem><FormLabel>Vendor Number (Optional)</FormLabel>
                      <FormControl><Input placeholder="e.g., 9876543210" {...field} value={field.value || ''} /></FormControl>
                      <FormMessage /></FormItem>
                    )} />
                  </>
                )}
                
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage /></FormItem>
                )} />
              </fieldset>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => { setIsDialogOpen(false); setSelectedItem(null); }} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {selectedItem ? 'Save Changes' : 'Add Material'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewMaterialDialogOpen} onOpenChange={setIsNewMaterialDialogOpen}>
        <DialogContent className="sm:max-w-md">
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

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Filter Detailed Log</DialogTitle>
                <DialogDescription>
                    Select filters to apply to the detailed materials log.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="material-filter" className="text-right">
                        Material
                    </Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="col-span-3 justify-between">
                                {materialFilter.length > 0 ? `${materialFilter.length} selected` : "Select materials..."}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Search materials..." />
                                <CommandList>
                                    <CommandEmpty>No materials found.</CommandEmpty>
                                    <CommandGroup>
                                        {uniqueMaterialNames.map(name => (
                                            <CommandItem
                                                key={name}
                                                onSelect={() => {
                                                    const newFilter = materialFilter.includes(name)
                                                        ? materialFilter.filter(item => item !== name)
                                                        : [...materialFilter, name];
                                                    setMaterialFilter(newFilter);
                                                }}
                                            >
                                                <Checkbox
                                                    className="mr-2"
                                                    checked={materialFilter.includes(name)}
                                                />
                                                {name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="vendor-filter" className="text-right">
                        Vendor
                    </Label>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="col-span-3 justify-between">
                                {vendorFilter.length > 0 ? `${vendorFilter.length} selected` : "Select vendors..."}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Search vendors..." />
                                <CommandList>
                                    <CommandEmpty>No vendors found.</CommandEmpty>
                                    <CommandGroup>
                                        {uniqueVendors.map(name => (
                                            <CommandItem
                                                key={name}
                                                onSelect={() => {
                                                    const newFilter = vendorFilter.includes(name)
                                                        ? vendorFilter.filter(item => item !== name)
                                                        : [...vendorFilter, name];
                                                    setVendorFilter(newFilter);
                                                }}
                                            >
                                                <Checkbox
                                                    className="mr-2"
                                                    checked={vendorFilter.includes(name)}
                                                />
                                                {name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="date-filter" className="text-right">
                        Date
                    </Label>
                    <Input 
                        id="date-filter"
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="col-span-3"
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => { handleClearFilters(); setIsFilterDialogOpen(false); }}>Clear Filters</Button>
                <Button onClick={() => setIsFilterDialogOpen(false)}>Apply Filters</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteConfirmationDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen} 
        onConfirm={handleDeleteConfirm}
        title="Delete Material Log"
        description={`Are you sure you want to delete this log entry for "${selectedItem?.name}"? This action will hide it from the list but keep the data.`}
      />
      {isBbsDialogOpen && (
          <BbsDialog
              open={isBbsDialogOpen}
              onOpenChange={setIsBbsDialogOpen}
              siteId={siteId}
          />
      )}
    </>
  );
}
