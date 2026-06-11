

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Labor, Site, wageTypes } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, BadgeCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import { onGlobalCollectionSnapshot, addDocToGlobalCollection, updateDocWithId, softDeleteDocWithId, addLaborerDb, updateLaborerDb } from '@/context/site-context';
import { useSite } from '@/context/site-context';
import { Badge } from './ui/badge';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/utils';


const MAX_FILE_SIZE = 5000000; // 5MB
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];


const formSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  role: z.string().min(2, 'Role is too short'),
  wageType: z.enum(wageTypes, { required_error: "Please select a wage type." }),
  wage: z.coerce.number().optional(),
  siteId: z.string().min(1, 'Please assign laborer to a site.'),
  idNumber: z.string().optional(),
  dateOfJoining: z.string().optional(),
  idProof: z.any()
    .optional()
    .refine((files) => !files || files.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (files) => !files || files.length === 0 || ACCEPTED_MIME_TYPES.includes(files?.[0]?.type),
      ".jpg, .jpeg, .png, and .pdf files are accepted."
    ),
  contractType: z.string().optional(),
  pricePerUnit: z.coerce.number().optional(),
  unit: z.string().optional(),
}).refine(data => {
    if (data.wageType === 'Daily' || data.wageType === 'Monthly') {
        return data.wage !== undefined && data.wage > 0;
    }
    return true;
}, {
    message: 'Wage must be a positive number for Daily or Monthly types.',
    path: ['wage'],
});

interface LaborPageProps {
    companyId: string | null | undefined;
}


