

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Site, InventoryItem, Machine, Labor, ShiftedMaterialStatus, shiftedMaterialStatuses, RentedMaterial, Tool, ToolStatus, toolStatuses } from '@/lib/types';
import { Loader2, Users, Tractor, Plus, Trash2, Box, Wrench } from 'lucide-react';
import { useSite } from '@/context/site-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

const materialTransferSchema = z.object({
  name: z.string().min(1, 'Material is required'),
  quantity: z.coerce.number().min(0.01, 'Quantity must be greater than 0'),
  destinationSiteId: z.string().min(1, 'Destination is required'),
  status: z.enum(shiftedMaterialStatuses, { required_error: 'Status is required' }),
});

const toolTransferSchema = z.object({
  name: z.string().min(1, 'Tool is required'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  destinationSiteId: z.string().min(1, 'Destination is required'),
  status: z.enum(toolStatuses, { required_error: 'Status is required' }),
});

const formSchema = z.object({
  materialTransfers: z.array(materialTransferSchema),
  toolTransfers: z.array(toolTransferSchema),
  shiftingCost: z.coerce.number().min(0).optional(),
});

interface ReleaseAssetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceSite: Site;
  materialsToMove: Omit<InventoryItem, 'id' | 'companyId' | 'siteId' | 'type' | 'status' | 'date'>[];
  machinesToRelease: Machine[];
  laborersToRelease: Labor[];
  rentedMaterialsToRelease: RentedMaterial[];
  toolsToMove: Tool[];
  onAssetsReleased: (data: { materialTransfers: z.infer<typeof materialTransferSchema>[]; toolTransfers: z.infer<typeof toolTransferSchema>[]; shiftingCost: number }) => void;
}

