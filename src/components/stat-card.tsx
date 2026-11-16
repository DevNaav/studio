'use client';

/** A key-number card used on the Dashboard and Analysis pages. */
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const STAT_TONES = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
} as const;

export function StatCard({ title, value, icon: Icon, description, tone = 'blue', onClick, className }: {
  title: string;
  value: string;
  icon: React.ElementType;
  description?: string;
  tone?: keyof typeof STAT_TONES;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Card className={cn('tw-neon rounded-xl', onClick && 'cursor-pointer', className)} onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', STAT_TONES[tone])}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        </div>
        <p className="mt-2 truncate text-2xl font-bold tracking-tight tabular-nums sm:text-[26px]">{value}</p>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}