export function LaborPage({ companyId }: LaborPageProps) {
  const { sites } = useSite();
  const [labors, setLabors] = useState<Labor[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLabor, setSelectedLabor] = useState<Labor | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSiteFilter, setSelectedSiteFilter] = useState('all');

  const { toast } = useToast();

  useEffect(() => {
    if (!companyId) {
        setLabors([]);
        return;
    }
    const unsubLabors = onGlobalCollectionSnapshot<Labor>('labors', companyId, setLabors);
    return () => {
      unsubLabors();
    };
  }, [companyId]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        name: '',
        role: '',
        wage: 0,
        siteId: undefined,
        wageType: undefined,
        idNumber: '',
        dateOfJoining: '',
        contractType: '',
        pricePerUnit: 0,
        unit: '',
    }
  });

  const wageType = form.watch('wageType');

  useEffect(() => {
    if (selectedLabor) {
      form.reset({
        name: selectedLabor.name,
        role: selectedLabor.role,
        wageType: selectedLabor.wageType,
        wage: selectedLabor.wage || 0,
        siteId: selectedLabor.siteId,
        idNumber: selectedLabor.idNumber || '',
        dateOfJoining: selectedLabor.dateOfJoining || '',
        idProof: undefined,
        contractType: selectedLabor.contractType || '',
        pricePerUnit: selectedLabor.pricePerUnit || 0,
        unit: selectedLabor.unit || '',
      });
    } else {
      if (isDialogOpen) {
        form.reset({ name: '', role: '', wageType: undefined, wage: 0, siteId: undefined, idNumber: '', dateOfJoining: new Date().toISOString().split('T')[0], idProof: undefined, contractType: '', pricePerUnit: 0, unit: '' });
      }
    }
  }, [selectedLabor, form, isDialogOpen]);
  
  const handleOpenDialog = (labor: Labor | null = null) => {
    setSelectedLabor(labor);
    setIsDialogOpen(true);
  };
  
  const handleOpenDeleteDialog = (labor: Labor) => {
    setSelectedLabor(labor);
    setIsDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (selectedLabor) {
      try {
        await softDeleteDocWithId('labors', selectedLabor.id);
        toast({ title: 'Laborer Deleted', description: `"${selectedLabor.name}" has been removed.` });
      } catch (e) {
        toast({ variant: "destructive", title: 'Error', description: `Could not delete "${selectedLabor.name}".` });
      }
    }
    setIsDeleteDialogOpen(false);
    setSelectedLabor(null);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!companyId) {
        toast({ variant: "destructive", title: 'Error', description: "No company selected." });
        return;
    }
    setIsSubmitting(true);
    const idProofFile = values.idProof?.[0];

    try {
        if (selectedLabor) {
            await updateLaborerDb(selectedLabor.id, values, idProofFile);
            toast({ title: 'Laborer Updated', description: `"${values.name}" has been updated.` });
        } else {
            await addLaborerDb(companyId, { ...values, employmentStatus: 'On Roll' }, idProofFile);
            toast({ title: 'Laborer Added', description: `"${values.name}" has been added.` });
        }
        setIsDialogOpen(false);
        setSelectedLabor(null);
    } catch(e) {
        console.error("Failed to save laborer", e);
        toast({ variant: "destructive", title: 'Error', description: "Could not save laborer details." });
    } finally {
        setIsSubmitting(false);
    }
  };

  const filteredLabors = useMemo(() => {
    return labors.filter(l => 
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (selectedSiteFilter === 'all' || l.siteId === selectedSiteFilter)
    );
  }, [labors, searchTerm, selectedSiteFilter]);

  const getSiteName = (siteId: string) => sites.find(s => s.id === siteId)?.name || 'N/A';
  
  const getWageLabel = (labor?: Labor | null) => {
    const type = labor ? labor.wageType : wageType;
    switch (type) {
        case 'Daily': return 'Daily Wage (Rs.)';
        case 'Monthly': return 'Monthly Salary (Rs.)';
        case 'Contract': return 'Contract Amount (Rs.)';
        default: return 'Wage (Rs.)';
    }
  };
  
  const renderWage = (labor: Labor) => {
    if (labor.wageType === 'Contract' && labor.pricePerUnit && labor.unit) {
      return `${formatCurrency(labor.pricePerUnit)} / ${labor.unit}`;
    }
    return `${formatCurrency(labor.wage)} / ${labor.wageType}`;
  };

  if (!companyId) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Global Labor Management</CardTitle>
                <CardDescription>Select a company to view and manage labor.</CardDescription>
            </CardHeader>
        </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Global Labor Management</CardTitle>
            <CardDescription>Add new laborers and assign them to a construction site.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Add Laborer</Button>
          </div>
        </CardHeader>
        <CardContent>
            <div className="flex items-center gap-4 mb-4">
                <Input 
                    placeholder="Search by laborer name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
                <Select value={selectedSiteFilter} onValueChange={setSelectedSiteFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by site..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Sites</SelectItem>
                        {sites.map(site => (
                            <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Assigned Site</TableHead>
                            <TableHead>Wage</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLabors.length > 0 ? filteredLabors.map((labor) => (
                            <TableRow key={labor.id}>
                                <TableCell className="font-medium flex items-center gap-2">
                                  {labor.name}
                                  {labor.idProofUrl && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <BadgeCheck className="h-4 w-4 text-green-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>ID Proof Uploaded</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </TableCell>
                                <TableCell>{labor.role}</TableCell>
                                <TableCell>{getSiteName(labor.siteId)}</TableCell>
                                <TableCell>{renderWage(labor)}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(labor)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(labor)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">No laborers found for the selected filters.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if (!isOpen) setSelectedLabor(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedLabor ? 'Edit' : 'Add New'} Laborer</DialogTitle>
            <DialogDescription>Fill in the details for the worker and assign them to a site.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <fieldset disabled={isSubmitting} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="e.g., John Smith" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role / Trade</FormLabel>
                    <FormControl><Input placeholder="e.g., Electrician" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="siteId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to Site</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a site" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {sites.map(site => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                 <FormField control={form.control} name="wageType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wage Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Choose wage type" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {wageTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                {wageType === 'Contract' ? (
                  <>
                    <FormField control={form.control} name="contractType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type of Contract</FormLabel>
                        <FormControl><Input placeholder="e.g., Plastering, Tiling" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex gap-2">
                       <FormField control={form.control} name="pricePerUnit" render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Price Per Unit (Rs.)</FormLabel>
                          <FormControl><Input type="number" placeholder="e.g., 25" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="unit" render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Unit</FormLabel>
                          <FormControl><Input placeholder="e.g., sqft, item" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </>
                ) : (
                  wageType && <FormField control={form.control} name="wage" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{getWageLabel()}</FormLabel>
                      <FormControl><Input type="number" placeholder="e.g., 800" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                <FormField control={form.control} name="dateOfJoining" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Joining (Optional)</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="idNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID Number (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., AADHAR or Voter ID" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField
                  control={form.control}
                  name="idProof"
                  render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID Proof Upload (Optional)</FormLabel>
                      {selectedLabor?.idProofUrl && (
                        <p className="text-sm text-muted-foreground">
                          An ID proof is already uploaded. Uploading a new file will replace it.
                          <a href={selectedLabor.idProofUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary hover:underline">View current</a>
                        </p>
                      )}
                    <FormControl>
                      <Input
                        type="file"
                        accept={ACCEPTED_MIME_TYPES.join(',')}
                        onChange={(e) => field.onChange(e.target.files)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                  )}
                />
              </fieldset>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {selectedLabor ? 'Save Changes' : 'Add Laborer'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <DeleteConfirmationDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen} 
        onConfirm={handleDeleteConfirm}
        title="Delete Laborer"
        description={`Are you sure you want to delete "${selectedLabor?.name}"? This action will hide it from the list but keep the data.`}
      />
    </div>
  );
}

    