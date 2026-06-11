
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Ticket as TicketIcon, Send, LifeBuoy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Ticket, TicketStatus, UserProfile, ticketStatuses } from '@/lib/types';
import { addDocToGlobalCollection, onGlobalCollectionSnapshot, updateDocWithId } from '@/context/site-context';
import { format, parseISO } from 'date-fns';
import { UpdateTicketDialog } from './update-ticket-dialog';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ticketSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters long.'),
  description: z.string().min(20, 'Description must be at least 20 characters long.'),
});

interface SupportPageProps {
  userProfile: UserProfile;
}

export function SupportPage({ userProfile }: SupportPageProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const { toast } = useToast();
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (!userProfile.companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    let q;
    if (isAdmin) {
      // Admins see all tickets for their company
      q = query(collection(db, 'tickets'), where('companyId', '==', userProfile.companyId));
    } else {
      // Regular users only see their own tickets, sorted by creation date
      q = query(collection(db, 'tickets'), where('userId', '==', userProfile.uid), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ticketsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
      
      // Sort on the client-side to avoid needing a composite index for the admin query
      ticketsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setTickets(ticketsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile, isAdmin]);

  const form = useForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { subject: '', description: '' },
  });

  const onSubmit = async (values: z.infer<typeof ticketSchema>) => {
    if (!userProfile.companyId) {
      toast({ variant: 'destructive', title: 'Error', description: 'You are not associated with a company.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await addDocToGlobalCollection('tickets', userProfile.companyId, {
        userId: userProfile.uid,
        userName: userProfile.name,
        userEmail: userProfile.email,
        subject: values.subject,
        description: values.description,
        status: 'Open',
        createdAt: new Date().toISOString(),
      });
      toast({ title: 'Ticket Submitted', description: 'Our support team will get back to you shortly.' });
      form.reset();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not submit your ticket. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleUpdateTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsUpdateDialogOpen(true);
  };

  const getStatusVariant = (status: TicketStatus) => {
    switch (status) {
      case 'Open': return 'destructive';
      case 'In Progress': return 'secondary';
      case 'Closed': return 'default';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LifeBuoy />Support Center</CardTitle>
          <CardDescription>Submit a new support ticket or view the status of your existing tickets.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Unable to add new site" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Describe Your Issue</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Please provide as much detail as possible..." {...field} disabled={isSubmitting} rows={5} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Submit Ticket
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Your Tickets</CardTitle>
            <CardDescription>{isAdmin ? "Manage all support tickets for your company." : "Here are the tickets you've submitted."}</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Subject</TableHead>
                        {isAdmin && <TableHead>User</TableHead>}
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow><TableCell colSpan={isAdmin ? 5: 4} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                    ) : tickets.length > 0 ? (
                        tickets.map(ticket => (
                            <TableRow key={ticket.id} className="border-b-0">
                                <TableCell className="font-medium max-w-xs truncate">{ticket.subject}</TableCell>
                                {isAdmin && <TableCell>{ticket.userName} ({ticket.userEmail})</TableCell>}
                                <TableCell><Badge variant={getStatusVariant(ticket.status)}>{ticket.status}</Badge></TableCell>
                                <TableCell>{format(parseISO(ticket.createdAt), 'PPP p')}</TableCell>
                                {isAdmin && (
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => handleUpdateTicket(ticket)}>
                                            Update Status
                                        </Button>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow><TableCell colSpan={isAdmin ? 5: 4} className="h-24 text-center">No tickets found.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedTicket && (
        <UpdateTicketDialog 
            open={isUpdateDialogOpen}
            onOpenChange={setIsUpdateDialogOpen}
            ticket={selectedTicket}
        />
      )}
    </div>
  );
}
