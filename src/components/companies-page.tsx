

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import { Company, UserProfile } from '@/lib/types';
import { Loader2, Plus, Trash2, Edit, Lock } from 'lucide-react';
import { useAuth } from '../context/auth-context';
import { Table, TableBody, TableCell, TableRow, TableHeader, TableHead } from './ui/table';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import { addMonths } from 'date-fns';
import { Checkbox } from './ui/checkbox';
import { Switch } from './ui/switch';


const formSchema = z.object({
  name: z.string().min(2, { message: 'Company name must be at least 2 characters.' }),
});

interface CompaniesPageProps {
  allUsers: UserProfile[];
}

export function CompaniesPage({ allUsers }: CompaniesPageProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'companies'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const companiesData: Company[] = [];
      querySnapshot.forEach((doc) => {
        companiesData.push({ id: doc.id, ...doc.data() } as Company);
      });
      setCompanies(companiesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenDeleteDialog = (company: Company) => {
    setSelectedCompany(company);
    setIsDeleteDialogOpen(true);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not Authenticated' });
      return;
    }
    setIsSubmitting(true);
    try {
      const now = new Date();
      const trialEndDate = addMonths(now, 2);

      await addDoc(collection(db, 'companies'), {
        name: values.name,
        ownerId: user.uid,
        createdAt: now.toISOString(),
        planId: 'premium-annually',
        billingCycle: 'annually',
        subscriptionStatus: 'Trial',
        subscriptionEndDate: trialEndDate.toISOString(),
        enableOrderMaterials: true,
      });
      toast({ title: 'Company Created', description: `${values.name} has been created and is on a 2-month trial.` });
      form.reset();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (selectedCompany) {
      try {
        await deleteDoc(doc(db, 'companies', selectedCompany.id));
        toast({ title: 'Company Deleted'});
      } catch (e) {
        toast({ variant: "destructive", title: 'Error', description: "Could not delete company." });
      }
    }
    setIsDeleteDialogOpen(false);
    setSelectedCompany(null);
  };
  
  const getOwnerName = (ownerId: string) => {
    const owner = allUsers.find(u => u.uid === ownerId);
    return owner?.name || 'Unknown';
  }

  const handleFeatureToggle = async (companyId: string, feature: 'enableOrderMaterials' | 'isLocked', enabled: boolean) => {
    try {
      await updateDoc(doc(db, 'companies', companyId), { [feature]: enabled });
      toast({ title: "Company Updated", description: "Company settings have been changed." });
    } catch(e) {
      toast({ variant: 'destructive', title: "Error", description: "Failed to update feature."});
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Management</CardTitle>
          <CardDescription>
            Add new companies here. The company owner will be set to the current super-admin. An admin user for that company should be created separately. New companies start on a 2-month free trial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-end gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>New Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Acme Construction Inc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add Company
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Existing Companies</CardTitle>
        </CardHeader>
        <CardContent>
            {loading ? (
                <div className="flex justify-center"> <Loader2 className="h-8 w-8 animate-spin"/></div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Company Name</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead>Order Materials</TableHead>
                            <TableHead>Portal Lock</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {companies.length > 0 ? companies.map((company) => (
                            <TableRow key={company.id}>
                                <TableCell className="font-medium">{company.name}</TableCell>
                                <TableCell>{getOwnerName(company.ownerId)}</TableCell>
                                <TableCell>
                                    <Checkbox
                                        checked={!!company.enableOrderMaterials}
                                        onCheckedChange={(checked) => handleFeatureToggle(company.id, 'enableOrderMaterials', !!checked)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Switch
                                        checked={!!company.isLocked}
                                        onCheckedChange={(checked) => handleFeatureToggle(company.id, 'isLocked', checked)}
                                        aria-label="Toggle portal lock"
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                     <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(company)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                             <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">No companies found.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
              </div>
            )}
        </CardContent>
      </Card>
       <DeleteConfirmationDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen} 
        onConfirm={handleDeleteConfirm}
        title="Delete Company"
        description={`Are you sure you want to delete this company? This action will not delete associated users or sites, but may orphan them.`}
      />
    </div>
  );
}
