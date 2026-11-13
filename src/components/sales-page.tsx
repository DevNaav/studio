
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Sale, InventoryItem, SalePaymentStatus, SalePayment, paymentMethods } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ShoppingCart, Loader2, Trash2, GitCommitHorizontal, Edit, IndianRupee, MoreHorizontal, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { onSubCollectionSnapshot, onGlobalCollectionSnapshot, addDocWithSiteId, softDeleteDocWithId, updateDocWithId, useSite } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { format } from 'date-fns';
import { Textarea } from './ui/textarea';
import { writeBatch, collection, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Label } from '@/components/ui/label';
import { UnitConversionDialog } from './unit-conversion-dialog';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { LogSalePaymentDialog } from './log-sale-payment-dialog';
import { LogSummaryPaymentDialog } from './log-summary-payment-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DashboardExpenseChart } from './dashboard-expense-chart';
import { todayISO } from '@/lib/utils';
import { logActivity } from '@/lib/activity-log';


const saleMaterialItemSchema = z.object({
  name: z.string().min(1, "Material is required."),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0."),
  unit: z.string().optional(),
});

const saleFormSchema = z.object({
  description: z.string().min(3, "Sale description is too short."),
  quantity: z.coerce.number().min(0.1, 'Quantity must be greater than 0.'),
  salePrice: z.coerce.number().min(0, 'Sale price must be a positive number'),
  transportCost: z.coerce.number().min(0).optional(),
  buyerInfo: z.string().optional(),
  date: z.string().min(1, 'Date is required.'),
  materialsUsed: z.array(saleMaterialItemSchema).min(1, "At least one material is required."),
  destinationSiteId: z.string({ required_error: "Please select a destination." }).min(1, "Please select a destination."),
  totalQuantityUnit: z.string().optional(),
}).refine(data => {
    if (data.destinationSiteId === 'external') {
        return !!data.buyerInfo && data.buyerInfo.length > 0;
    }
    return true;
}, {
    message: "Buyer information is required for external sales.",
    path: ["buyerInfo"],
});


interface SalesPageProps {
  companyId: string | null | undefined;
  siteId: string;
}

