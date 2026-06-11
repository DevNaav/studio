
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { useSite } from '@/context/site-context';
import { Site, siteStatuses, Machine, InventoryItem, SiteType, siteTypes } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { onGlobalCollectionSnapshot, getSubCollection } from '@/context/site-context';

interface AddSiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site?: Site;
}

export function AddSiteDialog({ open, onOpenChange, site }: AddSiteDialogProps) {
  const { addSite, updateSite, sites } = useSite();
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allMachineNames, setAllMachineNames] = useState<string[]>([]);
  
  const allSiteNames = sites.map(s => s.name.toLowerCase());

  useEffect(() => {
    if (!userProfile?.companyId) return;
    const unsub = onGlobalCollectionSnapshot<Machine>('machines', userProfile.companyId, (machines) => {
        setAllMachineNames(machines.map(m => m.name.toLowerCase()));
    });
    return () => unsub();
  }, [userProfile?.companyId]);
  
  const formSchema = z.object({
    name: z.string().min(2, { message: 'Site name must be at least 2 characters.' })
      .refine(name => !allMachineNames.includes(name.toLowerCase()), {
        message: 'This name is already in use by a machine.'
      })
      .refine(name => {
        const lowerCaseName = name.toLowerCase();
        if (site) {
          return lowerCaseName === site.name.toLowerCase() || !allSiteNames.includes(lowerCaseName);
        }
        return !allSiteNames.includes(lowerCaseName);
      }, {
        message: 'This name is already in use.'
      }),
    location: z.string().min(5, { message: 'Location must be at least 5 characters.' }),
    status: z.enum(siteStatuses, { required_error: "Please select a status." }),
    type: z.enum(siteTypes, { required_error: 'Please select a type.' }),
    budget: z.coerce.number().min(0, 'Budget must be a positive number.').optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      location: '',
      budget: 0,
      type: 'Construction',
    },
  });

  useEffect(() => {
    if (site) {
      form.reset({
        name: site.name,
        location: site.location,
        status: site.status,
        type: site.type || 'Construction',
        budget: site.budget,
      });
    } else {
        if(open) {
            form.reset({
                name: '',
                location: '',
                status: undefined,
                type: 'Construction',
                budget: 0,
            });
        }
    }
  }, [site, open, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      if (site) {
        // The logic for handling 'Completed' status with stock check has been moved to CompleteSiteDialog
        await updateSite({ ...site, ...values });
        toast({ title: "Project Updated", description: `The project "${values.name}" has been updated successfully.` });
      } else {
        await addSite(values);
        toast({ title: "Project Created", description: `The project "${values.name}" has been created successfully.` });
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save site:", error);
      toast({ variant: 'destructive', title: "Operation Failed", description: "Could not save the project. Please try again." });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
        <DialogTitle>{site ? 'Edit Project' : 'Create New Project'}</DialogTitle>
        <DialogDescription>
            {site ? 'Update the details for this project.' : 'Enter the details for the new construction site or manufacturing unit.'}
        </DialogDescription>
        </DialogHeader>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <fieldset disabled={isSubmitting} className="space-y-4">
            <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                    <Input placeholder="e.g., Downtown Tower" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                    <Input placeholder="e.g., 123 Main St, Metropolis" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Project Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Choose a type" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {siteTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Project Budget (Rs.) (Optional)</FormLabel>
                    <FormControl>
                    <Input type="number" placeholder="e.g., 5000000" {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Choose an option" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {siteStatuses.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
            </fieldset>
            <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {site ? 'Save Changes' : 'Create Project'}
            </Button>
            </DialogFooter>
        </form>
        </Form>
    </DialogContent>
    </Dialog>
  );
}
