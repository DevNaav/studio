
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

interface DistributeFoodCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
}

export function DistributeFoodCostDialog({ open, onOpenChange }: DistributeFoodCostDialogProps) {
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      toast({
        title: 'Feature Removed',
        description: `Food cost distribution is no longer supported.`,
      });
      onOpenChange(false);
    }
  }, [open, onOpenChange, toast]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Distribute Food Cost</DialogTitle>
          <DialogDescription>
            This feature is no longer available.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
