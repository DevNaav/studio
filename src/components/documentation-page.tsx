
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, BookText, Edit, Trash2, Loader2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Document as DocumentType } from '@/lib/types';
import { onGlobalCollectionSnapshot, addDocToGlobalCollection, updateDocWithId, softDeleteDocWithId } from '@/context/site-context';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import { useAuth } from '@/context/auth-context';
import { format, parseISO } from 'date-fns';

const formSchema = z.object({
  name: z.string().min(3, 'Title is too short'),
  content: z.string().min(10, 'Content is too short'),
});

export function DocumentationPage() {
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { isSuperAdmin, userProfile } = useAuth();
  
  useEffect(() => {
    if (!userProfile?.companyId) return;
    // We use a special siteId 'documentation' to store these docs globally for a company
    const unsubscribe = onGlobalCollectionSnapshot<DocumentType>('documents', userProfile.companyId, (docs) => {
        setDocuments(docs.filter(d => d.siteId === 'documentation' && !d.isDeleted));
    });
    return () => unsubscribe();
  }, [userProfile?.companyId]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  
  useEffect(() => {
    if (selectedDocument) {
      form.reset({
        name: selectedDocument.name,
        content: selectedDocument.content || '',
      });
    } else {
      form.reset({ name: '', content: '' });
    }
  }, [selectedDocument, form, isDialogOpen]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!userProfile?.companyId) return;
    setIsSubmitting(true);
    const docData = { 
        name: values.name, 
        content: values.content,
        uploadDate: new Date().toISOString(),
        siteId: 'documentation', // Special identifier
    };
    
    try {
        if (selectedDocument) {
            await updateDocWithId('documents', selectedDocument.id, docData);
            toast({ title: "Documentation Updated", description: `"${values.name}" has been updated.` });
        } else {
            await addDocToGlobalCollection('documents', userProfile.companyId, docData);
            toast({ title: "Documentation Added", description: `"${values.name}" has been added.` });
        }
        setIsDialogOpen(false);
        setSelectedDocument(null);
    } catch(error) {
        console.error("Save error:", error)
        toast({ variant: 'destructive', title: "Save Failed", description: "Could not save the documentation." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDocument) return;
    try {
      await softDeleteDocWithId("documents", selectedDocument.id);
      toast({ title: "Documentation Deleted", description: `"${selectedDocument.name}" has been deleted.` });
      setIsDeleteDialogOpen(false);
      setSelectedDocument(null);
    } catch (error) {
      toast({ variant: 'destructive', title: "Deletion Failed", description: "Could not delete the documentation." });
    }
  };
  
  const handleOpenDialog = (doc: DocumentType | null = null) => {
    setSelectedDocument(doc);
    setIsDialogOpen(true);
  };
  
  const handleOpenViewDialog = (doc: DocumentType) => {
    setSelectedDocument(doc);
    setIsViewDialogOpen(true);
  };

  const openDeleteDialog = (doc: DocumentType) => {
    setSelectedDocument(doc);
    setIsDeleteDialogOpen(true);
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><BookText /> Internal Documentation</CardTitle>
            <CardDescription>
              {isSuperAdmin ? 'Create and manage documentation for new features and updates.' : 'View documentation for new features and updates.'}
              </CardDescription>
          </div>
          {isSuperAdmin && (
              <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Add Documentation</Button>
          )}
        </CardHeader>
        <CardContent>
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.length > 0 ? (
                  documents.sort((a,b) => parseISO(b.uploadDate).getTime() - parseISO(a.uploadDate).getTime()).map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.name}</TableCell>
                      <TableCell>{format(parseISO(doc.uploadDate), 'PPP')}</TableCell>
                      <TableCell className="text-right">
                         <Button variant="ghost" size="icon" onClick={() => handleOpenViewDialog(doc)}>
                            <Eye className="h-4 w-4" />
                        </Button>
                        {isSuperAdmin && (
                            <>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(doc)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(doc)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">No documentation available yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedDocument ? 'Edit' : 'Add New'} Documentation</DialogTitle>
            <DialogDescription>
                {selectedDocument ? 'Update the details for this documentation entry.' : 'Create a new documentation entry for your team.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., v1.2 Release Notes" {...field} disabled={isSubmitting}/>
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
              <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Content (Markdown is supported)</FormLabel>
                      <FormControl>
                        <Textarea rows={10} placeholder="Describe the new feature or update..." {...field} disabled={isSubmitting}/>
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
              <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {selectedDocument ? 'Save Changes' : 'Publish'}
                  </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.name}</DialogTitle>
            <DialogDescription>
              Last updated on {selectedDocument?.uploadDate ? format(parseISO(selectedDocument.uploadDate), 'PPP') : 'N/A'}
            </DialogDescription>
          </DialogHeader>
          <div className="prose dark:prose-invert max-h-[60vh] overflow-auto rounded-lg border p-4">
            <pre className="whitespace-pre-wrap font-sans bg-transparent p-0">{selectedDocument?.content}</pre>
          </div>
           <DialogFooter>
                  <Button type="button" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <DeleteConfirmationDialog 
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete Documentation"
        description={`Are you sure you want to delete "${selectedDocument?.name}"? This action cannot be undone.`}
      />
    </div>
  );
}
