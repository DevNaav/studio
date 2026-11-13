'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { RentedMaterial, RentedMaterialStatus, rentedMaterialStatuses, RentedMaterialAttendance, RentedMaterialAttendanceStatus, rentedMaterialAttendanceStatuses } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, IndianRupee, Truck, FileText, Download, ChevronLeft, ChevronRight, Check, X, Loader2, Coins, Receipt, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { onSubCollectionSnapshot, addDocWithSiteId, updateDocWithId, softDeleteDocWithId, markRentedMaterialAttendance } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { DeleteConfirmationDialog } from '../delete-confirmation-dialog';
import { Badge } from '../ui/badge';
import { format, isAfter, isBefore, eachDayOfInterval, startOfMonth, endOfMonth, getDaysInMonth, getDate } from 'date-fns';
import { uploadFile, deleteUploadedFile } from '@/lib/file-upload';
import { LogRentedMaterialPaymentDialog } from '../log-rented-material-payment-dialog';
import { FinalizeRentalDialog } from '../finalize-rental-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const MAX_FILE_SIZE = 5000000;
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];

const formSchema = z.object({
  materialName: z.string().min(3, 'Material name is too short'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  unit: z.string().min(1, 'Unit is required'),
  rentPerDay: z.coerce.number().positive('Rent must be a positive number'),
  rentedFrom: z.string().min(2, 'Vendor name is too short'),
  contact: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  remarks: z.string().optional(),
  status: z.enum(rentedMaterialStatuses),
  document: z.any()
    .optional()
    .refine((files) => !files || files.length === 0 || files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine((files) => !files || files.length === 0 || ACCEPTED_MIME_TYPES.includes(files?.[0]?.type), ".jpg, .jpeg, .png, and .pdf files are accepted.")
});

interface RentedMaterialsTabProps {
  siteId: string;
}

export function RentedMaterialsTab({ siteId }: RentedMaterialsTabProps) {
  const [rentedMaterials, setRentedMaterials] = useState<RentedMaterial[]>([]);
  const [attendances, setAttendances] = useState<RentedMaterialAttendance[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);
  const [isFinalizeDialogOpen, setIsFinalizeDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RentedMaterial | null>(null);
  const [itemToFinalize, setItemToFinalize] = useState<(RentedMaterial & { totalCost: number; balance: number }) | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthView, setMonthView] = useState<'firstHalf' | 'secondHalf'>('firstHalf');

  const { toast } = useToast();
  const { userProfile } = useAuth();
  const companyId = userProfile?.companyId;
  const today = new Date();

  useEffect(() => {
    if (!siteId || !companyId) return;
    const unsubMaterials = onSubCollectionSnapshot<RentedMaterial>('rented_materials', companyId, siteId, setRentedMaterials);
    const unsubAttendance = onSubCollectionSnapshot<RentedMaterialAttendance>('rented_material_attendances', companyId, siteId, setAttendances);
    return () => {
        unsubMaterials();
        unsubAttendance();
    };
  }, [siteId, companyId]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (isDialogOpen) {
      if (selectedItem) {
        form.reset({
            ...selectedItem,
            remarks: selectedItem.remarks || '',
            contact: selectedItem.contact || '',
            document: undefined,
        });
      } else {
        if (!form.formState.isDirty) {
            form.reset({
                materialName: '',
                quantity: 1,
                unit: 'pcs',
                rentPerDay: 0,
                rentedFrom: '',
                contact: '',
                startDate: new Date().toISOString().split('T')[0],
                status: 'Active',
                remarks: '',
                document: undefined,
            });
        }
      }
    }
  }, [isDialogOpen, selectedItem, form]);

  const handleOpenDialog = (item: RentedMaterial | null = null) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  };
  
  const handleOpenPaymentDialog = (item: RentedMaterial) => {
    setSelectedItem(item);
    setIsPaymentDialogOpen(true);
  };
  
  const handleOpenPaymentHistory = (item: RentedMaterial) => {
    setSelectedItem(item);
    setIsPaymentHistoryOpen(true);
  };

  const handleOpenFinalizeDialog = (item: RentedMaterial & { totalCost: number, balance: number }) => {
    setItemToFinalize(item);
    setIsFinalizeDialogOpen(true);
  };

  const handleOpenDeleteDialog = (item: RentedMaterial) => {
    setSelectedItem(item);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedItem) {
      await softDeleteDocWithId('rented_materials', selectedItem.id);
      toast({ title: 'Item Deleted' });
    }
    setIsDeleteDialogOpen(false);
    setSelectedItem(null);
  };
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!companyId) return;
    setIsSubmitting(true);
    
    const data: Partial<Omit<RentedMaterial, 'id'>> = { ...values };
    delete (data as any).document;
    const file = values.document?.[0];

    try {
        if (file) {
            const uploaded = await uploadFile('rented_materials', file, companyId);
            data.documentUrl = uploaded.url;
            data.documentPath = uploaded.path;
            // Remove the replaced file from the server (older Firebase Storage files are left alone).
            if (selectedItem?.documentPath && selectedItem.documentUrl?.startsWith('/api/files/')) {
                deleteUploadedFile(selectedItem.documentPath).catch(err => console.warn('Could not delete old file:', err));
            }
        } else if (selectedItem?.documentUrl) {
            data.documentUrl = selectedItem.documentUrl;
            data.documentPath = selectedItem.documentPath;
        }

        if (selectedItem) {
            await updateDocWithId('rented_materials', selectedItem.id, data);
            toast({ title: 'Item Updated' });
        } else {
            await addDocWithSiteId('rented_materials', companyId, siteId, { ...data, paymentHistory: [] });
            toast({ title: 'Rented Item Added' });
        }

        setIsDialogOpen(false);
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save item.' });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const materialSummaries = useMemo(() => {
    return rentedMaterials.filter(item => !item.isDeleted).map(item => {
        let daysUsed = 0;
        const endDate = item.status === 'Returned' && item.returnDate ? new Date(item.returnDate) : today;
        const rentalPeriod = eachDayOfInterval({ start: new Date(item.startDate), end: endDate });
        
        rentalPeriod.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const attendance = attendances.find(a => a.rentedMaterialId === item.id && a.date === dateStr);
            if (!attendance || attendance.status === 'Used') {
                daysUsed++;
            }
        });

        const totalCost = item.rentPerDay * item.quantity * daysUsed;
        const totalPaid = (item.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);
        const balance = totalCost - totalPaid;
        return {
            ...item,
            daysUsed,
            totalCost,
            totalPaid,
            balance
        };
    });
  }, [rentedMaterials, attendances, today]);

  const overallSummary = useMemo(() => {
    const activeItems = materialSummaries.filter(item => item.status === 'Active');
    return {
        totalItems: rentedMaterials.filter(item => !item.isDeleted).length,
        activeItems: activeItems.length,
        returnedItems: materialSummaries.length - activeItems.length,
        totalCost: materialSummaries.reduce((acc, item) => acc + item.totalCost, 0),
        totalPaid: materialSummaries.reduce((acc, item) => acc + item.totalPaid, 0),
        balanceDue: materialSummaries.reduce((acc, item) => acc + item.balance, 0),
    }
  }, [materialSummaries, rentedMaterials]);
  
  const getStatusVariant = (status: RentedMaterialStatus) => {
    switch(status) {
        case 'Active': return 'secondary';
        case 'Returned': return 'default';
    }
  };

  const changeMonth = (offset: number) => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    setCurrentMonth(newMonth);
  };
  
  const getAttendanceStatus = (itemId: string, date: string): RentedMaterialAttendanceStatus => {
    const attendance = attendances.find(a => a.rentedMaterialId === itemId && a.date === date);
    return attendance?.status || 'Used'; // Default to 'Used'
  }
  
  const handleAttendanceChange = (itemId: string, date: string, status: RentedMaterialAttendanceStatus) => {
    if (!companyId) return;
    markRentedMaterialAttendance(companyId, siteId, itemId, date, status);
  }

  const monthlyReport = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    let daysInMonth = eachDayOfInterval({ start, end });
    
    if (monthView === 'firstHalf') {
        daysInMonth = daysInMonth.slice(0, 15);
    } else {
        daysInMonth = daysInMonth.slice(15);
    }

    return { days: daysInMonth };
  }, [currentMonth, monthView]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rental Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Rental Cost</CardTitle>
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{overallSummary.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                    <Coins className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{overallSummary.totalPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Balance Due</CardTitle>
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-destructive">₹{overallSummary.balanceDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </CardContent>
            </Card>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Rented Materials Log</CardTitle>
            <CardDescription>Manage all materials rented for this site.</CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Log Rented Item</Button>
        </CardHeader>
        <CardContent>
           <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Rent/Day</TableHead>
                        <TableHead>Total Cost</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {materialSummaries.map(item => (
                        <TableRow key={item.id}>
                            <TableCell>{item.materialName}</TableCell>
                            <TableCell>{item.quantity} {item.unit}</TableCell>
                            <TableCell>₹{item.rentPerDay.toLocaleString()}</TableCell>
                            <TableCell>₹{item.totalCost.toLocaleString()}</TableCell>
                            <TableCell>
                                <Button variant="link" className="p-0 h-auto" onClick={() => handleOpenPaymentHistory(item)}>
                                    ₹{item.totalPaid.toLocaleString()}
                                </Button>
                            </TableCell>
                            <TableCell className="font-bold">₹{item.balance.toLocaleString()}</TableCell>
                            <TableCell>{item.rentedFrom}</TableCell>
                            <TableCell><Badge variant={getStatusVariant(item.status)}>{item.status}</Badge></TableCell>
                            <TableCell className="text-right">
                               <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleOpenPaymentDialog(item)}>
                                      <IndianRupee className="mr-2 h-4 w-4" /> Log Payment
                                    </DropdownMenuItem>
                                    {item.status === 'Active' && (
                                      <DropdownMenuItem onClick={() => handleOpenFinalizeDialog(item)}>
                                        <LogOut className="mr-2 h-4 w-4" /> Release Item
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => handleOpenDialog(item)}>
                                      <Edit className="mr-2 h-4 w-4" /> Edit Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenDeleteDialog(item)} className="text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" /> Delete Log
                                    </DropdownMenuItem>
                                    {item.documentUrl && (
                                      <DropdownMenuItem asChild>
                                        <a href={item.documentUrl} target="_blank" rel="noopener noreferrer">
                                          <FileText className="mr-2 h-4 w-4" /> View Document
                                        </a>
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
           </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Daily Usage Log</CardTitle>
            <CardDescription>Track which items were used each day.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center justify-between mb-4">
                <div />
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => changeMonth(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-lg font-semibold w-32 text-center">
                        {format(currentMonth, 'MMMM yyyy')}
                    </span>
                    <Button variant="outline" size="icon" onClick={() => changeMonth(1)}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                 <div className='flex items-center gap-2'>
                    <Button variant={monthView === 'firstHalf' ? 'default' : 'outline'} onClick={() => setMonthView('firstHalf')} size="sm">Days 1-15</Button>
                    <Button variant={monthView === 'secondHalf' ? 'default' : 'outline'} onClick={() => setMonthView('secondHalf')} size="sm">Days 16-{getDaysInMonth(currentMonth)}</Button>
                </div>
            </div>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px] p-2 sticky left-0 bg-background z-10">Material</TableHead>
                    {monthlyReport.days.map(day => (
                      <TableHead key={day.toISOString()} className="text-center p-1">
                        <div className='flex flex-col items-center text-xs'>
                           <span>{format(day, 'E')}</span>
                           <span>{getDate(day)}</span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rentedMaterials.filter(i => i.status === 'Active').map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-xs p-2 sticky left-0 bg-background z-10">{item.materialName}</TableCell>
                      {monthlyReport.days.map(day => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const status = getAttendanceStatus(item.id, dateStr);
                          const isDisabled = isAfter(day, today) || isBefore(day, new Date(item.startDate));

                          return (
                            <TableCell key={day.toISOString()} className="text-center p-0">
                               <Select
                                  value={status}
                                  onValueChange={(newStatus: RentedMaterialAttendanceStatus) => handleAttendanceChange(item.id, dateStr, newStatus)}
                                  disabled={isDisabled}
                                >
                                  <SelectTrigger className="w-10 h-10 p-0 justify-center border-0 bg-transparent shadow-none [&>svg]:hidden">
                                      <SelectValue>
                                          {status === 'Used' ? <Check className="h-4 w-4 text-green-500"/> : status === 'Not Used' ? <X className="h-4 w-4 text-red-500"/> : null}
                                      </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                      {rentedMaterialAttendanceStatuses.map(s => (
                                          <SelectItem key={s} value={s}>{s}</SelectItem>
                                      ))}
                                  </SelectContent>
                               </Select>
                            </TableCell>
                          )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Edit' : 'Log'} Rented Material</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-4" disabled={isSubmitting}>
                <FormField control={form.control} name="materialName" render={({ field }) => (<FormItem><FormLabel>Material Name</FormLabel><FormControl><Input placeholder="e.g., Scaffolding Pipes" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="flex gap-2">
                    <FormField control={form.control} name="quantity" render={({ field }) => (<FormItem className="flex-1"><FormLabel>Quantity</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="unit" render={({ field }) => (<FormItem className="flex-1"><FormLabel>Unit</FormLabel><FormControl><Input placeholder="e.g., pcs" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="rentPerDay" render={({ field }) => (<FormItem><FormLabel>Rent per Day (per unit)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="rentedFrom" render={({ field }) => (<FormItem><FormLabel>Rented From (Vendor)</FormLabel><FormControl><Input placeholder="e.g., Acme Rentals" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contact" render={({ field }) => (<FormItem><FormLabel>Vendor Contact</FormLabel><FormControl><Input placeholder="Phone or email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                    <SelectContent>{rentedMaterialStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="remarks" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Remarks</FormLabel><FormControl><Textarea placeholder="Any notes..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField
                    control={form.control}
                    name="document"
                    render={({ field }) => (
                    <FormItem className="md:col-span-2">
                        <FormLabel>Document/Receipt</FormLabel>
                        {selectedItem?.documentUrl && (
                            <p className="text-sm text-muted-foreground">
                            A document is already uploaded. Uploading a new file will replace it.
                            <a href={selectedItem.documentUrl} download target="_blank" rel="noopener noreferrer" className="ml-2 text-primary hover:underline">View current</a>
                            </p>
                        )}
                        <FormControl>
                        <Input type="file" accept={ACCEPTED_MIME_TYPES.join(',')} onChange={(e) => field.onChange(e.target.files)} />
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
                    {selectedItem ? 'Save Changes' : 'Add Item'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

       <Dialog open={isPaymentHistoryOpen} onOpenChange={setIsPaymentHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment History for {selectedItem?.materialName}</DialogTitle>
            <DialogDescription>
              A log of all payments made for this item.
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedItem?.paymentHistory && selectedItem.paymentHistory.length > 0 ? (
                selectedItem.paymentHistory.map((payment, index) => (
                  <TableRow key={index}>
                    <TableCell>{format(new Date(payment.date), 'PPP')}</TableCell>
                    <TableCell>{payment.method}</TableCell>
                    <TableCell className="text-right">₹{payment.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">
                    No payments recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button onClick={() => setIsPaymentHistoryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <DeleteConfirmationDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen} 
        onConfirm={handleDeleteConfirm}
        title="Delete Rented Item"
        description={`Are you sure you want to delete the log for "${selectedItem?.materialName}"?`}
      />
      {selectedItem && (
          <LogRentedMaterialPaymentDialog
            open={isPaymentDialogOpen}
            onOpenChange={setIsPaymentDialogOpen}
            material={selectedItem}
           />
      )}
       {itemToFinalize && companyId && (
        <FinalizeRentalDialog
          open={isFinalizeDialogOpen}
          onOpenChange={setIsFinalizeDialogOpen}
          material={itemToFinalize}
          companyId={companyId}
        />
      )}
    </div>
  );
}
