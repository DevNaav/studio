
'use client';

import { useEffect } from 'react';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Ticket, TicketStatus, ticketStatuses } from '@/lib/types';
import { updateDocWithId } from '@/context/site-context';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

const formSchema = z.object({
  status: z.enum(ticketStatuses),
});

interface UpdateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket;
}

export function UpdateTicketDialog({ open, onOpenChange, ticket }: UpdateTicketDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: ticket.status,
    },
  });

  useEffect(() => {
    if (ticket) {
      form.reset({
        status: ticket.status,
      });
    }
  }, [ticket, form, open]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      await updateDocWithId('tickets', ticket.id, { status: values.status });
      toast({ title: 'Ticket Updated', description: `Ticket status changed to "${values.status}".` });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update ticket:", error);
      toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update the ticket status.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Ticket Status</DialogTitle>
          <DialogDescription>
            Change the status for the ticket: "{ticket.subject}"
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="space-y-1">
                <h4 className="font-medium text-sm">User</h4>
                <p className="text-sm text-muted-foreground">{ticket.userName} ({ticket.userEmail})</p>
            </div>
             <div className="space-y-1">
                <h4 className="font-medium text-sm">Issue Description</h4>
                <div className="text-sm text-muted-foreground p-3 bg-secondary/50 rounded-md border">{ticket.description}</div>
            </div>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ticketStatuses.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
