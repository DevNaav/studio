
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tool, ToolStatus, toolStatuses } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { onSubCollectionSnapshot, addDocWithSiteId, updateDocWithId, softDeleteDocWithId } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { DeleteConfirmationDialog } from '../delete-confirmation-dialog';
import { Badge } from '../ui/badge';

const formSchema = z.object({
  name: z.string().min(2, 'Tool name is too short'),
  price: z.coerce.number().min(0, 'Price must be a positive number').optional(),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  status: z.enum(toolStatuses),
});

interface ToolsTabProps {
  siteId: string;
  companyId?: string | null;
}

export function ToolsTab({ siteId, companyId }: ToolsTabProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  
  const currentCompanyId = companyId || userProfile?.companyId;

  useEffect(() => {
    if (!siteId || !currentCompanyId) return;
    const unsubscribe = onSubCollectionSnapshot<Tool>('tools', currentCompanyId, siteId, setTools);
    return () => unsubscribe();
  }, [siteId, currentCompanyId]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  
  useEffect(() => {
    if (selectedTool) {
      form.reset(selectedTool);
    } else {
      if (isDialogOpen) {
        form.reset({
          name: '',
          price: 0,
          quantity: 1,
          status: 'Good',
        });
      }
    }
  }, [selectedTool, form, isDialogOpen]);

  const handleOpenDialog = (tool: Tool | null = null) => {
    setSelectedTool(tool);
    setIsDialogOpen(true);
  };
  
  const handleOpenDeleteDialog = (tool: Tool) => {
    setSelectedTool(tool);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedTool) {
      await softDeleteDocWithId('tools', selectedTool.id);
      toast({ title: 'Tool Deleted' });
    }
    setIsDeleteDialogOpen(false);
    setSelectedTool(null);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!currentCompanyId) return;

    if (selectedTool) {
      await updateDocWithId('tools', selectedTool.id, values);
      toast({ title: 'Tool Updated' });
    } else {
      await addDocWithSiteId('tools', currentCompanyId, siteId, values);
      toast({ title: 'Tool Added' });
    }
    setIsDialogOpen(false);
    setSelectedTool(null);
  };

  const getStatusBadge = (status: ToolStatus) => {
    switch (status) {
      case 'Good': return 'secondary';
      case 'Needs Repair': return 'outline';
      case 'Broken': return 'destructive';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Wrench />Tools & Equipment</CardTitle>
          <CardDescription>Track all tools and small equipment used on this site.</CardDescription>
        </div>
        <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Log Tool</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool Name</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tools.map((tool) => (
              <TableRow key={tool.id}>
                <TableCell className="font-medium">{tool.name}</TableCell>
                <TableCell>{tool.quantity}</TableCell>
                <TableCell>₹{tool.price?.toLocaleString() || 'N/A'}</TableCell>
                <TableCell><Badge variant={getStatusBadge(tool.status)}>{tool.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(tool)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(tool)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTool ? 'Edit' : 'Add'} Tool</DialogTitle>
            <DialogDescription>Fill in the details for the tool or equipment.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Tool Name</FormLabel>
                <FormControl><Input placeholder="e.g., Hammer Drill" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem><FormLabel>Price (₹)</FormLabel>
                <FormControl><Input type="number" placeholder="e.g., 5000" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem><FormLabel>Quantity</FormLabel>
                <FormControl><Input type="number" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                  <SelectContent>{toolStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit">{selectedTool ? 'Save Changes' : 'Add Tool'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <DeleteConfirmationDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen} 
        onConfirm={handleDeleteConfirm}
        title="Delete Tool"
        description={`Are you sure you want to delete the log for "${selectedTool?.name}"?`}
      />
    </Card>
  );
}
