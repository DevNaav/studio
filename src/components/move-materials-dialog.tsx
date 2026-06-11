

'use client';

import { useState, useEffect } from 'react';
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
import { Site, InventoryItem, Machine, Labor } from '@/lib/types';
import { Loader2, Users, Tractor } from 'lucide-react';
import { useSite } from '@/context/site-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

const formSchema = z.object({
  destinationSiteId: z.string().min(1, 'Please select a destination for materials.'),
  items: z.array(z.object({
    name: z.string(),
    quantityToMove: z.coerce.number().min(0),
    maxQuantity: z.number(),
    pricePerUnit: z.number().optional(),
  })),
  shiftingCost: z.coerce.number().min(0).optional(),
});

interface ReleaseAssetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceSite: Site;
  materialsToMove: Omit<InventoryItem, 'id' | 'companyId' | 'siteId' | 'type' | 'status' | 'date'>[];
  machinesToRelease: Machine[];
  laborersToRelease: Labor[];
  onAssetsReleased: (data: { destinationSiteId: string; items: any[], shiftingCost: number }) => void;
}

export function ReleaseAssetsDialog({ 
    open, 
    onOpenChange, 
    sourceSite, 
    materialsToMove, 
    machinesToRelease,
    laborersToRelease,
    onAssetsReleased 
}: ReleaseAssetsDialogProps) {
  const { sites } = useSite();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      destinationSiteId: 'warehouse',
      items: materialsToMove.map(m => ({
          name: m.name,
          quantityToMove: m.quantity,
          maxQuantity: m.quantity,
          pricePerUnit: m.pricePerUnit
      })),
      shiftingCost: 0
    }
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const otherSites = sites.filter(s => s.id !== sourceSite.id && s.status !== 'Completed');

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    await onAssetsReleased({
        destinationSiteId: values.destinationSiteId,
        items: values.items,
        shiftingCost: values.shiftingCost || 0,
    });
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Step 2: Release Assets from {sourceSite.name}</DialogTitle>
          <DialogDescription>
            Handle remaining assets and log final costs before completing the project.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <fieldset disabled={isSubmitting} className="space-y-6">

              {/* Machines and Labor Section */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Tractor /> Machines to Release</h3>
                  <div className="border rounded-md p-4 text-sm bg-muted/50">
                    {machinesToRelease.length > 0 ? (
                      <ul className="list-disc pl-5">
                        {machinesToRelease.map(m => <li key={m.id}>{m.name}</li>)}
                      </ul>
                    ) : <p>No machines assigned to this site.</p>}
                     <p className="text-xs text-muted-foreground mt-2">All machines will be unassigned from this site.</p>
                  </div>
                </div>
                 <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Users /> Laborers to Release</h3>
                  <div className="border rounded-md p-4 text-sm bg-muted/50">
                    {laborersToRelease.length > 0 ? (
                      <ul className="list-disc pl-5">
                        {laborersToRelease.map(l => <li key={l.id}>{l.name}</li>)}
                      </ul>
                    ) : <p>No laborers assigned to this site.</p>}
                     <p className="text-xs text-muted-foreground mt-2">All laborers will be marked as 'unassigned'.</p>
                  </div>
                </div>
              </div>

               <Separator />

              {/* Materials Section */}
              {materialsToMove.length > 0 && (
                <div className="space-y-4">
                    <h3 className="font-semibold">Move Leftover Materials</h3>
                    <FormField
                    control={form.control}
                    name="destinationSiteId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Move to</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a destination" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="warehouse">Warehouse (General Stock)</SelectItem>
                            {otherSites.map(site => (
                              <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormLabel>Materials to Move</FormLabel>
                  <ScrollArea className="h-48">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Material</TableHead>
                                <TableHead>Available</TableHead>
                                <TableHead>Quantity to Move</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => (
                              <TableRow key={field.id}>
                                  <TableCell>{field.name}</TableCell>
                                  <TableCell>{field.maxQuantity.toFixed(2)}</TableCell>
                                  <TableCell>
                                      <FormField 
                                        control={form.control}
                                        name={`items.${index}.quantityToMove`}
                                        render={({ field }) => (
                                            <Input 
                                                type="number" 
                                                {...field}
                                                max={materialsToMove[index].quantity}
                                                min={0}
                                            />
                                        )}
                                      />
                                  </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
               <Separator />
               {/* Shifting Cost Section */}
                <FormField
                    control={form.control}
                    name="shiftingCost"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Total Cost of Shifting (Optional)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="Enter any final transport or demobilization costs" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

            </fieldset>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Finalize & Complete Site
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
