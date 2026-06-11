
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MaterialRequest, MaterialRequestStatus, materialRequestStatuses, InventoryItem, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Loader2, Package, Clock, Truck, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { onSubCollectionSnapshot, addDocWithSiteId, updateDocWithId, softDeleteDocWithId, onGlobalCollectionSnapshot } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { DeleteConfirmationDialog } from '../delete-confirmation-dialog';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';

const requestFormSchema = z.object({
  materialName: z.string().min(1, 'Please select a material.'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  urgency: z.enum(['Low', 'Medium', 'High']),
  notes: z.string().optional(),
});

interface RequestFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  siteId: string;
  companyId: string;
  user: UserProfile;
  allCompanyInventory: InventoryItem[];
}

function RequestFormDialog({ isOpen, onOpenChange, siteId, companyId, user, allCompanyInventory }: RequestFormDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const form = useForm<z.infer<typeof requestFormSchema>>({
        resolver: zodResolver(requestFormSchema),
        defaultValues: {
            urgency: 'Medium',
        },
    });

    useEffect(() => {
        if (isOpen) {
            form.reset({
                materialName: '',
                quantity: 1,
                urgency: 'Medium',
                notes: '',
            });
        }
    }, [isOpen, form]);

    const onSubmit = async (values: z.infer<typeof requestFormSchema>) => {
        setIsSubmitting(true);
        try {
            const requestData: Omit<MaterialRequest, 'id' | 'isDeleted' | 'companyId'> = {
                ...values,
                siteId,
                requesterId: user.uid,
                requesterName: user.name || 'N/A',
                requestDate: new Date().toISOString(),
                status: 'Pending',
            };
            await addDocWithSiteId('material_requests', companyId, siteId, requestData);
            toast({ title: 'Request Submitted', description: `Your request for ${values.materialName} has been submitted.` });
            onOpenChange(false);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to submit request.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const materialOptions = useMemo(() => {
        return [...new Set(allCompanyInventory.map(item => item.name))];
    }, [allCompanyInventory]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Request New Material</DialogTitle>
                    <DialogDescription>Fill in the details for the material you need.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField control={form.control} name="materialName" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Material</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a material" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {materialOptions.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="quantity" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Quantity</FormLabel>
                                <FormControl><Input type="number" placeholder="e.g., 100" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="urgency" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Urgency</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Low">Low</SelectItem>
                                        <SelectItem value="Medium">Medium</SelectItem>
                                        <SelectItem value="High">High</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="notes" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notes (Optional)</FormLabel>
                                <FormControl><Textarea placeholder="e.g., Required for foundation work starting next week." {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Submit Request
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

interface MaterialRequestsTabProps {
  siteId: string;
}

export function MaterialRequestsTab({ siteId }: MaterialRequestsTabProps) {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [allCompanyInventory, setAllCompanyInventory] = useState<InventoryItem[]>([]);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const { userProfile, isAdmin } = useAuth();

  useEffect(() => {
    if (!userProfile?.companyId) {
      setLoading(false);
      return;
    }
    const companyId = userProfile.companyId;
    let requestsLoaded = false;
    let inventoryLoaded = false;

    setLoading(true);
    const checkLoading = () => {
        if(requestsLoaded && inventoryLoaded) setLoading(false);
    }
    
    const unsubRequests = onSubCollectionSnapshot<MaterialRequest>('material_requests', companyId, siteId, (data) => {
        setRequests(data.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()));
        requestsLoaded = true;
        checkLoading();
    });

    const unsubInventory = onGlobalCollectionSnapshot<InventoryItem>('inventory', companyId, (items) => {
        setAllCompanyInventory(items.filter(item => item.type === 'Material' && !item.isDeleted));
        inventoryLoaded = true;
        checkLoading();
    });
    
    return () => {
      unsubRequests();
      unsubInventory();
    };
  }, [siteId, userProfile?.companyId]);

  const getStatusVariant = (status: MaterialRequestStatus) => {
    switch (status) {
      case 'Pending': return 'secondary';
      case 'Approved': return 'outline';
      case 'Dispatched': return 'default';
      case 'Received': return 'default';
      case 'Rejected': return 'destructive';
    }
  };
  
  const getStatusIcon = (status: MaterialRequestStatus) => {
    switch (status) {
      case 'Pending': return <Clock className="h-4 w-4" />;
      case 'Approved':
      case 'Dispatched': return <Truck className="h-4 w-4" />;
      case 'Received': return <CheckCircle className="h-4 w-4" />;
      case 'Rejected': return <XCircle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Package /> Material Requests</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin" />
            </CardContent>
        </Card>
    );
  }

  if (!userProfile) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Package /> Material Requests</CardTitle>
          <CardDescription>Request materials and track their status.</CardDescription>
        </div>
        <Button onClick={() => setIsRequestDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Request</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Urgency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length > 0 ? (
              requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>{format(new Date(req.requestDate), 'PPP')}</TableCell>
                  <TableCell className="font-medium">{req.materialName}</TableCell>
                  <TableCell>{req.quantity}</TableCell>
                  <TableCell>{req.requesterName}</TableCell>
                  <TableCell>{req.urgency}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(req.status)} className="flex items-center gap-1 w-fit">
                        {getStatusIcon(req.status)}
                        <span>{req.status}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                        <Button variant="outline" size="sm">Manage</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">No material requests yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {userProfile.companyId && (
            <RequestFormDialog
                isOpen={isRequestDialogOpen}
                onOpenChange={setIsRequestDialogOpen}
                siteId={siteId}
                companyId={userProfile.companyId}
                user={userProfile}
                allCompanyInventory={allCompanyInventory}
            />
        )}
      </CardContent>
    </Card>
  );
}
