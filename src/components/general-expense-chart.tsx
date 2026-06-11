
'use client';

import { useEffect, useState, useMemo } from 'react';
import { MaintenanceLog, FuelLog } from '@/lib/types';
import { onGlobalCollectionSnapshot } from '@/context/site-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';
import { Loader2, Wrench } from 'lucide-react';
import { ExpenseBreakdownChart } from './expense-breakdown-chart';

export function GeneralExpenseChart() {
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  useEffect(() => {
    if (!userProfile?.companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let maintenanceLoaded = false;
    let fuelLoaded = false;

    const checkLoading = () => {
      if (maintenanceLoaded && fuelLoaded) {
        setLoading(false);
      }
    };

    const unsubMaintenance = onGlobalCollectionSnapshot<MaintenanceLog>('maintenance_logs', userProfile.companyId, (logs) => {
        setMaintenanceLogs(logs.filter(log => log.costAllocation === 'General Expenses' && !log.isDeleted));
        maintenanceLoaded = true;
        checkLoading();
    });

    const unsubFuel = onGlobalCollectionSnapshot<FuelLog>('fuel_logs', userProfile.companyId, (logs) => {
        // Only include fuel logs not assigned to a specific site
        setFuelLogs(logs.filter(log => !log.siteId && !log.isDeleted));
        fuelLoaded = true;
        checkLoading();
    });
    
    return () => {
      unsubMaintenance();
      unsubFuel();
    };
  }, [userProfile?.companyId]);
  
  const expenseData = useMemo(() => {
    const totalMaintenanceCost = maintenanceLogs.reduce((acc, log) => acc + (log.cost || 0), 0);
    const totalFuelCost = fuelLogs.reduce((acc, log) => acc + (log.cost || 0), 0);

    const data = [];
    if (totalMaintenanceCost > 0) data.push({ name: 'Maintenance', value: totalMaintenanceCost });
    if (totalFuelCost > 0) data.push({ name: 'Fuel', value: totalFuelCost });
    
    return data;
  }, [maintenanceLogs, fuelLogs]);

  const totalExpenses = useMemo(() => {
    return expenseData.reduce((acc, item) => acc + item.value, 0);
  }, [expenseData]);

  return (
     <Card className="tw-neon">
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wrench /> General Company Expenses</CardTitle>
            <CardDescription>Breakdown of expenses not tied to a specific site.</CardDescription>
        </CardHeader>
        <CardContent>
             <ExpenseBreakdownChart
                title="General Expenses"
                expenseData={expenseData}
                totalExpenses={totalExpenses}
                isLoading={loading}
             />
        </CardContent>
    </Card>
  );
}
