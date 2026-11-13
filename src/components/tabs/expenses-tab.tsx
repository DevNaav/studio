

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Expense, expenseCategories, Labor, Machine, MaintenanceLog, FuelLog, inventoryStatuses, laborTransactionTypes, fuelTypes, maintenanceCostAllocations, wageTypes, InventoryItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Download, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { onSubCollectionSnapshot, addDocWithSiteId, softDeleteDocWithId, onGlobalCollectionSnapshot, addDocToGlobalCollection, addMaintenanceLogDb } from '@/context/site-context';
import { DeleteConfirmationDialog } from '../delete-confirmation-dialog';
import { Textarea } from '../ui/textarea';
import { useAuth } from '@/context/auth-context';
import { formatCurrency, todayISO } from '@/lib/utils';


const generalExpenseSchema = z.object({
  description: z.string().min(2, 'Description is too short'),
  category: z.enum(expenseCategories, { required_error: "Please select a category." }),
  amount: z.coerce.number().positive('Amount must be positive'),
  date: z.string().min(1, 'Date is required'),
});

const laborExpenseSchema = z.object({
  laborId: z.string({ required_error: "Please select a laborer." }).min(1, 'Please select a laborer.'),
  type: z.enum(laborTransactionTypes, { required_error: "Please select a transaction type." }),
  amount: z.coerce.number().positive('Amount must be a positive number'),
  date: z.string().min(1, 'Date is required'),
});

const newLaborerSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  role: z.string().min(2, 'Role is too short'),
  wageType: z.enum(wageTypes, { required_error: "Please select a wage type." }),
  wage: z.coerce.number().positive('Wage must be a positive number'),
  dateOfJoining: z.string().optional(),
});

const machineExpenseSchema = z.object({
    machineId: z.string().min(1, "Please select a machine"),
    type: z.enum(['Fuel', 'Maintenance']),
    // Fuel fields
    fuelType: z.enum(fuelTypes).optional(),
    quantity: z.coerce.number().optional(),
    // Maintenance fields
    task: z.string().optional(),
    details: z.string().optional(),
    costAllocation: z.enum(maintenanceCostAllocations).optional(),
    // Common fields
    cost: z.coerce.number().positive("Cost must be a positive number"),
    date: z.string().min(1, "Date is required"),
});

