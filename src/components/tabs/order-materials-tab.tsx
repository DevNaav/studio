
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { InventoryItem, Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Plus, ShoppingCart, Truck, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { onSubCollectionSnapshot, onGlobalCollectionSnapshot, addDocWithSiteId, updateDocWithId } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { Separator } from '../ui/separator';
import { todayISO } from '@/lib/utils';

const orderFormSchema = z.object({
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
});

interface OrderMaterialsTabProps {
  siteId: string;
}

export function OrderMaterialsTab({ siteId }: OrderMaterialsTabProps) {
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<InventoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const { userProfile } = useAuth();
  
  const companyId = userProfile?.companyId;

  useEffect(() => {
    if (!companyId) return;

    const unsubInventory = onGlobalCollectionSnapshot<InventoryItem>('inventory', companyId, (items) => {
      setAllInventory(items.filter(item => item.type === 'Material' && !item.isDeleted));
    });

    const unsubOrders = onSubCollectionSnapshot<Order>('orders', companyId, siteId, (data) => {
        setOrders(data.filter(order => !order.isDeleted));
    });
    
    return () => {
      unsubInventory();
      unsubOrders();
    };
  }, [companyId, siteId]);

  const orderForm = useForm<z.infer<typeof orderFormSchema>>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: { quantity: 1 },
  });

  const uniqueMaterials = useMemo(() => {
    const materialMap = new Map<string, InventoryItem>();
    allInventory.forEach(item => {
      const existing = materialMap.get(item.name);
      if (!existing || new Date(item.date) > new Date(existing.date)) {
        materialMap.set(item.name, item);
      }
    });
    return Array.from(materialMap.values());
  }, [allInventory]);
  
  const pendingOrders = useMemo(() => {
    return orders.filter(o => o.status === 'Pending').sort((a,b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [orders]);


  const handleOpenOrderDialog = (material: InventoryItem) => {
    setSelectedMaterial(material);
    orderForm.reset({ quantity: 1 });
    setIsOrderDialogOpen(true);
  };

  const onOrderSubmit = async (values: z.infer<typeof orderFormSchema>) => {
    if (!companyId || !selectedMaterial) return;
    setIsSubmitting(true);
    
    try {
        const orderData: Omit<Order, 'id'| 'isDeleted' | 'companyId'> = {
            siteId,
            materialName: selectedMaterial.name,
            quantity: values.quantity,
            vendorName: selectedMaterial.vendor,
            vendorNumber: selectedMaterial.vendorNumber,
            pricePerUnit: selectedMaterial.pricePerUnit,
            status: 'Pending',
            orderDate: todayISO(),
        };
        await addDocWithSiteId('orders', companyId, siteId, orderData);

        toast({
            title: "Order Logged",
            description: `An order for ${values.quantity} units of ${selectedMaterial.name} has been logged as 'Pending'.`,
        });
        setIsOrderDialogOpen(false);

    } catch(e) {
      console.error("Failed to log order:", e);
      toast({ variant: 'destructive', title: "Error", description: "Failed to log the order." });
    } finally {
        setIsSubmitting(false);
    }
  };


  const handleMarkAsDelivered = async (order: Order) => {
    if(!companyId) return;
    try {
        await updateDocWithId('orders', order.id, { status: 'Delivered', deliveryDate: todayISO() });
        
        await addDocWithSiteId('inventory', companyId, siteId, {
            name: order.materialName,
            type: 'Material',
            status: 'Bought',
            quantity: order.quantity,
            pricePerUnit: order.pricePerUnit,
            vendor: order.vendorName,
            vendorNumber: order.vendorNumber,
            date: todayISO(),
        });

        toast({ title: "Order Delivered", description: `${order.quantity} units of ${order.materialName} have been added to the inventory.` });
    } catch (e) {
        console.error("Failed to mark as delivered:", e);
        toast({ variant: 'destructive', title: "Error", description: "Could not update the order status." });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShoppingCart /> Re-order Materials</CardTitle>
          <CardDescription>Select a previously purchased material to quickly place a new order with the last known vendor.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Last Vendor</TableHead>
                <TableHead>Vendor Number</TableHead>
                <TableHead>Last Price (per unit)</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uniqueMaterials.length > 0 ? (
                uniqueMaterials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell className="font-medium">{material.name}</TableCell>
                    <TableCell>{material.vendor || 'N/A'}</TableCell>
                    <TableCell>{material.vendorNumber || 'N/A'}</TableCell>
                    <TableCell>₹{material.pricePerUnit?.toLocaleString() || 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleOpenOrderDialog(material)} disabled={!material.vendorNumber}>
                        <Plus className="mr-2 h-4 w-4" /> Order
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">No past material purchases to re-order from.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck /> Pending Deliveries</CardTitle>
          <CardDescription>Track incoming material orders for this site.</CardDescription>
        </CardHeader>
        <CardContent>
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order Date</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Est. Delivery</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingOrders.length > 0 ? (
                pendingOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{format(new Date(order.orderDate), 'PPP')}</TableCell>
                    <TableCell className="font-medium">{order.materialName}</TableCell>
                    <TableCell>{order.quantity}</TableCell>
                    <TableCell>{order.vendorName || 'N/A'}</TableCell>
                    <TableCell>{order.estimatedDeliveryDate ? format(new Date(order.estimatedDeliveryDate), 'PPP') : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => handleMarkAsDelivered(order)}>
                        <CheckCircle className="mr-2 h-4 w-4" /> Mark as Delivered
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">No pending orders.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order {selectedMaterial?.name}</DialogTitle>
             <DialogDescription>
              Specify the quantity you want to order. This will create a pending order log.
            </DialogDescription>
          </DialogHeader>
          <Form {...orderForm}>
            <form onSubmit={orderForm.handleSubmit(onOrderSubmit)} className="space-y-4 py-4">
              <FormField
                control={orderForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 100" {...field} disabled={isSubmitting}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsOrderDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Log Order
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
