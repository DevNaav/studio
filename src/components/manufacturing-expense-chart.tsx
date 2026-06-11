'use client';

import { useMemo } from 'react';
import { CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ChartConfig, ChartContainer } from '@/components/ui/chart';
import { Loader2, IndianRupee } from 'lucide-react';
import { Progress } from './ui/progress';
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from 'recharts';


interface ManufacturingExpenseChartProps {
    title: string;
    expenseData: { name: string; value: number }[];
    totalExpenses: number;
    isLoading: boolean;
    budget?: number;
}

const COLORS = {
  "Materials": "#3b82f6", // blue-500
  "Labor": "#16a34a", // green-600
  "Machine Costs": "#f97316", // orange-500
  "Other Expenses": "#6b7280", // gray-500
  "M15": "#ef4444", // red-500
  "dockeraccess": "#8b5cf6", // violet-500
  "Other": "#a1a1aa", // zinc-400
};

type ColorKeys = keyof typeof COLORS;

const CustomTooltip = ({ active, payload, totalExpenses }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const percentage = totalExpenses > 0 ? ((data.value / totalExpenses) * 100).toFixed(1) : 0;
    return (
      <div className="p-2 text-sm bg-background border rounded-md shadow-sm">
        <p className="font-bold">{`${data.name}`}</p>
        <p className="text-muted-foreground">{`Amount: ₹${data.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${percentage}%)`}</p>
      </div>
    );
  }
  return null;
};

export function ManufacturingExpenseChart({ title, expenseData, totalExpenses, isLoading, budget }: ManufacturingExpenseChartProps) {

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    if (expenseData) {
      expenseData.forEach((item, index) => {
          const colorKey = item.name as ColorKeys;
          config[item.name] = {
              label: item.name,
              color: COLORS[colorKey] || `hsl(var(--chart-${(index % 5) + 1}))`,
          };
      });
    }
    return config;
  }, [expenseData]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!expenseData || expenseData.length === 0) {
    return (
        <div className="flex flex-col text-left py-4">
            <CardDescription className="mt-2 text-sm">No expenses logged for this category.</CardDescription>
        </div>
    );
  }

  return (
    <div className="space-y-4">
        <div className="flex flex-col items-center gap-4">
            <div className="h-48 sm:h-56">
              <ChartContainer config={chartConfig} className="mx-auto aspect-square h-full">
                  <PieChart>
                      <Tooltip content={<CustomTooltip totalExpenses={totalExpenses} />} />
                      <Pie data={expenseData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={70} strokeWidth={2}>
                          {expenseData.map((entry, index) => (
                              <Cell key={`cell-${entry.name}`} fill={chartConfig[entry.name]?.color} name={entry.name}/>
                          ))}
                      </Pie>
                  </PieChart>
              </ChartContainer>
            </div>
             <div className="w-full space-y-2">
                <div className="text-center">
                    <p className="text-sm text-muted-foreground">TOTAL {title.toUpperCase()}</p>
                    <p className="text-3xl font-bold flex items-center justify-center">
                        <IndianRupee className="h-6 w-6 mr-1" />
                        {totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                </div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm">
                    {expenseData.map((entry) => (
                        <div key={entry.name} className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartConfig[entry.name]?.color }}></span>
                                <span className="truncate max-w-[120px]">{entry.name}</span>
                           </div>
                           <span className='font-mono'>₹{entry.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    {budget && budget > 0 && (
      <CardFooter className="flex-col items-start gap-2 pt-6 mt-4 border-t">
          <div className="flex w-full justify-between items-center">
              <p className="text-sm font-medium">PROJECT BUDGET</p>
              <p className="text-sm text-muted-foreground">
                  <span className="font-bold text-foreground">₹{totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span> of ₹{budget.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </p>
          </div>
          <Progress
              className="w-full h-2"
              value={(totalExpenses / budget) * 100}
          />
      </CardFooter>
      )}
    </div>
  );
}
