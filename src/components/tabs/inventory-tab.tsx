
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { InventoryItem, inventoryItemTypes, inventoryStatuses } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Boxes, ArrowDown, ArrowUp } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import { onSubCollectionSnapshot, addDocWithSiteId } from '@/context/site-context';

const formSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  type: z.enum(inventoryItemTypes),
  status: z.enum(inventoryStatuses),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  date: z.string().min(1, 'Date is required'),
});

interface InventoryTabProps {
  siteId: string;
}

export function InventoryTab({ siteId }: InventoryTabProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onSubCollectionSnapshot<InventoryItem>('inventory', siteId, setInventory);
    return () => unsubscribe();
  }, [siteId]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      type: 'Material',
      status: 'Stored',
      quantity: 1,
      date: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    addDocWithSiteId('inventory', siteId, values);
    toast({ title: "Inventory Item Added", description: `"${values.name}" has been logged.` });
    form.reset();
    setIsDialogOpen(false);
  };
  
  const getStatusBadge = (status: InventoryItem['status']) => {
    switch(status) {
        case 'Bought': return 'secondary';
        case 'Used': return 'destructive';
        case 'Stored': return 'default';
    }
  }

  const inventorySummary = useMemo(() => {
    const summary: { [key: string]: { name: string; type: InventoryItem['type'], bought: number; used: number; stored: number } } = {};
    inventory.forEach(item => {
      const normalizedName = item.name.trim().toLowerCase();
      if (!summary[normalizedName]) {
        summary[normalizedName] = { name: item.name, type: item.type, bought: 0, used: 0, stored: 0 };
      }
      summary[normalizedName].type = item.type;
      
      if (item.status === 'Bought') {
        summary[normalizedName].bought += item.quantity;
      } else if (item.status === 'Used') {
        summary[normalizedName].used += item.quantity;
      }
    });

    Object.values(summary).forEach(item => {
       item.stored = item.bought - item.used;
    });

    return Object.values(summary);
  }, [inventory]);


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Inventory Log</CardTitle>
          <CardDescription>Track materials and machines for this site.</CardDescription>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Log Item</Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
            <h3 className="text-lg font-medium flex items-center gap-2 mb-2"><Boxes /> Inventory Summary</h3>
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Item Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-center">Total Bought</TableHead>
                            <TableHead className="text-center">Total Used</TableHead>
                            <TableHead className="text-center font-semibold">Currently In Stock</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inventorySummary.length > 0 ? (
                            inventorySummary.map(item => (
                                <TableRow key={item.name}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>{item.type}</TableCell>
                                    <TableCell className="text-center text-green-600 flex items-center justify-center gap-1"><ArrowUp size={16} />{item.bought}</TableCell>
                                    <TableCell className="text-center text-red-600 flex items-center justify-center gap-1"><ArrowDown size={16} />{item.used}</TableCell>
                                    <TableCell className="text-center font-bold">{item.stored}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">No inventory summary available.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>

        <Separator />
        
        <div>
            <h3 className="text-lg font-medium mb-2">Detailed Log</h3>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.length > 0 ? (
                    inventory.slice().reverse().map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.type}</TableCell>
                        <TableCell><Badge variant={getStatusBadge(item.status)}>{item.status}</Badge></TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.date}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">No inventory items logged yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
        </div>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log New Inventory Item</DialogTitle>
            <DialogDescription>Fill in the details of the material or machine transaction.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Steel Beams" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem><FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                  <SelectContent>
                    {inventoryItemTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select><FormMessage /></FormItem>
              )} />
               <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
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
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem><FormLabel>Date</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Add Item</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
