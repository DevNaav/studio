
'use client';

import { useState } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Download, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { useAuth } from '@/context/auth-context';
import { addDocWithSiteId } from '@/context/site-context';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const bbsItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  diameter: z.coerce.number().positive('Diameter must be positive'),
  barCount: z.coerce.number().optional(),
  length: z.coerce.number().optional(),
  shape: z.string().optional(),
});

const formSchema = z.object({
  projectName: z.string().min(1, 'Project name is required'),
  drawingNumber: z.string().min(1, 'Drawing number is required'),
  date: z.string().min(1, 'Date is required'),
  items: z.array(bbsItemSchema).min(1, 'At least one item is required for the BBS'),
});

const steelWeights: { [diameter: number]: number } = {
  8: 0.395,
  10: 0.617,
  12: 0.888,
  16: 1.578,
  20: 2.466,
  25: 3.853,
  32: 6.313,
};

interface BbsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
}

export function BbsDialog({ open, onOpenChange, siteId }: BbsDialogProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectName: '',
      drawingNumber: '',
      date: new Date().toISOString().split('T')[0],
      items: [{ description: '', diameter: 8, barCount: undefined, length: undefined, shape: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
        if (userProfile?.companyId && siteId) {
            await addDocWithSiteId('bbs', userProfile.companyId, siteId, values);
            toast({ title: "BBS Saved", description: "The Bar Bending Schedule has been saved." });
        }
        generatePdf(values);
    } catch (error) {
        console.error("Failed to save BBS", error);
        toast({ variant: 'destructive', title: "Save Failed", description: "Could not save the BBS data." });
    } finally {
        setIsSubmitting(false);
        onOpenChange(false);
    }
  };

  const generatePdf = (data: z.infer<typeof formSchema>) => {
    const doc = new jsPDF();
    const tableData = data.items.map((item, index) => {
      const unitWeight = steelWeights[item.diameter] || 0;
      const barCount = item.barCount || 0;
      const length = item.length || 0;
      const totalLength = barCount > 0 && length > 0 ? barCount * length : 0;
      const totalWeight = totalLength > 0 ? totalLength * unitWeight : 0;
      return [
        index + 1,
        item.description,
        item.diameter,
        barCount > 0 ? barCount : '-',
        length > 0 ? length.toFixed(2) : '-',
        totalLength > 0 ? totalLength.toFixed(2) : '-',
        unitWeight.toFixed(3),
        totalWeight > 0 ? totalWeight.toFixed(2) : '-',
      ];
    });
    
    const totalWeightSum = tableData.reduce((sum, row) => {
      const weight = parseFloat(row[7] as string);
      return sum + (isNaN(weight) ? 0 : weight);
    }, 0);

    doc.setFontSize(18);
    doc.text('Bar Bending Schedule', 14, 22);
    doc.setFontSize(12);
    doc.text(`Project: ${data.projectName}`, 14, 32);
    doc.text(`Drawing No: ${data.drawingNumber}`, 14, 38);
    doc.text(`Date: ${data.date}`, 14, 44);

    autoTable(doc, {
      startY: 50,
      head: [['S.No', 'Description', 'Dia (mm)', 'No. of Bars', 'Cut Length (m)', 'Total Length (m)', 'Kg/m', 'Total Wt (Kg)']],
      body: tableData,
      foot: [['', 'Total', '', '', '', '', '', totalWeightSum.toFixed(2)]],
      footStyles: { fontStyle: 'bold' },
      didDrawPage: (data) => {
        const str = 'Page ' + doc.getNumberOfPages();
        doc.setFontSize(10);
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.text(str, data.settings.margin.left, pageHeight - 10);
      },
    });

    doc.save(`bbs-${data.projectName}.pdf`);
    toast({ title: 'BBS Generated', description: 'Your PDF has been downloaded.' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create Bar Bending Schedule (BBS)</DialogTitle>
          <DialogDescription>
            Add items to the schedule, then save it and/or export it as a PDF.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <fieldset disabled={isSubmitting} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="projectName" render={({ field }) => (
                  <FormItem><FormLabel>Project Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="drawingNumber" render={({ field }) => (
                  <FormItem><FormLabel>Drawing Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Diameter (mm)</TableHead>
                      <TableHead>No. of Bars</TableHead>
                      <TableHead>Cut Length (m)</TableHead>
                      <TableHead>Shape</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow key={field.id}>
                        <TableCell><FormField control={form.control} name={`items.${index}.description`} render={({ field }) => <Input {...field} />} /></TableCell>
                        <TableCell>
                          <FormField control={form.control} name={`items.${index}.diameter`} render={({ field }) => (
                            <Select onValueChange={val => field.onChange(Number(val))} value={String(field.value)}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Dia" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Object.keys(steelWeights).map(dia => (
                                    <SelectItem key={dia} value={dia}>{dia} mm</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                          )} />
                        </TableCell>
                        <TableCell>
                          <FormField 
                            control={form.control} 
                            name={`items.${index}.barCount`} 
                            render={({ field }) => (
                              <Input 
                                type="number"
                                {...field}
                                onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
                                value={field.value ?? ''}
                                placeholder="Optional"
                              />
                            )} 
                          />
                        </TableCell>
                        <TableCell>
                          <FormField 
                            control={form.control} 
                            name={`items.${index}.length`} 
                            render={({ field }) => (
                              <Input 
                                type="number" 
                                step="0.01" 
                                {...field}
                                onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
                                value={field.value ?? ''}
                                placeholder="Optional"
                              />
                            )} 
                          />
                        </TableCell>
                        <TableCell><FormField control={form.control} name={`items.${index}.shape`} render={({ field }) => <Input {...field} />} /></TableCell>
                        <TableCell><Button variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex justify-between items-center">
                <Button type="button" variant="outline" onClick={() => append({ description: '', diameter: 8, barCount: undefined, length: undefined, shape: '' })}>
                  <Plus className="mr-2 h-4 w-4" /> Add Row
                </Button>
                {form.formState.errors.items && (
                  <p className="text-sm text-destructive">{form.formState.errors.items.root?.message}</p>
                )}
              </div>
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="button" variant="outline" onClick={() => generatePdf(form.getValues())} disabled={!form.formState.isValid}>
                <Download className="mr-2 h-4 w-4" /> Generate PDF Only
              </Button>
              <Button type="submit" disabled={isSubmitting || !form.formState.isValid}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                Save &amp; Generate PDF
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
