
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { convertUnits, getUnitCategory, unitCategories } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

const formSchema = z.object({
  fromUnit: z.string(),
  toUnit: z.string(),
  fromQuantity: z.coerce.number(),
});

interface UnitConversionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuantity: number;
  initialUnit: string;
  onConvert: (newQuantity: number, newUnit: string) => void;
}

export function UnitConversionDialog({
  open,
  onOpenChange,
  initialQuantity,
  initialUnit,
  onConvert,
}: UnitConversionDialogProps) {

  const [convertedQuantity, setConvertedQuantity] = useState<number | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  
  const fromUnit = form.watch('fromUnit');
  const toUnit = form.watch('toUnit');
  const fromQuantity = form.watch('fromQuantity');

  useEffect(() => {
    if (open) {
      form.reset({
        fromQuantity: initialQuantity,
        fromUnit: initialUnit,
        toUnit: '',
      });
      setConvertedQuantity(null);
    }
  }, [open, initialQuantity, initialUnit, form]);
  
  useEffect(() => {
    if (fromUnit && toUnit && fromQuantity) {
      const result = convertUnits(fromQuantity, fromUnit, toUnit);
      setConvertedQuantity(result);
    } else {
      setConvertedQuantity(null);
    }
  }, [fromUnit, toUnit, fromQuantity]);

  const onSubmit = () => {
    if (convertedQuantity !== null && toUnit) {
        onConvert(convertedQuantity, toUnit);
        onOpenChange(false);
    }
  };
  
  const unitCategory = getUnitCategory(fromUnit);
  const availableUnits = unitCategory ? unitCategories[unitCategory] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unit Conversion</DialogTitle>
          <DialogDescription>Select units to convert between.</DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4 py-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="fromQuantity" render={({ field }) => (
                  <FormItem><FormLabel>From</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="fromUnit" render={({ field }) => (
                  <FormItem><FormLabel>&nbsp;</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.values(unitCategories).flat().map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage /></FormItem>
                )} />
            </div>
            
            <div className="flex justify-center items-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <FormLabel>To</FormLabel>
                    <div className="flex h-10 w-full items-center justify-start rounded-md border border-input bg-muted px-3 py-2 text-sm">
                        {convertedQuantity !== null ? convertedQuantity.toFixed(4) : '...'}
                    </div>
                 </div>
                 <FormField control={form.control} name="toUnit" render={({ field }) => (
                  <FormItem><FormLabel>&nbsp;</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!unitCategory}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select unit..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {availableUnits.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage /></FormItem>
                )} />
            </div>
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={convertedQuantity === null}>Apply Conversion</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
