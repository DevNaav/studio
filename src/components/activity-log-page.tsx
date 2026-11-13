'use client';

/** Activity log page (admins): who added, changed or deleted what, newest first. */
import { useEffect, useMemo, useState } from 'react';
import {
  collection, getDocs, limit, onSnapshot, orderBy, query, startAfter, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import { ChevronDown, History, Loader2, Search } from 'lucide-react';
import { db } from '@/lib/firebase';
import { entityName, type ActivityEntry } from '@/lib/activity-log';
import type { Site } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PAGE = 50;

const actionStyle: Record<string, { label: string; className: string }> = {
  create: { label: 'Added', className: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  update: { label: 'Edited', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' },
  delete: { label: 'Deleted', className: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  restore: { label: 'Restored', className: 'bg-violet-500/15 text-violet-700 dark:text-violet-400' },
  payment: { label: 'Payment', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  other: { label: 'Changed', className: 'bg-muted text-muted-foreground' },
};

const SITE_FIELDS = new Set(['siteId', 'assignedSiteId', 'destinationSiteId']);
const fieldLabel = (f: string) => f.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());

function toDate(at: any): Date | null {
  return typeof at?.toDate === 'function' ? at.toDate() : null;
}

export function ActivityLogPage({ companyId, sites }: { companyId: string | null | undefined; sites: Site[] }) {
  const [latest, setLatest] = useState<ActivityEntry[] | null>(null);
  const [older, setOlder] = useState<ActivityEntry[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [personFilter, setPersonFilter] = useState('all');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const siteName = useMemo(() => new Map(sites.map(s => [s.id, s.name])), [sites]);

  // Newest page stays live, so new actions appear without refreshing.
  useEffect(() => {
    if (!companyId) return;
    setLatest(null);
    setOlder([]);
    setError(null);
    const q = query(collection(db, 'companies', companyId, 'activity'), orderBy('at', 'desc'), limit(PAGE));
    return onSnapshot(
      q,
      snap => {
        setLatest(snap.docs.map(d => ({ id: d.id, ...d.data() }) as ActivityEntry));
        setCursor(prev => prev ?? snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(snap.docs.length === PAGE);
      },
      err => {
        console.error('Activity log failed to load', err);
        setError('Could not load the activity log.');
        setLatest([]);
      },
    );
  }, [companyId]);

  const loadMore = async () => {
    if (!companyId || !cursor) return;
    setLoadingMore(true);
    try {
      const snap = await getDocs(query(collection(db, 'companies', companyId, 'activity'), orderBy('at', 'desc'), startAfter(cursor), limit(PAGE)));
      setOlder(prev => [...prev, ...snap.docs.map(d => ({ id: d.id, ...d.data() }) as ActivityEntry)]);
      setCursor(snap.docs[snap.docs.length - 1] ?? cursor);
      setHasMore(snap.docs.length === PAGE);
    } finally {
      setLoadingMore(false);
    }
  };

  const all = useMemo(() => {
    const seen = new Set<string>();
    return [...(latest ?? []), ...older].filter(e => (e.id && !seen.has(e.id) ? (seen.add(e.id), true) : false));
  }, [latest, older]);

  const people = useMemo(() => [...new Map(all.map(e => [e.actorUid, e.actorName])).entries()], [all]);

  const visible = all.filter(e => {
    if (actionFilter !== 'all' && e.action !== actionFilter) return false;
    if (personFilter !== 'all' && e.actorUid !== personFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [e.summary, e.actorName, e.label, siteName.get(e.siteId || '')].some(t => t?.toLowerCase().includes(q));
  });

  const toggle = (id: string) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const show = (field: string, v: string | number | boolean | null) => {
    if (v === null || v === '') return '—';
    if (SITE_FIELDS.has(field) && typeof v === 'string') return siteName.get(v) ?? (v === 'main' ? 'Warehouse' : v);
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg"><History className="h-5 w-5" /> Activity log</CardTitle>
          <CardDescription>
            Who added, changed or deleted what. Entries can't be edited or removed by anyone, so this is a reliable record.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search activity" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" aria-label="Search activity" />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[150px]" aria-label="Type of action"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {Object.entries(actionStyle).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={personFilter} onValueChange={setPersonFilter}>
            <SelectTrigger className="w-[180px]" aria-label="Person"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              {people.map(([uid, name]) => <SelectItem key={uid} value={uid}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {latest === null ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">{error}</p>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {all.length === 0 ? 'Nothing recorded yet. From now on, every change your team makes will show up here.' : 'No activity matches.'}
          </p>
        ) : (
          <ul className="divide-y">
            {visible.map(e => {
              const when = toDate(e.at);
              const style = actionStyle[e.action] ?? actionStyle.other;
              const hasChanges = !!e.changes?.length;
              const isOpen = open.has(e.id!);
              return (
                <li key={e.id} className="py-3">
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                    <span className={cn('mt-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', style.className)}>{style.label}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium [overflow-wrap:anywhere]">{e.summary}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">{e.actorName}</span>
                        <span> · {e.actorRole}</span>
                        {e.siteId && siteName.get(e.siteId) && <span> · {siteName.get(e.siteId)}</span>}
                        <span> · {entityName(e.entity)}</span>
                      </p>
                    </div>
                    <time className="text-xs text-muted-foreground" dateTime={when?.toISOString()} title={when ? format(when, 'dd MMM yyyy, hh:mm:ss a') : ''}>
                      {/* The server's clock can be a little ahead of the device's: never show "in 1 minute". */}
                      {when ? `${when.getTime() > Date.now() - 30_000 ? 'just now' : formatDistanceToNow(when, { addSuffix: true })} · ${format(when, 'dd MMM, hh:mm a')}` : 'just now'}
                    </time>
                  </div>
                  {hasChanges && (
                    <div className="mt-2 pl-0 sm:pl-[72px]">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => toggle(e.id!)} aria-expanded={isOpen}>
                        <ChevronDown className={cn('mr-1 h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
                        {isOpen ? 'Hide changes' : `Show ${e.changes!.length} change${e.changes!.length === 1 ? '' : 's'}`}
                      </Button>
                      {isOpen && (
                        <div className="mt-1 overflow-x-auto rounded-md border">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50 text-muted-foreground">
                              <tr><th className="px-2 py-1.5 text-left font-medium">Field</th><th className="px-2 py-1.5 text-left font-medium">Before</th><th className="px-2 py-1.5 text-left font-medium">After</th></tr>
                            </thead>
                            <tbody>
                              {e.changes!.map(c => (
                                <tr key={c.field} className="border-t">
                                  <td className="px-2 py-1.5 font-medium">{fieldLabel(c.field)}</td>
                                  <td className="px-2 py-1.5 text-red-700 line-through decoration-red-400/60 dark:text-red-400 [overflow-wrap:anywhere]">{show(c.field, c.from)}</td>
                                  <td className="px-2 py-1.5 text-green-700 dark:text-green-400 [overflow-wrap:anywhere]">{show(c.field, c.to)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {hasMore && !error && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
              {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load older activity
            </Button>
          </div>
        )}
        {(search || actionFilter !== 'all' || personFilter !== 'all') && hasMore && (
          <p className="mt-2 text-center text-xs text-muted-foreground">Filters only search what's loaded. Load older activity to search further back.</p>
        )}
      </CardContent>
    </Card>
  );
}
