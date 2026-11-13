'use client';

/**
 * Pick a month, preview a worker's payslip, then download it as a PDF or share it
 * (on phones the share sheet can send it straight to WhatsApp, at no cost).
 */
import { useEffect, useMemo, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { Download, FileText, Loader2, Share2 } from 'lucide-react';
import type { Attendance, Labor, LaborTransaction, WorkLog } from '@/lib/types';
import { buildPayslip } from '@/lib/payslip';
import { buildPayslipPdf, payslipFileName } from '@/lib/payslip-pdf';
import { formatCurrency, todayISO } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PayslipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labor: Labor | null;
  siteName: string;
  companyName: string;
  logoUrl?: string;
  attendances: Attendance[];
  workLogs: WorkLog[];
  transactions: LaborTransaction[];
}

/** Loads the company logo as a data: URL for the PDF; returns null if it can't. */
async function loadLogo(url?: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!/^image\/(png|jpe?g)$/.test(blob.type)) return null; // the PDF library only embeds PNG/JPEG
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-1.5 text-sm ${strong ? 'font-semibold' : ''}`}>
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function PayslipDialog({ open, onOpenChange, labor, siteName, companyName, logoUrl, attendances, workLogs, transactions }: PayslipDialogProps) {
  const { toast } = useToast();
  const today = todayISO();
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(new Date(), i);
      return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
    }),
    [],
  );
  const [month, setMonth] = useState(months[0].value);
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);
  const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  useEffect(() => {
    if (open) setMonth(months[0].value);
  }, [open, months]);

  const payslip = useMemo(
    () => (labor ? buildPayslip({ labor, month, today, attendances, workLogs, transactions }) : null),
    [labor, month, today, attendances, workLogs, transactions],
  );

  const makeFile = async () => {
    if (!labor || !payslip) throw new Error('No worker selected.');
    const logoDataUrl = await loadLogo(logoUrl);
    const doc = buildPayslipPdf({ payslip, labor, companyName, siteName, logoDataUrl });
    const name = payslipFileName(labor, payslip);
    return { doc, name, file: new File([doc.output('blob')], name, { type: 'application/pdf' }) };
  };

  const handleDownload = async () => {
    setBusy('download');
    try {
      const { doc, name } = await makeFile();
      doc.save(name);
    } catch (e) {
      console.error('Payslip PDF failed', e);
      toast({ variant: 'destructive', title: 'Could not create the payslip', description: 'Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    setBusy('share');
    try {
      const { doc, name, file } = await makeFile();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name, text: `Payslip for ${labor?.name}, ${payslip?.monthLabel}` });
      } else {
        doc.save(name); // this browser can't share files: download instead
        toast({ title: 'Downloaded instead', description: "This browser can't share files directly. The PDF was downloaded." });
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('Payslip share failed', e);
        toast({ variant: 'destructive', title: 'Could not share the payslip', description: 'Try Download instead.' });
      }
    } finally {
      setBusy(null);
    }
  };

  const owed = payslip?.closingBalance ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Payslip</DialogTitle>
          <DialogDescription>{labor ? `${labor.name} · ${labor.role || labor.wageType}` : ''}</DialogDescription>
        </DialogHeader>

        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger aria-label="Month"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {payslip && (
          <div className="rounded-lg border p-3">
            {payslip.notEmployed && (
              <p className="pb-2 text-sm text-amber-600">This worker hadn't joined yet in {payslip.monthLabel}.</p>
            )}
            {payslip.attendance && (
              <Row
                label="Payable days"
                value={`${payslip.attendance.payableDays} (${payslip.attendance.present} present, ${payslip.attendance.halfDays} half, ${payslip.attendance.absent} absent)`}
              />
            )}
            {payslip.wageType === 'Contract' && <Row label="Work entries" value={String(payslip.workLines.length)} />}
            <Row label={payslip.broughtForward >= 0 ? 'From earlier months' : 'Advance from earlier'} value={formatCurrency(payslip.broughtForward)} />
            <Row label={`Earned${payslip.isRunningMonth ? ' so far' : ''}`} value={formatCurrency(payslip.earned)} />
            <Row label="Paid this month" value={`- ${formatCurrency(payslip.paid)}`} />
            <div className="mt-1 border-t pt-1">
              <Row strong label={owed >= 0 ? 'Balance due to worker' : 'Advance (worker owes)'} value={formatCurrency(Math.abs(owed))} />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {canShareFiles && (
            <Button variant="outline" onClick={handleShare} disabled={!payslip || !!busy}>
              {busy === 'share' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
              Share
            </Button>
          )}
          <Button onClick={handleDownload} disabled={!payslip || !!busy}>
            {busy === 'download' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
