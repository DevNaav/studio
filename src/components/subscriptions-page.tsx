

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

const planFormSchema = z.object({
  name: z.enum(planIds),
  priceMonthly: z.coerce.number().positive(),
  priceAnnually: z.coerce.number().positive(),
  features: z.array(z.object({ value: z.string().min(1, "Feature cannot be empty.") })).min(1, "At least one feature is required."),
});

const defaultPlans: Plan[] = [
  {
    id: 'basic_default',
    name: 'basic',
    priceMonthly: 2999,
    priceAnnually: 29999,
    features: ['Up to 5 sites', 'Up to 10 users', 'Core feature access', 'Email support'],
  },
  {
    id: 'premium_default',
    name: 'premium',
    priceMonthly: 5999,
    priceAnnually: 59999,
    features: ['Unlimited sites', 'Unlimited users', 'All features included', 'AI Assistant', 'Priority support'],
  },
];

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

  useEffect(() => {
    // Plans are global (not tied to a company), so read the collection directly.
    const unsub = onSnapshot(collection(db, 'plans'), (snapshot) => {
      const fetchedPlans = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Plan & { isDeleted?: boolean }))
        .filter(p => !p.isDeleted);
      const combinedPlans = [...defaultPlans];
      const fetchedPlanNames = new Set(fetchedPlans.map(p => p.name));

      fetchedPlans.forEach(fetchedPlan => {
        const existingIndex = combinedPlans.findIndex(p => p.name === fetchedPlan.name);
        if (existingIndex > -1) {
            combinedPlans[existingIndex] = fetchedPlan;
        } else {
            combinedPlans.push(fetchedPlan);
        }
      });
      setPlans(combinedPlans);
    });
    return () => unsub();
  }, []);

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
              <CardDescription>Create and manage subscription tiers for your customers.</CardDescription>
            </div>
            <Button onClick={() => { setSelectedPlan(null); setIsPlanDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Create Plan
            </Button>
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
                    Annually (Save over 15%)
                </Label>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
                {plans.map((plan) => (
                <Card key={plan.id} className="flex flex-col relative">
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedPlan(plan); setIsPlanDialogOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedPlan(plan); setIsDeletePlanDialogOpen(true); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <CardHeader>
                    <CardTitle className="capitalize">{plan.name}</CardTitle>
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
                      {planIds.map(id => <SelectItem key={id} value={id} className="capitalize">{id}</SelectItem>)}
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
