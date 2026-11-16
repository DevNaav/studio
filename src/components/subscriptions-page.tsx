

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Company, SubscriptionStatus, BillingCycle, Plan, planIds } from '@/lib/types';
import { Check, Crown, Plus, Trash2, Edit } from 'lucide-react';
import { format, isPast, isValid } from 'date-fns';
import { ManageSubscriptionDialog } from './manage-subscription-dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { formatCurrency } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { useToast } from '@/hooks/use-toast';
import { softDeleteDocWithId, updateDocWithId } from '@/context/site-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { addDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import { PLANS, planById } from '@/lib/plans';

const planFormSchema = z.object({
  name: z.enum(planIds),
  priceMonthly: z.coerce.number().positive(),
  priceAnnually: z.coerce.number().positive(),
  features: z.array(z.object({ value: z.string().min(1, "Feature cannot be empty.") })).min(1, "At least one feature is required."),
});

// The real price list lives in src/lib/plans.ts; customers' screens and payments read it.
const defaultPlans: Plan[] = PLANS.map(p => ({
  id: p.id,
  name: p.id,
  priceMonthly: p.monthly,
  priceAnnually: p.annually,
  features: p.features,
}));

interface SubscriptionsPageProps {
  allCompanies: Company[];
}

export function SubscriptionsPage({ allCompanies }: SubscriptionsPageProps) {
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annually');
  
  const [plans, setPlans] = useState<Plan[]>(defaultPlans);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [isDeletePlanDialogOpen, setIsDeletePlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const { toast } = useToast();

  const planForm = useForm<z.infer<typeof planFormSchema>>({
    resolver: zodResolver(planFormSchema),
  });
  
  const { fields, append, remove } = useFieldArray({
    control: planForm.control,
    name: "features"
  });

  // Plans stored in the database are no longer used for prices (see src/lib/plans.ts).

  useEffect(() => {
    if (isPlanDialogOpen) {
      if (selectedPlan) {
        planForm.reset({
          name: selectedPlan.name,
          priceMonthly: selectedPlan.priceMonthly,
          priceAnnually: selectedPlan.priceAnnually,
          features: selectedPlan.features.map(f => ({ value: f })),
        });
      } else {
        planForm.reset({
          name: 'basic',
          priceMonthly: 0,
          priceAnnually: 0,
          features: [{ value: '' }],
        });
      }
    }
  }, [isPlanDialogOpen, selectedPlan, planForm]);

  const handleManageClick = (company: Company) => {
    setSelectedCompany(company);
    setIsManageDialogOpen(true);
  };
  
  const onPlanSubmit = async (values: z.infer<typeof planFormSchema>) => {
    const planData = {
      name: values.name,
      priceMonthly: values.priceMonthly,
      priceAnnually: values.priceAnnually,
      features: values.features.map(f => f.value),
      companyId: null, // Global plan
    };

    try {
      if(selectedPlan) {
        await updateDocWithId('plans', selectedPlan.id, planData);
        toast({ title: 'Plan Updated' });
      } else {
        await addDoc(collection(db, 'plans'), { ...planData, isDeleted: false });
        toast({ title: 'Plan Created' });
      }
      setIsPlanDialogOpen(false);
    } catch(e) {
      toast({ variant: 'destructive', title: 'Error saving plan' });
    }
  };
  
  const handleDeletePlan = async () => {
    if(selectedPlan) {
      await softDeleteDocWithId('plans', selectedPlan.id);
      toast({ title: 'Plan Deleted' });
    }
    setIsDeletePlanDialogOpen(false);
  }

  const getStatus = (company: Company): SubscriptionStatus => {
    if (company.subscriptionStatus === 'Canceled') {
      return 'Canceled';
    }
    if (company.subscriptionEndDate && isPast(new Date(company.subscriptionEndDate))) {
      return 'Past Due';
    }
    return company.subscriptionStatus;
  };

  const getStatusVariant = (status: SubscriptionStatus) => {
    switch (status) {
      case 'Active':
      case 'Trial':
        return 'secondary';
      case 'Past Due':
        return 'destructive';
      case 'Canceled':
        return 'outline';
      default:
        return 'default';
    }
  };
  
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (!isValid(date)) return 'Invalid Date';
    return format(date, 'PPP');
  };

  return (
    <>
      <div className="space-y-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown /> Subscription Plan Management
              </CardTitle>
              <CardDescription>The plans and prices customers see (excluding GST). To change them, edit src/lib/plans.ts and redeploy.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center items-center gap-4">
                <Label htmlFor="billing-cycle" className={billingCycle === 'monthly' ? 'font-bold' : 'text-muted-foreground'}>
                    Monthly
                </Label>
                <Switch
                    id="billing-cycle"
                    checked={billingCycle === 'annually'}
                    onCheckedChange={(checked) => setBillingCycle(checked ? 'annually' : 'monthly')}
                />
                <Label htmlFor="billing-cycle" className={billingCycle === 'annually' ? 'font-bold' : 'text-muted-foreground'}>
                    Annually (2 months free)
                </Label>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
                {plans.map((plan) => (
                <Card key={plan.id} className="flex flex-col relative">
                    <CardHeader>
                    <CardTitle>{planById(plan.name)?.name ?? plan.name}</CardTitle>
                    <CardDescription className="flex items-baseline">
                        <span className="text-3xl font-bold">{formatCurrency(billingCycle === 'annually' ? plan.priceAnnually : plan.priceMonthly)}</span>
                        <span className="text-muted-foreground">/{billingCycle === 'annually' ? 'year' : 'month'}</span>
                    </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-4">
                    <ul className="space-y-2">
                        {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            <span>{feature}</span>
                        </li>
                        ))}
                    </ul>
                    </CardContent>
                </Card>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Company Subscriptions</CardTitle>
            <CardDescription>
              View the subscription status of all companies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allCompanies.length > 0 ? (
                    allCompanies.map((company) => {
                      const status = getStatus(company);
                      return (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">{company.name}</TableCell>
                          <TableCell className="capitalize">{company.planId ? company.planId.replace('-', ' ') : 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(status)}>{status}</Badge>
                          </TableCell>
                          <TableCell>{formatDate(company.subscriptionEndDate)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => handleManageClick(company)}>
                              Manage
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                        No companies created yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Dialog open={isPlanDialogOpen} onOpenChange={setIsPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPlan ? 'Edit' : 'Create'} Subscription Plan</DialogTitle>
          </DialogHeader>
          <Form {...planForm}>
            <form onSubmit={planForm.handleSubmit(onPlanSubmit)} className="space-y-4">
              <FormField control={planForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Plan Name</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select Plan Type" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {planIds.map(id => <SelectItem key={id} value={id}>{planById(id)?.name ?? id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={planForm.control} name="priceMonthly" render={({ field }) => (
                  <FormItem><FormLabel>Monthly Price (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={planForm.control} name="priceAnnually" render={({ field }) => (
                  <FormItem><FormLabel>Annual Price (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div>
                <Label>Features</Label>
                <div className="space-y-2 mt-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2">
                      <FormField control={planForm.control} name={`features.${index}.value`} render={({ field }) => (
                        <FormItem className="flex-1"><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                 <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ value: '' })}>
                  <Plus className="mr-2 h-4 w-4" /> Add Feature
                </Button>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsPlanDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Save Plan</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <DeleteConfirmationDialog 
        open={isDeletePlanDialogOpen}
        onOpenChange={setIsDeletePlanDialogOpen}
        onConfirm={handleDeletePlan}
        title="Delete Plan"
        description="Are you sure you want to delete this plan? This cannot be undone."
      />

      {selectedCompany && (
        <ManageSubscriptionDialog
          open={isManageDialogOpen}
          onOpenChange={setIsManageDialogOpen}
          company={selectedCompany}
        />
      )}
    </>
  );
}
