'use client';

/** Settings section (company admins): download every record of the company as one file. */
import { useState } from 'react';
import { DatabaseBackup, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { backupFileName, exportCompanyData } from '@/lib/backup';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

const LAST_KEY = 'inventra-last-backup';

export function BackupSection() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [progress, setProgress] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(() => {
    try { return localStorage.getItem(LAST_KEY); } catch { return null; }
  });
  const companyId = userProfile?.companyId;
  if (!companyId) return null;

  const download = async () => {
    setProgress('Starting…');
    try {
      const backup = await exportCompanyData(db, companyId, (done, total) => setProgress(`${Math.round((done / total) * 100)}%`));
      const records = Object.values(backup.counts).reduce((a, b) => a + b, 0);
      const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName(backup);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      const when = new Date().toLocaleString('en-IN');
      try { localStorage.setItem(LAST_KEY, when); } catch { /* private mode */ }
      setLast(when);
      toast({ title: 'Backup downloaded', description: `${records.toLocaleString('en-IN')} records saved. Keep the file somewhere safe (Google Drive, email to yourself).` });
    } catch (e) {
      console.error('Backup failed', e);
      toast({ variant: 'destructive', title: 'Backup failed', description: 'Please check your connection and try again.' });
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Backup</h3>
        <p className="text-sm text-muted-foreground">
          Download every record of your company (sites, stock, workers, attendance, payments, machines, sales, customers, activity log…) as one file.
          Uploaded files like PDFs and photos stay stored online; the backup keeps their links.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">{last ? `Last downloaded on this device: ${last}` : 'No backup downloaded on this device yet.'}</p>
        <Button onClick={download} disabled={!!progress}>
          {progress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseBackup className="mr-2 h-4 w-4" />}
          {progress ? `Preparing ${progress}` : 'Download backup'}
        </Button>
      </div>
    </div>
  );
}