export function SalesPage({ companyId, siteId }: SalesPageProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);
  const [isSaleDialogOpen, setIsSaleDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConversionDialogOpen, setIsConversionDialogOpen] = useState(false);
  const [conversionData, setConversionData] = useState<{ index: number; quantity: number; unit: string } | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isSummaryPaymentOpen, setIsSummaryPaymentOpen] = useState(false);
  const [summaryPaymentData, setSummaryPaymentData] = useState<{ destinationId: string; destinationName: string; outstandingBalance: number, sourceSiteId: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const { sites } = useSite();

  const getSiteName = (id: string | undefined) => {
    if (!id || id === 'external') return 'External Sale';
    if (id === 'manufacturing') return 'Manufacturing';
    return sites.find(s => s.id === id)?.name || 'Unknown Site';
  };

  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    let salesLoaded = false;
    let materialsLoaded = false;

    const checkLoading = () => {
        if(salesLoaded && materialsLoaded) {
            setLoading(false);
        }
    }

    const unsubSales = onSubCollectionSnapshot<Sale>('sales', companyId, siteId, (data) => {
        setSales(data.filter(sale => !sale.isDeleted).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        salesLoaded = true;
        checkLoading();
    });
    
    const unsubMaterials = onSubCollectionSnapshot<InventoryItem>('inventory', companyId, siteId, (data) => {
      setAllInventory(data.filter(item => item.type === 'Material'));
      materialsLoaded = true;
      checkLoading();
    });

    return () => {
      unsubSales();
      unsubMaterials();
    };
  }, [companyId, siteId]);

  const inventorySummary = useMemo(() => {
    const summary: { [key: string]: { name: string; stored: number; avgPrice: number; unit: string; } } = {};
    
    allInventory.forEach(item => {
        const normalizedName = item.name.trim().toLowerCase();
        if (!summary[normalizedName]) {
            summary[normalizedName] = { name: item.name, stored: 0, avgPrice: 0, unit: item.unit || '' };
        }
    });

    for (const key in summary) {
        const materialItems = allInventory.filter(item => item.name.trim().toLowerCase() === key && item.status === 'Bought' && item.pricePerUnit);
        const totalCost = materialItems.reduce((acc, item) => acc + (item.pricePerUnit! * item.quantity), 0);
        const totalQuantity = materialItems.reduce((acc, item) => acc + item.quantity, 0);
        summary[key].avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;

        const storedBought = allInventory
            .filter(item => item.name.trim().toLowerCase() === key && item.status === 'Bought')
            .reduce((acc, item) => acc + item.quantity, 0);
        
        const storedUsed = allInventory
            .filter(item => item.name.trim().toLowerCase() === key && item.status === 'Used')
            .reduce((acc, item) => acc + item.quantity, 0);
        
        summary[key].stored = storedBought - storedUsed;
    }

    return summary;
  }, [allInventory]);
  
  const salesSummary = useMemo(() => {
    const summary: { [key: string]: { totalQuantity: number; totalProductionCost: number; totalSalePrice: number; totalAmountPaid: number; totalTransportCost: number; sourceSiteId: string; destinationSiteId: string; } } = {};

    sales.forEach(sale => {
      const key = `${sale.siteId}-${sale.destinationSiteId || 'external'}`;
      if (!summary[key]) {
        summary[key] = { totalQuantity: 0, totalProductionCost: 0, totalSalePrice: 0, totalAmountPaid: 0, totalTransportCost: 0, sourceSiteId: sale.siteId, destinationSiteId: sale.destinationSiteId || 'external' };
      }
      summary[key].totalQuantity += sale.quantity;
      summary[key].totalProductionCost += sale.productionCost;
      summary[key].totalSalePrice += sale.salePrice;
      summary[key].totalAmountPaid += sale.amountPaid;
      summary[key].totalTransportCost += sale.transportCost || 0;
    });

    return Object.values(summary).map((data) => {
      const totalProfit = data.totalSalePrice - (data.totalProductionCost + data.totalTransportCost);
      const outstandingBalance = data.totalSalePrice - data.totalAmountPaid;
      return {
        destinationId: data.destinationSiteId,
        destinationName: getSiteName(data.destinationSiteId),
        sourceSiteName: getSiteName(data.sourceSiteId),
        ...data,
        totalProfit,
        outstandingBalance,
      };
    });
  }, [sales, sites]);

  const totalNetProfit = useMemo(() => {
    return salesSummary.reduce((acc, summary) => acc + summary.totalProfit, 0);
  }, [salesSummary]);
  
  const salesProfitabilityBreakdown = useMemo(() => {
    const dataMap = new Map<string, number>();
    sales.forEach(sale => {
      const profit = sale.salePrice - (sale.productionCost + (sale.transportCost || 0));
      if (profit > 0) {
        dataMap.set(sale.gradeName, (dataMap.get(sale.gradeName) || 0) + profit);
      }
    });
    return Array.from(dataMap.entries()).map(([name, value]) => ({ name, value }));
  }, [sales]);

  const totalSalesProfit = useMemo(() => {
    return salesProfitabilityBreakdown.reduce((acc, item) => acc + item.value, 0);
  }, [salesProfitabilityBreakdown]);


  
  const saleForm = useForm<z.infer<typeof saleFormSchema>>({
    resolver: zodResolver(saleFormSchema),
  });

  const { fields: saleMaterialFields, append: appendSaleMaterial, remove: removeSaleMaterial, update: updateSaleMaterial } = useFieldArray({
    control: saleForm.control,
    name: "materialsUsed"
  });

  const materialsUsedForSale = saleForm.watch('materialsUsed');
  const destinationSiteId = saleForm.watch('destinationSiteId');
  
  const estimatedCost = (materialsUsedForSale || []).reduce((acc, material) => {
    if (!material.name || !material.quantity) return acc;
    const materialInfo = inventorySummary[material.name.toLowerCase()];
    if (materialInfo) {
        return acc + (materialInfo.avgPrice * material.quantity);
    }
    return acc;
  }, 0);


  useEffect(() => {
    if (isSaleDialogOpen) {
      if (selectedSale) {
        saleForm.reset({
          description: selectedSale.gradeName,
          quantity: selectedSale.quantity,
          salePrice: selectedSale.salePrice,
          transportCost: selectedSale.transportCost || 0,
          buyerInfo: selectedSale.buyerInfo || '',
          date: selectedSale.date,
          materialsUsed: Object.entries(selectedSale.materialsUsed).map(([name, data]) => ({ name, quantity: data.quantity, unit: data.unit || '' })),
          destinationSiteId: selectedSale.destinationSiteId || 'external',
          totalQuantityUnit: selectedSale.totalQuantityUnit || 'm³',
        });
      } else {
        saleForm.reset({
          quantity: 1,
          date: todayISO(),
          buyerInfo: '',
          salePrice: 0,
          transportCost: 0,
          materialsUsed: [],
          description: '',
          destinationSiteId: undefined,
          totalQuantityUnit: 'm³',
        });
      }
    }
  }, [isSaleDialogOpen, selectedSale, saleForm]);


  const onSaleSubmit = async (values: z.infer<typeof saleFormSchema>) => {
    if (!companyId) return;

    if (!selectedSale) { // Only check for stock on new sales
        const insufficientMaterials = values.materialsUsed.filter(material => {
            const materialName = material.name.toLowerCase();
            const requiredQty = material.quantity;
            const stock = inventorySummary[materialName]?.stored || 0;
            return stock < requiredQty;
        });

        if (insufficientMaterials.length > 0) {
            const errorMessages = insufficientMaterials.map(material => {
                const materialName = material.name.toLowerCase();
                const requiredQty = material.quantity;
                const stock = inventorySummary[materialName]?.stored || 0;
                return `${material.name} (Required: ${requiredQty.toFixed(2)}, Available: ${stock.toFixed(2)})`;
            }).join(', ');
            
            toast({
                variant: "destructive",
                title: "Insufficient Stock",
                description: `Cannot log sale. Insufficient materials: ${errorMessages}`,
                duration: 10000,
            });
            return;
        }
    }

    setIsSubmitting(true);
    
    const destinationIdForSale = values.destinationSiteId === 'external' ? '' : values.destinationSiteId;
    const saleData: Omit<Sale, 'id' | 'isDeleted'> = {
        companyId,
        siteId,
        date: values.date,
        gradeName: values.description,
        quantity: values.quantity,
        salePrice: values.salePrice,
        transportCost: values.transportCost,
        productionCost: estimatedCost,
        buyerInfo: values.buyerInfo || '',
        destinationSiteId: destinationIdForSale,
        materialsUsed: values.materialsUsed.reduce((acc, mat) => {
            acc[mat.name] = { quantity: mat.quantity, unit: mat.unit || '' };
            return acc;
        }, {} as { [key: string]: { quantity: number; unit: string } }),
        amountPaid: selectedSale ? selectedSale.amountPaid : 0,
        // Re-check the status on edit: a changed price can make a sale paid or unpaid again.
        paymentStatus: !selectedSale || !selectedSale.amountPaid
            ? 'Unpaid'
            : selectedSale.amountPaid >= values.salePrice ? 'Paid' : 'Partially Paid',
        paymentHistory: selectedSale?.paymentHistory ?? [],
        totalQuantityUnit: values.totalQuantityUnit || 'm³',
    };

    try {
      if (selectedSale) {
        await updateDocWithId('sales', selectedSale.id, saleData);
        toast({ title: "Sale Updated", description: `Sale of "${values.description}" has been updated.` });
      } else {
        const batch = writeBatch(db);
        const saleDocRef = doc(collection(db, 'sales'));
        batch.set(saleDocRef, { ...saleData, isDeleted: false });

        // Stock moves on the day of the sale (which may be back-dated), not the day it was typed in.
        const date = values.date;
        const inventoryCollectionRef = collection(db, 'inventory');

        values.materialsUsed.forEach(mat => {
            if (mat.quantity > 0) {
                const usedRecordRef = doc(inventoryCollectionRef);
                batch.set(usedRecordRef, {
                    companyId,
                    siteId,
                    name: mat.name,
                    type: 'Material',
                    status: 'Used',
                    quantity: mat.quantity,
                    date,
                    description: `Used for sale/transfer: ${values.description}`,
                    isDeleted: false,
                });
            }
        });

        if(destinationIdForSale) {
            const boughtRecordRef = doc(inventoryCollectionRef);
            const pricePerUnit = values.quantity > 0 ? values.salePrice / values.quantity : 0;
            batch.set(boughtRecordRef, {
                companyId,
                siteId: destinationIdForSale,
                name: values.description,
                type: 'Material',
                status: 'Bought',
                quantity: values.quantity,
                pricePerUnit: pricePerUnit,
                date,
                description: `Transferred from ${getSiteName(siteId)}`,
                isDeleted: false,
                unit: values.totalQuantityUnit || 'm³'
            });

            if(values.salePrice > 0) {
              const expenseRef = doc(collection(db, 'expenses'));
              batch.set(expenseRef, {
                  companyId,
                  siteId: destinationIdForSale,
                  description: `Material transfer: ${values.description} from ${getSiteName(siteId)}`,
                  category: 'Materials',
                  amount: values.salePrice,
                  date,
                  isDeleted: false
              });
            }
        }
        
        await batch.commit();
        logActivity({
            companyId, siteId, action: 'create', entity: 'sales', entityId: saleDocRef.id, label: values.description,
            summary: `Added sale "${values.description}" · Rs. ${values.salePrice.toLocaleString('en-IN')} to ${destinationIdForSale ? getSiteName(destinationIdForSale) : (values.buyerInfo || 'buyer')}`,
        });
        toast({ title: "Sale Logged", description: `Sale of "${values.description}" logged. Inventory updated.` });
      }

      setIsSaleDialogOpen(false);
      setSelectedSale(null);
    } catch(e) {
      console.error("Failed to log sale:", e);
      toast({ variant: 'destructive', title: "Error", description: "Failed to log the sale and update inventory." });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleOpenDeleteDialog = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDeleteDialogOpen(true);
  };
  
  const handleOpenEditDialog = (sale: Sale) => {
    setSelectedSale(sale);
    setIsSaleDialogOpen(true);
  };
  
  const handleOpenPaymentDialog = (sale: Sale) => {
    setSelectedSale(sale);
    setIsPaymentDialogOpen(true);
  };

  const handleOpenSummaryPaymentDialog = (summary: typeof salesSummary[0]) => {
    setSummaryPaymentData({
      destinationId: summary.destinationId,
      destinationName: summary.destinationName,
      outstandingBalance: summary.outstandingBalance,
      sourceSiteId: summary.sourceSiteId
    });
    setIsSummaryPaymentOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedSale) {
      await softDeleteDocWithId('sales', selectedSale.id);
      toast({ title: "Sale Record Deleted", description: "The sale has been marked as deleted. This action does not revert inventory changes." });
    }
    setIsDeleteDialogOpen(false);
    setSelectedSale(null);
  };

  const handleOpenConversionDialog = (index: number) => {
    const material = saleForm.getValues(`materialsUsed.${index}`);
    if (material) {
        setConversionData({
            index,
            quantity: material.quantity,
            unit: material.unit || '',
        });
        setIsConversionDialogOpen(true);
    }
  };
  
  const handleConversion = (newQuantity: number, newUnit: string) => {
    if (conversionData) {
        updateSaleMaterial(conversionData.index, {
            ...saleForm.getValues(`materialsUsed.${conversionData.index}`),
            quantity: newQuantity,
            unit: newUnit,
        });
        toast({
            title: 'Unit Converted',
            description: `Material updated to ${newQuantity} ${newUnit}.`,
        });
    }
  };

  const getPaymentStatusVariant = (status: SalePaymentStatus) => {
    switch (status) {
        case 'Paid': return 'default';
        case 'Unpaid': return 'destructive';
        case 'Partially Paid': return 'secondary';
        default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Sales &amp; Transfers Summary</CardTitle>
                <CardDescription>A summary of all sales and material transfers from this unit.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Net Profit</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${totalNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{totalNetProfit.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">Across all sales from this unit</p>
                    </CardContent>
                  </Card>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Source Site</TableHead>
                            <TableHead>Destination</TableHead>
                            <TableHead>Production Cost</TableHead>
                            <TableHead>Transport Cost</TableHead>
                            <TableHead>Sale Price</TableHead>
                            <TableHead>Payments Received</TableHead>
                            <TableHead>Outstanding Balance</TableHead>
                            <TableHead>Total Profit</TableHead>
                            {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {salesSummary.length > 0 ? (
                            salesSummary.map(summary => (
                                <TableRow key={summary.sourceSiteId + summary.destinationId}>
                                    <TableCell className="font-medium">{summary.sourceSiteName}</TableCell>
                                    <TableCell className="font-medium">{summary.destinationName}</TableCell>
                                    <TableCell>₹{summary.totalProductionCost.toLocaleString()}</TableCell>
                                    <TableCell>₹{summary.totalTransportCost.toLocaleString()}</TableCell>
                                    <TableCell>₹{summary.totalSalePrice.toLocaleString()}</TableCell>
                                    <TableCell>₹{summary.totalAmountPaid.toLocaleString()}</TableCell>
                                    <TableCell className="font-semibold">₹{summary.outstandingBalance.toLocaleString()}</TableCell>
                                    <TableCell className="font-semibold">₹{summary.totalProfit.toLocaleString()}</TableCell>
                                    {isAdmin && (
                                        <TableCell className="text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleOpenSummaryPaymentDialog(summary)}
                                                disabled={summary.outstandingBalance <= 0}
                                            >
                                                Log Payment
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={isAdmin ? 9 : 8} className="h-24 text-center">No sales data to summarize yet.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><ShoppingCart /> Detailed Sales Log</CardTitle>
                    <CardDescription>Record concrete sales and automatically deduct materials from your inventory.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => { setSelectedSale(null); setIsSaleDialogOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Log Sale/Transfer
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Sale Price</TableHead>
                    <TableHead>Transport Cost</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead>Balance Due</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Buyer</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
                </TableHeader>
                <TableBody>
                {sales.length > 0 ? (
                    sales.map((sale) => (
                    <TableRow key={sale.id}>
                        <TableCell>{format(new Date(sale.date), 'PPP')}</TableCell>
                        <TableCell className="font-medium">{sale.gradeName}</TableCell>
                        <TableCell>{getSiteName(sale.destinationSiteId)}</TableCell>
                        <TableCell>
                        {sale.salePrice ? `₹${sale.salePrice.toLocaleString()}` : 'N/A'}
                        </TableCell>
                        <TableCell>
                        {sale.transportCost ? `₹${sale.transportCost.toLocaleString()}` : 'N/A'}
                        </TableCell>
                        <TableCell>
                        ₹{sale.amountPaid.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-semibold">
                        ₹{(sale.salePrice - sale.amountPaid).toLocaleString()}
                        </TableCell>
                        <TableCell>
                        <Badge variant={getPaymentStatusVariant(sale.paymentStatus)}>{sale.paymentStatus}</Badge>
                        </TableCell>
                        <TableCell>{sale.buyerInfo || 'N/A'}</TableCell>
                        {isAdmin && (
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => handleOpenPaymentDialog(sale)}>
                                            <IndianRupee className="mr-2 h-4 w-4" />
                                            Log Payment
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleOpenEditDialog(sale)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit Sale
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleOpenDeleteDialog(sale)} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete Sale
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        )}
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={isAdmin ? 10 : 9} className="h-24 text-center">No sales recorded yet.</TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </CardContent>
        </Card>
      
      {/* Sale Dialog */}
      <Dialog open={isSaleDialogOpen} onOpenChange={(isOpen) => { setIsSaleDialogOpen(isOpen); if(!isOpen) setSelectedSale(null); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedSale ? 'Edit' : 'Log New'} Sale / Transfer</DialogTitle>
             <DialogDescription>
              {selectedSale ? 'Edit the details of this sale/transfer.' : 'Select the materials and quantities used. Material consumption will be calculated and deducted from inventory automatically.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...saleForm}>
            <form onSubmit={saleForm.handleSubmit(onSaleSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <FormField
                        control={saleForm.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Sale/Transfer Description</FormLabel>
                                <FormControl><Input placeholder="e.g., M25 Grade Concrete" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                   <FormField
                        control={saleForm.control}
                        name="destinationSiteId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Destination</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a destination..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="external">External Sale/Client</SelectItem>
                                        {sites.filter(s => s.id !== siteId && (s.status === 'Active' || s.status === 'Planning')).map(s => (
                                            <SelectItem key={s.id} value={s.id}>Transfer to: {s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                  <FormField
                    control={saleForm.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Quantity Sold/Transferred (e.g., in m³)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 5" {...field} disabled={isSubmitting}/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={saleForm.control}
                    name="totalQuantityUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit for Total Quantity</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., m³, tons" {...field} disabled={isSubmitting}/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={saleForm.control}
                        name="salePrice"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Total Sale Price (₹)</FormLabel>
                            <FormControl>
                            <Input type="number" placeholder="e.g., 25000" {...field} disabled={isSubmitting} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormField
                        control={saleForm.control}
                        name="transportCost"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Transport Cost (₹)</FormLabel>
                            <FormControl>
                            <Input type="number" placeholder="e.g., 2000" {...field} disabled={isSubmitting} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                  </div>
                   <FormField
                    control={saleForm.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Sale/Transfer</FormLabel>
                        <FormControl><Input type="date" {...field} disabled={isSubmitting} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   {destinationSiteId === 'external' && (
                    <FormField
                        control={saleForm.control}
                        name="buyerInfo"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Buyer Information</FormLabel>
                            <FormControl><Textarea placeholder="e.g., John Doe, Ph: 9876543210" {...field} disabled={isSubmitting} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                   )}
                </div>
                <div className="space-y-4">
                    <div>
                        <Label>Materials Used</Label>
                        <div className="space-y-2 mt-2 border rounded-md p-4 max-h-64 overflow-y-auto">
                        {saleMaterialFields.map((field, index) => (
                            <div key={field.id} className="flex items-end gap-2">
                                <FormField
                                control={saleForm.control}
                                name={`materialsUsed.${index}.name`}
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                    <FormLabel className="text-xs">Material</FormLabel>
                                    <Select
                                      onValueChange={(value) => {
                                        field.onChange(value);
                                        const materialInfo = inventorySummary[value.toLowerCase()];
                                        if (materialInfo) {
                                          updateSaleMaterial(index, {
                                            ...saleForm.getValues(`materialsUsed.${index}`),
                                            name: value,
                                            unit: materialInfo.unit,
                                          });
                                        }
                                      }}
                                      value={field.value}
                                    >
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select Material" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                        {Object.values(inventorySummary).map(mat => (
                                            <SelectItem key={mat.name} value={mat.name}>{mat.name} (Stock: {mat.stored.toFixed(2)})</SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    </FormItem>
                                )}
                                />
                                <FormField
                                control={saleForm.control}
                                name={`materialsUsed.${index}.quantity`}
                                render={({ field }) => (
                                    <FormItem className="w-32">
                                      <FormLabel className="text-xs">Quantity</FormLabel>
                                      <FormControl><Input type="number" placeholder="Qty" {...field} /></FormControl>
                                    </FormItem>
                                )}
                                />
                                <FormField
                                control={saleForm.control}
                                name={`materialsUsed.${index}.unit`}
                                render={({ field }) => (
                                    <FormItem className="w-24">
                                      <FormLabel className="text-xs">Unit</FormLabel>
                                      <FormControl><Input placeholder="Unit" {...field} /></FormControl>
                                    </FormItem>
                                )}
                                />
                                <Button type="button" variant="outline" size="icon" className="w-10" onClick={() => handleOpenConversionDialog(index)}>
                                    <GitCommitHorizontal className="h-4 w-4" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" className="w-10" onClick={() => removeSaleMaterial(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                        <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => appendSaleMaterial({ name: '', quantity: 0, unit: '' })}>
                            <Plus className="mr-2 h-4 w-4" /> Add Material
                        </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Estimated Production Cost</Label>
                        <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm">
                        ₹{estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => {setIsSaleDialogOpen(false); setSelectedSale(null);}} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {selectedSale ? 'Update Record' : 'Log Record'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      

       <DeleteConfirmationDialog 
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Sale Record"
        description="Are you sure you want to delete this sale record? This action does not revert the inventory changes."
      />
      {conversionData && (
          <UnitConversionDialog
            open={isConversionDialogOpen}
            onOpenChange={setIsConversionDialogOpen}
            initialQuantity={conversionData.quantity}
            initialUnit={conversionData.unit}
            onConvert={handleConversion}
        />
      )}
       {selectedSale && (
        <LogSalePaymentDialog
          open={isPaymentDialogOpen}
          onOpenChange={setIsPaymentDialogOpen}
          sale={selectedSale}
        />
      )}
      {summaryPaymentData && companyId && (
          <LogSummaryPaymentDialog
            open={isSummaryPaymentOpen}
            onOpenChange={setIsSummaryPaymentOpen}
            destinationId={summaryPaymentData.destinationId}
            destinationName={summaryPaymentData.destinationName}
            outstandingBalance={summaryPaymentData.outstandingBalance}
            siteId={summaryPaymentData.sourceSiteId}
          />
      )}
    </div>
  );
}
