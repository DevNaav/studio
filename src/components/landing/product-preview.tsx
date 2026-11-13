/**
 * An illustrative, code-drawn preview of the Inventra dashboard (no screenshot
 * needed): stat cards, a monthly expense chart and site progress.
 */
import { Building2, HardHat, IndianRupee, ListTodo, TrendingUp } from 'lucide-react';

const KPIS = [
  { icon: Building2, label: 'Active projects', value: '6', tone: 'text-sky-600 dark:text-sky-300' },
  { icon: HardHat, label: 'Workforce', value: '128', tone: 'text-emerald-600 dark:text-emerald-300' },
  { icon: IndianRupee, label: 'Spent this month', value: '₹12.4L', tone: 'text-amber-600 dark:text-amber-300' },
  { icon: ListTodo, label: 'Tasks due today', value: '9', tone: 'text-purple-600 dark:text-purple-300' },
];

const BARS = [42, 55, 38, 64, 58, 72, 49, 81, 67, 76, 60, 88];
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const SITES = [
  { name: 'Riverside Towers', type: 'Construction', progress: 72 },
  { name: 'Green Valley Villas', type: 'Construction', progress: 45 },
  { name: 'Unit 2 — Precast Plant', type: 'Manufacturing', progress: 88 },
];

export function ProductPreview() {
  return (
    <div className="relative rounded-2xl bg-gradient-to-b from-ink/15 to-ink/[0.03] p-px shadow-2xl shadow-sky-950/60">
      <div className="overflow-hidden rounded-2xl bg-surface">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-ink/5 bg-ink/[0.03] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-400/80" />
          <span className="h-3 w-3 rounded-full bg-amber-400/80" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          <div className="ml-3 hidden h-6 flex-1 items-center rounded-md bg-ink/5 px-3 text-[11px] text-ink/40 sm:flex">
            app.inventra.in/dashboard
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[180px_1fr]">
          {/* Sidebar */}
          <aside className="hidden flex-col gap-1 text-xs text-ink/50 lg:flex">
            {['Dashboard', 'Sites', 'Labor', 'Inventory', 'Machines', 'Warehouse', 'Reports', 'AI Assistant'].map((item, i) => (
              <span key={item} className={i === 0 ? 'rounded-lg bg-sky-500/15 px-3 py-2 font-medium text-sky-200' : 'px-3 py-2'}>
                {item}
              </span>
            ))}
          </aside>

          <div className="min-w-0 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {KPIS.map(({ icon: Icon, label, value, tone }) => (
                <div key={label} className="rounded-xl bg-ink/[0.04] p-3 ring-1 ring-ink/5">
                  <Icon className={`h-4 w-4 ${tone}`} />
                  <p className="mt-2 text-lg font-bold text-ink sm:text-xl">{value}</p>
                  <p className="text-[11px] text-ink/45">{label}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-5">
              <div className="rounded-xl bg-ink/[0.04] p-4 ring-1 ring-ink/5 md:col-span-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-medium text-ink/70">Monthly expenses</p>
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-300"><TrendingUp className="h-3 w-3" /> on budget</span>
                </div>
                <div className="flex h-28 items-end gap-1.5">
                  {BARS.map((h, i) => (
                    <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <div
                        className="w-full rounded-t-sm bg-gradient-to-t from-sky-600/70 to-sky-300/90"
                        style={{ height: `${h}%` }}
                      />
                      <span className="text-[9px] text-ink/30">{MONTHS[i]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-xl bg-ink/[0.04] p-4 ring-1 ring-ink/5 md:col-span-2">
                <p className="text-xs font-medium text-ink/70">Site progress</p>
                {SITES.map((s) => (
                  <div key={s.name}>
                    <div className="flex justify-between text-[11px]">
                      <span className="truncate text-ink/80">{s.name}</span>
                      <span className="text-ink/45">{s.progress}%</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-ink/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-purple-500" style={{ width: `${s.progress}%` }} />
                    </div>
                    <p className="mt-0.5 text-[10px] text-ink/35">{s.type}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
