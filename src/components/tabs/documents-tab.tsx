
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
import { Label } from '@/components/ui/label';
import { Plus, FileText, Download, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Document as DocumentType } from '@/lib/types';
import { onSubCollectionSnapshot, addDocumentDb, deleteDocumentDb } from '@/context/site-context';
import { DeleteConfirmationDialog } from '../delete-confirmation-dialog';
import { useAuth } from '@/context/auth-context';

const MAX_FILE_SIZE = 5000000; // 5MB
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

const formSchema = z.object({
  name: z.string().min(3, 'Document name is too short'),
  file: z
    .any()
    .refine((files) => files?.length > 0, 'File is required.')
    .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (files) => ACCEPTED_MIME_TYPES.includes(files?.[0]?.type),
      ".jpg, .jpeg, .png, .webp, .pdf, .doc, and .docx files are accepted."
    ),
});


interface DocumentsTabProps {
  siteId: string;
  isMain?: boolean;
}

export function DocumentsTab({ siteId, isMain = false }: DocumentsTabProps) {
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { isAdmin, userProfile } = useAuth();

  useEffect(() => {
    if (!siteId || !userProfile?.companyId) return;
    const unsubscribe = onSubCollectionSnapshot<DocumentType>('documents', userProfile.companyId, siteId, setDocuments);
    return () => unsubscribe();
  }, [siteId, userProfile?.companyId]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      file: undefined,
    },
  });
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!userProfile?.companyId) return;
    const file = values.file[0];
    if (!file) return;

    setIsSubmitting(true);
    try {
      await addDocumentDb(userProfile.companyId, siteId, { name: values.name, file });
      toast({ title: "Document Added", description: `"${values.name}" has been added.` });
      form.reset();
      setIsDialogOpen(false);
    } catch(error) {
        console.error("Upload error:", error)
        toast({ variant: 'destructive', title: "Upload Failed", description: "Could not upload the selected file." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDocument) return;
    try {
      await deleteDocumentDb(selectedDocument);
      toast({ title: "Document Deleted", description: `"${selectedDocument.name}" has been deleted.` });
      setIsDeleteDialogOpen(false);
      setSelectedDocument(null);
    } catch (error) {
      console.error("Delete error:", error);
      toast({ variant: 'destructive', title: "Deletion Failed", description: "Could not delete the document." });
    }
  };

  const openDeleteDialog = (doc: DocumentType) => {
    setSelectedDocument(doc);
    setIsDeleteDialogOpen(true);
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><FileText /> {isMain ? 'Company Documents' : 'Site Documents'}</CardTitle>
          <CardDescription>{isMain ? 'Manage documents for the entire operation.' : 'Manage documents specific to this site.'}</CardDescription>
        </div>
        { (isAdmin || !isMain) && (
            <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Upload Document</Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Upload Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length > 0 ? (
              documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.name}</TableCell>
                  <TableCell>{doc.uploadDate}</TableCell>
                  <TableCell className="text-right">
                     <Button variant="ghost" size="icon" asChild>
                      <a href={doc.url} download={doc.name} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    {(isAdmin || !isMain) && (
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(doc)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center">No documents uploaded yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload New Document</DialogTitle>
            <DialogDescription>Provide a name and select a file to upload.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>Document Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Company Safety Policy" {...field} />
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
              <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { onChange, onBlur, name, ref } }) => (
                  <FormItem>
                      <FormLabel>File</FormLabel>
                      <FormControl>
                        <Input 
                            type="file" 
                            ref={ref}
                            name={name}
                            onBlur={onBlur}
                            onChange={(e) => onChange(e.target.files)}
                            disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />
              <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Document
                  </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <DeleteConfirmationDialog 
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete Document"
        description={`Are you sure you want to delete the document "${selectedDocument?.name}"? This action cannot be undone.`}
      />
    </Card>
  );
}

    
