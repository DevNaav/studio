'use client';

/** Pick a date and download or share that day's site report as a PDF. */
import { useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { CalendarDays, Download, Loader2, Share2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { getSubCollection, useSite } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { buildDailyReport, buildDailyReportPdf, type DailyReport } from '@/lib/daily-report';
import { canShareFiles, sharePdf } from '@/lib/pdf-share';
import { formatCurrency, todayISO } from '@/lib/utils';
import type { Site } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

async function companyDocs<T>(name: string, companyId: string): Promise<T[]> {
  const snap = await getDocs(query(collection(db, name), where('companyId', '==', companyId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as T).filter((d: any) => !d.isDeleted);
}

async function loadReport(site: Site, date: string): Promise<DailyReport> {
  const c = site.companyId;
  const [labors, attendances, workLogs, transactions, inventory, expenses, tasks, thefts, fuelLogs, machines, machineAttendances] = await Promise.all([
    companyDocs<any>('labors', c).then(l => l.filter((x: any) => x.siteId === site.id)),
    getSubCollection<any>('attendances', c, site.id),
    getSubCollection<any>('work_logs', c, site.id),
    getSubCollection<any>('labor_transactions', c, site.id),
    getSubCollection<any>('inventory', c, site.id),
    getSubCollection<any>('expenses', c, site.id),
    getSubCollection<any>('tasks', c, site.id),
    getSubCollection<any>('thefts', c, site.id),
    companyDocs<any>('fuel_logs', c),
    companyDocs<any>('machines', c),
    companyDocs<any>('machine_attendances', c),
  ]);
  return buildDailyReport({ date, siteId: site.id, labors, attendances, workLogs, transactions, inventory, expenses, tasks, thefts, fuelLogs, machines, machineAttendances });
}

export function DailyReportDialog({ site }: { site: Site }) {
  const { toast } = useToast();
  const { allCompanies } = useSite();
  const company = allCompanies.find(c => c.id === site.companyId);
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [busy, setBusy] = useState<'load' | 'download' | 'share' | null>(null);

  const refresh = async (d: string) => {
    setBusy('load');
    try {
      setReport(await loadReport(site, d));
    } catch (e) {
      console.error('Daily report failed', e);
      toast({ variant: 'destructive', title: 'Could not load the day', description: 'Please try again.' });
      setReport(null);
    } finally {
      setBusy(null);
    }
  };

  const fileName = `Daily-Report-${site.name.replace(/[^a-z0-9]+/gi, '-')}-${date}.pdf`;
  const run = async (kind: 'download' | 'share') => {
    if (!report) return;
    setBusy(kind);
    try {
      const doc = buildDailyReportPdf(report, site.name, company?.name || '', userProfile?.name || undefined);
      if (kind === 'download') doc.save(fileName);
      else if ((await sharePdf(doc, fileName, `Daily report: ${site.name}, ${date}`)) === 'downloaded') {
        toast({ title: 'Downloaded instead', description: "This browser can't share files directly." });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Could not create the report' });
    } finally {
      setBusy(null);
    }
  };

  const c = report?.attendanceCounts;
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) refresh(date); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><CalendarDays className="mr-2 h-4 w-4" /> Daily Report</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Daily site report</DialogTitle>
          <DialogDescription>Attendance, work, materials, expenses, payments, machines and tasks at {site.name} for one day.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="daily-report-date">Date</Label>
          <Input id="daily-report-date" type="date" value={date} max={todayISO()}
            onChange={e => { setDate(e.target.value); if (e.target.value) refresh(e.target.value); }} />
        </div>
        <div className="rounded-lg border p-3 text-sm">
          {busy === 'load' || !report ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading the day…</div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">Attendance</span><span>{c!.present} present, {c!.halfDay} half, {c!.absent} absent{c!.notMarked ? `, ${c!.notMarked} not marked` : ''}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Work entries</span><span>{report.work.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Material entries</span><span>{report.materials.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Expenses</span><span>{report.expenses.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Payments to workers</span><span>{report.payments.length}</span></div>
              <div className="flex justify-between border-t pt-1.5 font-semibold"><span>Spent this day</span><span className="tabular-nums">{formatCurrency(report.totals.spentToday)}</span></div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {canShareFiles() && (
            <Button variant="outline" onClick={() => run('share')} disabled={!report || !!busy}>
              {busy === 'share' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />} Share
            </Button>
          )}
          <Button onClick={() => run('download')} disabled={!report || !!busy}>
            {busy === 'download' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
