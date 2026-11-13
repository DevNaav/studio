'use client';

/**
 * Bell in the app header listing everything that needs attention (low stock, EMIs due,
 * unpaid sales, expiring documents, ...). Free: it only reads data the app already has.
 * Data is fetched once and refreshed at most every few minutes when the bell is opened,
 * to stay well inside Firestore's free read quota.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { AlertTriangle, Bell, CheckCheck, CircleAlert, Info, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { computeAlerts, type AlertInputs, type AppAlert, type AlertTarget } from '@/lib/alerts';
import { todayISO, cn } from '@/lib/utils';
import type { Site, Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const REFRESH_AFTER_MS = 5 * 60 * 1000;

type FetchedData = Omit<AlertInputs, 'sites' | 'tasks' | 'today'>;

async function fetchCompany<T>(name: string, companyId: string): Promise<T[]> {
  const snap = await getDocs(query(collection(db, name), where('companyId', '==', companyId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as T).filter((d: any) => !d.isDeleted);
}

async function fetchAlertData(companyId: string, isAdmin: boolean): Promise<FetchedData> {
  // Admin-only pages' data is skipped for other roles (their alerts would lead nowhere).
  const adminOnly = <T,>(name: string) => (isAdmin ? fetchCompany<T>(name, companyId) : Promise.resolve([] as T[]));
  const [inventory, emiPayments, machines, sales, documents, warranties, liabilities, rentedMaterials] = await Promise.all([
    fetchCompany<FetchedData['inventory'][number]>('inventory', companyId),
    fetchCompany<FetchedData['emiPayments'][number]>('emi_payments', companyId),
    fetchCompany<FetchedData['machines'][number]>('machines', companyId),
    fetchCompany<FetchedData['sales'][number]>('sales', companyId),
    fetchCompany<FetchedData['documents'][number]>('documents', companyId),
    adminOnly<FetchedData['warranties'][number]>('warranties'),
    adminOnly<FetchedData['liabilities'][number]>('defect_liabilities'),
    fetchCompany<FetchedData['rentedMaterials'][number]>('rented_materials', companyId),
  ]);
  return { inventory, emiPayments, machines, sales, documents, warranties, liabilities, rentedMaterials };
}

function readSeen(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
}

const severityStyle = {
  critical: { icon: CircleAlert, className: 'text-red-500' },
  warning: { icon: AlertTriangle, className: 'text-amber-500' },
  info: { icon: Info, className: 'text-sky-500' },
} as const;

interface AlertsBellProps {
  companyId: string | null | undefined;
  userId: string;
  isAdmin: boolean;
  /** Sites this user can see (already filtered by role / assigned sites). */
  sites: Site[];
  /** Tasks are already loaded by the app header, so they're passed in instead of re-read. */
  tasks: Task[];
  onNavigate: (target: AlertTarget) => void;
}

export function AlertsBell({ companyId, userId, isAdmin, sites, tasks, onNavigate }: AlertsBellProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<FetchedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetch = useRef(0);
  const seenKey = `inventra-alerts-seen:${userId}:${companyId ?? 'none'}`;
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useEffect(() => setSeen(readSeen(seenKey)), [seenKey]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAlertData(companyId, isAdmin));
      lastFetch.current = Date.now();
    } catch (e) {
      console.error('Could not load alerts', e);
      setError('Could not load alerts. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [companyId, isAdmin]);

  // Load once per company; later refreshes happen when the bell is opened.
  useEffect(() => {
    setData(null);
    lastFetch.current = 0;
    load();
  }, [load]);

  useEffect(() => {
    if (open && Date.now() - lastFetch.current > REFRESH_AFTER_MS) load();
  }, [open, load]);

  const alerts = useMemo<AppAlert[]>(() => {
    if (!data) return [];
    const all = computeAlerts({ ...data, sites, tasks, today: todayISO() });
    return isAdmin ? all : all.filter(a => !a.adminOnly);
  }, [data, sites, tasks, isAdmin]);

  const unseen = alerts.filter(a => !seen.has(a.id));

  const markAllSeen = () => {
    const ids = new Set(alerts.map(a => a.id)); // drops ids of alerts that no longer exist
    setSeen(ids);
    try {
      localStorage.setItem(seenKey, JSON.stringify([...ids]));
    } catch {
      /* private mode: reading state just isn't remembered */
    }
  };

  if (!companyId) return null;

  const badge = unseen.length;
  const badgeIsCritical = unseen.some(a => a.severity === 'critical');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={badge ? `Alerts, ${badge} new` : 'Alerts'}>
          <Bell className="h-5 w-5" />
          {badge > 0 && (
            <span
              className={cn(
                'absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white',
                badgeIsCritical ? 'bg-red-500' : 'bg-amber-500',
              )}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="font-semibold">Alerts</p>
            <p className="text-xs text-muted-foreground">
              {alerts.length === 0 ? 'Nothing needs attention' : `${alerts.length} need${alerts.length === 1 ? 's' : ''} attention`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {unseen.length > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllSeen} className="h-8 text-xs">
                <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all read
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {error && <p className="px-4 py-3 text-sm text-destructive">{error}</p>}
          {!error && !data && loading && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Checking…</p>}
          {data && alerts.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">All clear. You'll see low stock, EMIs due, unpaid sales and expiring documents here.</p>
          )}
          <ul>
            {alerts.map(alert => {
              const { icon: Icon, className } = severityStyle[alert.severity];
              const isNew = !seen.has(alert.id);
              return (
                <li key={alert.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onNavigate(alert.target);
                    }}
                    className={cn(
                      'flex w-full gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
                      isNew && 'bg-muted/30',
                    )}
                  >
                    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', className)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium leading-snug">{alert.title}</span>
                        {isNew && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="new" />}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{alert.detail}</span>
                      <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground/80">{alert.category}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
