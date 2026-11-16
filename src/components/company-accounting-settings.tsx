'use client';

/**
 * Company-wide accounting choices (admins): how food given to workers is treated, and
 * which labour figure drives site totals and budgets. Saved on the company document.
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { FoodCostMode, LaborCostBasis } from '@/lib/types';
import { updateDocWithId, useSite } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function Choice<T extends string>({ value, current, onPick, title, text, disabled }: {
  value: T; current: T; onPick: (v: T) => void; title: string; text: string; disabled?: boolean;
}) {
  const selected = value === current;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={() => onPick(value)}
      className={cn(
        'w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-60',
        selected && 'border-primary ring-2 ring-primary',
      )}
    >
      <span className="flex items-center gap-2 font-medium">
        <span className={cn('h-3.5 w-3.5 shrink-0 rounded-full border-2', selected ? 'border-primary bg-primary' : 'border-muted-foreground/50')} />
        {title}
      </span>
      <span className="mt-1 block pl-[22px] text-xs text-muted-foreground">{text}</span>
    </button>
  );
}

export function CompanyAccountingSettings() {
  const { userProfile } = useAuth();
  const { allCompanies } = useSite();
  const { toast } = useToast();
  const company = allCompanies.find(c => c.id === userProfile?.companyId);
  const [saving, setSaving] = useState<string | null>(null);
  if (!company) return null;

  const food: FoodCostMode = company.foodCostMode ?? 'company';
  const basis: LaborCostBasis = company.laborCostBasis ?? 'earned';

  const save = async (field: 'foodCostMode' | 'laborCostBasis', value: string) => {
    if ((field === 'foodCostMode' ? food : basis) === value) return;
    setSaving(field);
    try {
      await updateDocWithId('companies', company.id, { [field]: value });
      toast({ title: 'Setting saved', description: 'All totals, balances and payslips now use it.' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Could not save the setting' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Accounting</h3>
        <p className="text-sm text-muted-foreground">How your company counts worker costs. These apply to every site.</p>
      </div>

      <div className="space-y-2" role="radiogroup" aria-label="Food given to workers">
        <p className="flex items-center gap-2 text-sm font-medium">Food given to workers {saving === 'foodCostMode' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice value="company" current={food} onPick={v => save('foodCostMode', v)} disabled={!!saving}
            title="Company pays" text="Food is a site expense. Workers are still owed their full wages." />
          <Choice value="deduct" current={food} onPick={v => save('foodCostMode', v)} disabled={!!saving}
            title="Cut from wages" text="Food is taken off what each worker is owed, and shown on their payslip." />
        </div>
      </div>

      <div className="space-y-2" role="radiogroup" aria-label="Labour cost in totals and budgets">
        <p className="flex items-center gap-2 text-sm font-medium">Labour cost in site totals and budgets {saving === 'laborCostBasis' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Choice value="earned" current={basis} onPick={v => save('laborCostBasis', v)} disabled={!!saving}
            title="Wages earned" text="The true cost: everything workers have earned, paid or not." />
          <Choice value="paid" current={basis} onPick={v => save('laborCostBasis', v)} disabled={!!saving}
            title="Wages paid" text="Cash only: what has actually been paid to workers so far." />
        </div>
        <p className="text-xs text-muted-foreground">Either way, site pages show wages earned, paid and still owed side by side.</p>
      </div>
    </div>
  );
}