const materialExpenseSchema = z.object({
  name: z.string({ required_error: "Please select a material." }).min(1, { message: 'Please select a material.' }),
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

interface ExpensesTabProps {
  siteId: string;
  isManufacturing?: boolean;
}

export function ExpensesTab({ siteId, isManufacturing = false }: ExpensesTabProps) {
  const [generalExpenses, setGeneralExpenses] = useState<Expense[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [allCompanyInventory, setAllCompanyInventory] = useState<InventoryItem[]>([]);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isNewMaterialDialogOpen, setIsNewMaterialDialogOpen] = useState(false);

  const [activeForm, setActiveForm] = useState<'general' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [labors, setLabors] = useState<Labor[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  
  const { toast } = useToast();
  const { userProfile } = useAuth();
  
  const currentCompanyId = userProfile?.companyId;

  const expenseCollectionName = isManufacturing ? 'manufacturing_expenses' : 'expenses';
  const laborCollectionName = isManufacturing ? 'manufacturing_labor_transactions' : 'labor_transactions';
  const fuelCollectionName = isManufacturing ? 'manufacturing_fuel_logs' : 'fuel_logs';
  const maintenanceCollectionName = isManufacturing ? 'manufacturing_maintenance_logs' : 'maintenance_logs';
  const materialCollectionName = isManufacturing ? 'manufacturing_inventory' : 'inventory';
  const laborerCollectionName = isManufacturing ? 'manufacturing_labors' : 'labors';

  useEffect(() => {
    if (!siteId || !currentCompanyId) return;

    const unsubGeneral = onSubCollectionSnapshot<Expense>(expenseCollectionName, currentCompanyId, siteId, setGeneralExpenses);

    const unsubLabors = onGlobalCollectionSnapshot<Labor>('labors', currentCompanyId, (allLabors) => {
        const filtered = isManufacturing
            ? allLabors.filter(l => l.siteId === 'manufacturing' && !l.isDeleted)
            : allLabors.filter(l => l.siteId === siteId && !l.isDeleted);
        setLabors(filtered);
    });
    const unsubMachines = onGlobalCollectionSnapshot<Machine>('machines', currentCompanyId, (allMachines) => {
        const filtered = isManufacturing
            ? allMachines.filter(m => !m.isDeleted) // All machines for manufacturing
            : allMachines.filter(m => m.assignedSiteId === siteId && !m.isDeleted);
        setMachines(filtered);
    });
    
    const unsubInventory = onGlobalCollectionSnapshot<InventoryItem>('inventory', currentCompanyId, (allItems) => {
      setAllCompanyInventory(allItems.filter(item => item.type === 'Material' && !item.isDeleted));
    });
    
    return () => {
      unsubGeneral();
      unsubLabors();
      unsubMachines();
      unsubInventory();
    };
  }, [siteId, currentCompanyId, isManufacturing, expenseCollectionName]);
  
  const companyMaterials = useMemo(() => {
    const uniqueNames = new Set(allCompanyInventory.map(item => item.name));
    return Array.from(uniqueNames);
  }, [allCompanyInventory]);

  const filteredExpenses = useMemo(() => {
    const filtered = generalExpenses.filter(expense => !expense.isDeleted);

    if (!searchTerm) {
      return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return filtered.filter(expense =>
      expense.description.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [generalExpenses, searchTerm]);

  const generalExpenseForm = useForm<z.infer<typeof generalExpenseSchema>>({
    resolver: zodResolver(generalExpenseSchema),
    defaultValues: { description: '', amount: 0, date: todayISO(), category: 'Other' },
  });

  const onGeneralSubmit = async (values: z.infer<typeof generalExpenseSchema>) => {
    if (!userProfile?.companyId) return;
    setIsSubmitting(true);
    try {
      await addDocWithSiteId(expenseCollectionName, userProfile.companyId, siteId, values);
      toast({ title: "Expense Added", description: `An expense of ${formatCurrency(values.amount)} for "${values.description}" has been logged.` });
      generalExpenseForm.reset();
      setActiveForm(null);
    } catch(e) {
      toast({ variant: 'destructive', title: "Error", description: "Failed to add expense." });
    } finally {
        setIsSubmitting(false);
    }
  };
  
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

  const handleExport = () => {
    const dataToExport = filteredExpenses.map(({ siteId, isDeleted, companyId, ...rest }) => rest);
    exportToCSV(dataToExport, `general-expenses-${siteId}.csv`);
  };
  
  const handleOpenDeleteDialog = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (selectedExpense) {
      await softDeleteDocWithId(expenseCollectionName, selectedExpense.id);
      toast({ title: "Expense Deleted", description: `The expense "${selectedExpense.description}" has been deleted.` });
    }
    setIsDeleteDialogOpen(false);
    setSelectedExpense(null);
  };

  const cancelForm = () => {
    setActiveForm(null);
    generalExpenseForm.reset();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>General Expense Tracking</CardTitle>
              <CardDescription>Log and manage miscellaneous expenses for this {isManufacturing ? 'operation' : 'site'}.</CardDescription>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredExpenses.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                </Button>
                <Button onClick={() => setActiveForm('general')} variant={activeForm ? 'secondary': 'default'}><Plus className="mr-2 h-4 w-4" />Log Expense</Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        {activeForm === 'general' && (
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Log a New General Expense</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...generalExpenseForm}>
                        <form onSubmit={generalExpenseForm.handleSubmit(onGeneralSubmit)} className="space-y-4">
                        <FormField control={generalExpenseForm.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description</FormLabel>
                            <FormControl><Input placeholder="e.g., Weekly Catering" {...field} /></FormControl>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={generalExpenseForm.control} name="category" render={({ field }) => (
                            <FormItem><FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Choose an option" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {expenseCategories.filter(c => !['Fuel', 'Maintenance', 'EMI', 'Rental', 'Materials', 'Labor'].includes(c)).map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                            </SelectContent>
                            </Select><FormMessage /></FormItem>
                        )} />
                        <FormField control={generalExpenseForm.control} name="amount" render={({ field }) => (
                            <FormItem><FormLabel>Amount (Rs.)</FormLabel>
                            <FormControl><Input type="number" placeholder="100.00" {...field} /></FormControl>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={generalExpenseForm.control} name="date" render={({ field }) => (
                            <FormItem><FormLabel>Date</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage /></FormItem>
                        )} />
                        <CardFooter className="px-0 pt-4 justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={cancelForm} disabled={isSubmitting}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin mr-2" />}Add Expense</Button>
                        </CardFooter>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        )}
        <div className="mt-4">
            <Input 
                placeholder="Filter by description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
            />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExpenses.length > 0 ? (
              filteredExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{expense.description}</TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                  <TableCell>{expense.date}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(expense)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center">No general expenses logged yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <DeleteConfirmationDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen} 
        onConfirm={handleDeleteConfirm}
        title="Delete Expense"
        description={`Are you sure you want to delete the expense "${selectedExpense?.description}"? This action cannot be undone.`}
      />
    </Card>
  );
}