export function ReleaseAssetsDialog({
  open,
  onOpenChange,
  sourceSite,
  materialsToMove,
  machinesToRelease,
  laborersToRelease,
  rentedMaterialsToRelease,
  toolsToMove,
  onAssetsReleased,
}: ReleaseAssetsDialogProps) {
  const { sites } = useSite();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      materialTransfers: [],
      toolTransfers: [],
      shiftingCost: 0,
    },
  });

  const { fields: materialFields, append: appendMaterial, remove: removeMaterial } = useFieldArray({
    control: form.control,
    name: 'materialTransfers',
  });
  
  const { fields: toolFields, append: appendTool, remove: removeTool } = useFieldArray({
    control: form.control,
    name: 'toolTransfers',
  });
  
  const watchedMaterialTransfers = form.watch('materialTransfers');
  const watchedToolTransfers = form.watch('toolTransfers');

  const otherSites = sites.filter(s => s.id !== sourceSite.id && s.status !== 'Completed');

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Validate Material quantities
    const materialQuantityMap = new Map<string, number>();
    for (const transfer of values.materialTransfers) {
      materialQuantityMap.set(transfer.name, (materialQuantityMap.get(transfer.name) || 0) + transfer.quantity);
    }

    for (const [name, totalQuantity] of materialQuantityMap.entries()) {
      const available = materialsToMove.find(m => m.name === name)?.quantity || 0;
      if (totalQuantity > available) {
        toast({
          variant: 'destructive',
          title: 'Insufficient Material Stock',
          description: `You are trying to move ${totalQuantity} of ${name}, but only ${available.toFixed(2)} is available.`,
        });
        return;
      }
    }
    
    // Validate Tool quantities
    const toolQuantityMap = new Map<string, number>();
     for (const transfer of values.toolTransfers) {
      toolQuantityMap.set(transfer.name, (toolQuantityMap.get(transfer.name) || 0) + transfer.quantity);
    }
    for (const [name, totalQuantity] of toolQuantityMap.entries()) {
      const available = toolsToMove.find(t => t.name === name)?.quantity || 0;
      if (totalQuantity > available) {
        toast({
          variant: 'destructive',
          title: 'Insufficient Tool Stock',
          description: `You are trying to move ${totalQuantity} of ${name}, but only ${available} is available.`,
        });
        return;
      }
    }

    setIsSubmitting(true);
    onAssetsReleased({
      materialTransfers: values.materialTransfers,
      toolTransfers: values.toolTransfers,
      shiftingCost: values.shiftingCost || 0,
    });
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Step 2: Release Assets from {sourceSite.name}</DialogTitle>
          <DialogDescription>Handle remaining assets and log final costs before completing the project.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <fieldset disabled={isSubmitting} className="space-y-6">
              {/* Machines, Labor, Rented Items Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2"><Tractor /> Machines to Release</h3>
                  <div className="border rounded-md p-4 text-sm bg-muted/50 h-32 overflow-y-auto">
                    {machinesToRelease.length > 0 ? <ul className="list-disc pl-5"> {machinesToRelease.map(m => <li key={m.id}>{m.name}</li>)} </ul> : <p>No machines assigned.</p>}
                    <p className="text-xs text-muted-foreground mt-2">All will be unassigned.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2"><Users /> Laborers to Release</h3>
                  <div className="border rounded-md p-4 text-sm bg-muted/50 h-32 overflow-y-auto">
                    {laborersToRelease.length > 0 ? <ul className="list-disc pl-5"> {laborersToRelease.map(l => <li key={l.id}>{l.name}</li>)} </ul> : <p>No laborers assigned.</p>}
                    <p className="text-xs text-muted-foreground mt-2">All will be marked 'unassigned'.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2"><Box /> Rented Items to Release</h3>
                  <div className="border rounded-md p-4 text-sm bg-muted/50 h-32 overflow-y-auto">
                    {rentedMaterialsToRelease.length > 0 ? <ul className="list-disc pl-5"> {rentedMaterialsToRelease.map(item => <li key={item.id}>{item.materialName} ({item.quantity} {item.unit})</li>)} </ul> : <p>No active rentals.</p>}
                    <p className="text-xs text-muted-foreground mt-2">All will be marked 'Returned'.</p>
                  </div>
                </div>
              </div>

              <Separator />
              
              {/* Materials Section */}
              {materialsToMove.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Move Leftover Materials</h3>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader><TableRow><TableHead>Material</TableHead><TableHead>Quantity</TableHead><TableHead>Destination</TableHead><TableHead>Status</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {materialFields.map((field, index) => (
                            <TableRow key={field.id}>
                                <TableCell><FormField control={form.control} name={`materialTransfers.${index}.name`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Material" /></SelectTrigger></FormControl><SelectContent>{materialsToMove.map(m => <SelectItem key={m.name} value={m.name}>{m.name} (Avail: {m.quantity.toFixed(2)})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/></TableCell>
                                <TableCell><FormField control={form.control} name={`materialTransfers.${index}.quantity`} render={({ field }) => (<FormItem><FormControl><Input type="number" placeholder="Qty" {...field} /></FormControl><FormMessage /></FormItem>)}/></TableCell>
                                <TableCell><FormField control={form.control} name={`materialTransfers.${index}.destinationSiteId`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Destination" /></SelectTrigger></FormControl><SelectContent><SelectItem value="warehouse">Warehouse</SelectItem>{otherSites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/></TableCell>
                                <TableCell><FormField control={form.control} name={`materialTransfers.${index}.status`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger></FormControl><SelectContent>{shiftedMaterialStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/></TableCell>
                                <TableCell><Button variant="ghost" size="icon" onClick={() => removeMaterial(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                            </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => appendMaterial({ name: '', quantity: 0, destinationSiteId: '', status: 'Available' })}><Plus className="mr-2 h-4 w-4" />Add Material Transfer</Button>
                </div>
              )}
              
              <Separator />
              
              {/* Tools Section */}
              {toolsToMove.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Move Leftover Tools</h3>
                  <div className="border rounded-lg">
                     <Table>
                      <TableHeader><TableRow><TableHead>Tool</TableHead><TableHead>Quantity</TableHead><TableHead>Destination</TableHead><TableHead>Status</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {toolFields.map((field, index) => (
                            <TableRow key={field.id}>
                                <TableCell><FormField control={form.control} name={`toolTransfers.${index}.name`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Tool" /></SelectTrigger></FormControl><SelectContent>{toolsToMove.map(t => <SelectItem key={t.name} value={t.name}>{t.name} (Avail: {t.quantity})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/></TableCell>
                                <TableCell><FormField control={form.control} name={`toolTransfers.${index}.quantity`} render={({ field }) => (<FormItem><FormControl><Input type="number" placeholder="Qty" {...field} /></FormControl><FormMessage /></FormItem>)}/></TableCell>
                                <TableCell><FormField control={form.control} name={`toolTransfers.${index}.destinationSiteId`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Destination" /></SelectTrigger></FormControl><SelectContent><SelectItem value="warehouse">Warehouse</SelectItem>{otherSites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/></TableCell>
                                <TableCell><FormField control={form.control} name={`toolTransfers.${index}.status`} render={({ field }) => (<FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger></FormControl><SelectContent>{toolStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/></TableCell>
                                <TableCell><Button variant="ghost" size="icon" onClick={() => removeTool(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                            </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => appendTool({ name: '', quantity: 1, destinationSiteId: '', status: 'Good' })}><Plus className="mr-2 h-4 w-4" />Add Tool Transfer</Button>
                </div>
              )}

              <Separator />

              {/* Shifting Cost Section */}
              <FormField control={form.control} name="shiftingCost" render={({ field }) => (<FormItem><FormLabel>Total Cost of Shifting (Optional)</FormLabel><FormControl><Input type="number" placeholder="Enter any final transport or demobilization costs" {...field} /></FormControl><FormMessage /></FormItem>)}/>
            </fieldset>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Finalize &amp; Complete Site
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
