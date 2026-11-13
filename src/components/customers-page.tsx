'use client';

/**
 * Customers: what each buyer owes across all sales and sites, a running ledger per
 * customer, logging payments against a customer, and a PDF statement to download or share.
 */
import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { ArrowLeft, Download, IndianRupee, Loader2, Search, Share2, Users } from 'lucide-react';
import type { Company, PaymentMethod, Sale, Site } from '@/lib/types';
import { paymentMethods } from '@/lib/types';
import { onGlobalCollectionSnapshot, recordCustomerPayment } from '@/context/site-context';
import { buildStatement, financialYearStart, groupCustomers, type CustomerSummary } from '@/lib/customer-ledger';
import { buildStatementPdf, statementFileName } from '@/lib/customer-statement-pdf';
import { canShareFiles, loadLogo, sharePdf } from '@/lib/pdf-share';
import { cn, formatCurrency, roundMoney, todayISO } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Period = 'all' | 'fy' | '90';

const day = (d: string) => format(parseISO(d), 'dd MMM yyyy');

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'bad' | 'warn' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-xl font-bold tabular-nums', tone === 'bad' && 'text-red-600', tone === 'warn' && 'text-amber-600')}>{value}</p>
      </CardContent>
    </Card>
  );
}

function PaymentDialog({ customer, open, onOpenChange }: { customer: CustomerSummary; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(customer.outstanding > 0 ? String(customer.outstanding) : '');
      setDate(todayISO());
      setMethod('UPI');
      setNotes('');
      setError(null);
    }
  }, [open, customer.outstanding]);

  const save = async () => {
    const value = roundMoney(Number(amount));
    if (!(value > 0)) return setError('Enter an amount more than zero.');
    if (value > customer.outstanding) return setError(`Amount can't be more than the ${formatCurrency(customer.outstanding)} due.`);
    if (!date) return setError('Choose the payment date.');
    setSaving(true);
    setError(null);
    try {
      await recordCustomerPayment(customer.sales.map(s => s.id), { amount: value, date, method, notes: notes.trim() });
      toast({ title: 'Payment recorded', description: `${formatCurrency(value)} from ${customer.name}, applied to the oldest bills first.` });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>{customer.name} owes {formatCurrency(customer.outstanding)}. The payment is applied to the oldest unpaid sales first.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="cust-pay-amount">Amount (Rs.)</Label>
            <Input id="cust-pay-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cust-pay-date">Date</Label>
              <Input id="cust-pay-date" type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={v => setMethod(v as PaymentMethod)}>
                <SelectTrigger aria-label="Payment method"><SelectValue /></SelectTrigger>
                <SelectContent>{paymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cust-pay-notes">Notes (optional)</Label>
            <Input id="cust-pay-notes" placeholder="Cheque no., UPI ref..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerLedger({ customer, sites, company, onBack }: { customer: CustomerSummary; sites: Site[]; company?: Company; onBack: () => void }) {
  const { toast } = useToast();
  const today = todayISO();
  const [period, setPeriod] = useState<Period>('all');
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);

  const from = period === 'all' ? null : period === 'fy' ? financialYearStart(today) : format(subDays(parseISO(today), 89), 'yyyy-MM-dd');
  const statement = useMemo(() => buildStatement(customer, sites, from, today), [customer, sites, from, today]);

  const makePdf = async () => {
    const logoDataUrl = await loadLogo(company?.logoUrl);
    const doc = buildStatementPdf({ customer, statement, companyName: company?.name || '', logoDataUrl });
    return { doc, name: statementFileName(customer, statement) };
  };

  const download = async () => {
    setBusy('download');
    try {
      const { doc, name } = await makePdf();
      doc.save(name);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Could not create the statement' });
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy('share');
    try {
      const { doc, name } = await makePdf();
      const due = statement.closingBalance;
      const result = await sharePdf(doc, name, due > 0
        ? `Account statement from ${company?.name || 'us'}. Amount due: ${formatCurrency(due)}.`
        : `Account statement from ${company?.name || 'us'}.`);
      if (result === 'downloaded') toast({ title: 'Downloaded instead', description: "This browser can't share files directly." });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Could not share the statement', description: 'Try Download instead.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2"><ArrowLeft className="mr-2 h-4 w-4" /> All customers</Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-bold">{customer.name}</h2>
          <p className="text-sm text-muted-foreground">
            {customer.internal ? 'Internal transfers to this site' : 'Customer'} · {customer.sales.length} sale{customer.sales.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {customer.outstanding > 0 && (
            <Button onClick={() => setPayOpen(true)}><IndianRupee className="mr-2 h-4 w-4" /> Record payment</Button>
          )}
          {canShareFiles() && (
            <Button variant="outline" onClick={share} disabled={!!busy}>
              {busy === 'share' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />} Share
            </Button>
          )}
          <Button variant="outline" onClick={download} disabled={!!busy}>
            {busy === 'download' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Statement PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total billed" value={formatCurrency(customer.billed)} />
        <Stat label="Received" value={formatCurrency(customer.received)} />
        <Stat label={customer.outstanding >= 0 ? 'Amount due' : 'Advance'} value={formatCurrency(Math.abs(customer.outstanding))} tone={customer.outstanding > 0 ? 'bad' : undefined} />
        <Stat label="Oldest unpaid" value={customer.oldestUnpaidDays === null ? 'Nothing due' : `${customer.oldestUnpaidDays} days`} tone={(customer.oldestUnpaidDays ?? 0) >= 30 ? 'warn' : undefined} />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-lg">Ledger</CardTitle>
            <CardDescription>Sales billed and payments received, with the running balance.</CardDescription>
          </div>
          <Select value={period} onValueChange={v => setPeriod(v as Period)}>
            <SelectTrigger className="w-[190px]" aria-label="Period"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="fy">This financial year</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Date</TableHead>
                <TableHead>Particulars</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statement.from && (
                <TableRow className="bg-muted/30">
                  <TableCell>{day(statement.from)}</TableCell>
                  <TableCell className="italic text-muted-foreground">Opening balance</TableCell>
                  <TableCell /><TableCell />
                  <TableCell className="text-right tabular-nums">{formatCurrency(statement.openingBalance)}</TableCell>
                </TableRow>
              )}
              {statement.entries.length === 0 && (
                <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">No sales or payments in this period.</TableCell></TableRow>
              )}
              {statement.entries.map((e, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-nowrap">{day(e.date)}</TableCell>
                  <TableCell>{e.particulars}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.debit ? formatCurrency(e.debit) : ''}</TableCell>
                  <TableCell className="text-right tabular-nums text-green-600">{e.credit ? formatCurrency(e.credit) : ''}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatCurrency(e.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">Total for period</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(statement.totalDebit)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(statement.totalCredit)}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{formatCurrency(statement.closingBalance)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <PaymentDialog customer={customer} open={payOpen} onOpenChange={setPayOpen} />
    </div>
  );
}

export function CustomersPage({ companyId, company, sites }: { companyId: string | null | undefined; company?: Company; sites: Site[] }) {
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [search, setSearch] = useState('');
  const [showInternal, setShowInternal] = useState(false);
  const [onlyDue, setOnlyDue] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const today = todayISO();

  useEffect(() => {
    setSales(null);
    return onGlobalCollectionSnapshot<Sale>('sales', companyId, setSales);
  }, [companyId]);

  const customers = useMemo(() => groupCustomers(sales ?? [], sites, today), [sales, sites, today]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(c =>
      (showInternal || !c.internal)
      && (!onlyDue || c.outstanding > 0.005)
      && (!q || c.name.toLowerCase().includes(q)));
  }, [customers, search, showInternal, onlyDue]);

  const external = customers.filter(c => !c.internal);
  const totalDue = roundMoney(external.reduce((s, c) => s + Math.max(0, c.outstanding), 0));
  const withDues = external.filter(c => c.outstanding > 0.005).length;
  const overdue = roundMoney(external.filter(c => (c.oldestUnpaidDays ?? 0) >= 30).reduce((s, c) => s + Math.max(0, c.outstanding), 0));

  const selected = customers.find(c => c.key === selectedKey);
  if (selected) {
    return <CustomerLedger customer={selected} sites={sites} company={company} onBack={() => setSelectedKey(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total due from customers" value={formatCurrency(totalDue)} tone={totalDue > 0 ? 'bad' : undefined} />
        <Stat label="Customers with dues" value={String(withDues)} />
        <Stat label="Due for 30+ days" value={formatCurrency(overdue)} tone={overdue > 0 ? 'warn' : undefined} />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5" /> Customers</CardTitle>
            <CardDescription>Everyone you've sold to, from every site. Buyers are matched by the name typed on the sale.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search customers" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" aria-label="Search customers" />
            </div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={onlyDue} onCheckedChange={setOnlyDue} /> Only with dues</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={showInternal} onCheckedChange={setShowInternal} /> Show transfers to own sites</label>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {sales === null ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Billed</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead>Oldest unpaid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {customers.length === 0 ? 'No sales yet. Sales logged at your manufacturing units will appear here by buyer.' : 'No customers match.'}
                    </TableCell>
                  </TableRow>
                )}
                {visible.map(c => (
                  <TableRow key={c.key} className="cursor-pointer" onClick={() => setSelectedKey(c.key)}>
                    <TableCell>
                      <button type="button" className="text-left font-medium hover:underline" onClick={() => setSelectedKey(c.key)}>{c.name}</button>
                      {c.internal && <Badge variant="outline" className="ml-2">Own site</Badge>}
                      {c.lastActivity && <p className="text-xs text-muted-foreground">Last activity {day(c.lastActivity)}</p>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.sales.length}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(c.billed)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(c.received)}</TableCell>
                    <TableCell className={cn('text-right font-semibold tabular-nums', c.outstanding > 0.005 ? 'text-red-600' : 'text-green-600')}>
                      {formatCurrency(c.outstanding)}
                    </TableCell>
                    <TableCell>
                      {c.oldestUnpaidDays === null ? <span className="text-muted-foreground">—</span>
                        : <Badge variant={c.oldestUnpaidDays >= 30 ? 'destructive' : 'secondary'}>{c.oldestUnpaidDays} days</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
