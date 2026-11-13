
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
import { addDocToGlobalCollection, updateDocWithId } from '@/context/site-context';
import { format, parseISO } from 'date-fns';
import { UpdateTicketDialog } from './update-ticket-dialog';
import { collection, query, where, onSnapshot, Query } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/lib/firebase';

const ticketSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters long.'),
  description: z.string().min(20, 'Description must be at least 20 characters long.'),
});

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  company?: string;
  subject: string;
  reason?: string;
  message: string;
  status: 'New' | 'Read' | 'Replied';
  createdAt: string;
}
const contactStatuses: ContactMessage['status'][] = ['New', 'Read', 'Replied'];

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
  const { isAdmin, isSuperAdmin } = useAuth();
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);

  useEffect(() => {
    let q: Query;
    if (isSuperAdmin) {
      // Inventra support (SuperAdmin) sees every company's tickets.
      q = query(collection(db, 'tickets'));
    } else if (!userProfile.companyId) {
      setLoading(false);
      return;
    } else if (isAdmin) {
      // Company admins see all tickets for their company
      q = query(collection(db, 'tickets'), where('companyId', '==', userProfile.companyId));
    } else {
      // Regular users only see their own tickets (sorted below, so no composite index is needed)
      q = query(collection(db, 'tickets'), where('userId', '==', userProfile.uid));
    }
    setLoading(true);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ticketsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
      
      // Sort on the client-side to avoid needing a composite index for the admin query
      ticketsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setTickets(ticketsData);
      setLoading(false);
    }, (error) => {
      console.error('Failed to load tickets:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile, isAdmin, isSuperAdmin]);

  // Messages from the public contact form — SuperAdmin only.
  useEffect(() => {
    if (!isSuperAdmin) return;
    return onSnapshot(collection(db, 'contact_messages'), (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ContactMessage));
      msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setContactMessages(msgs);
    }, (error) => console.error('Failed to load contact messages:', error));
  }, [isSuperAdmin]);

  const updateContactStatus = async (id: string, status: ContactMessage['status']) => {
    try {
      await updateDocWithId('contact_messages', id, { status });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update the message.' });
    }
  };

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
      {!isSuperAdmin && (
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
      )}

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">{isSuperAdmin && <LifeBuoy />}{isSuperAdmin ? 'Support Inbox' : 'Your Tickets'}</CardTitle>
            <CardDescription>{isSuperAdmin ? "Tickets from all companies. Update the status as you work on them." : isAdmin ? "All support tickets raised by your company." : "Here are the tickets you've submitted."}</CardDescription>
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
                        {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow><TableCell colSpan={isSuperAdmin ? 5 : isAdmin ? 4 : 3} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                    ) : tickets.length > 0 ? (
                        tickets.map(ticket => (
                            <TableRow key={ticket.id} className="border-b-0">
                                <TableCell className="font-medium max-w-xs truncate">{ticket.subject}</TableCell>
                                {isAdmin && <TableCell>{ticket.userName} ({ticket.userEmail})</TableCell>}
                                <TableCell><Badge variant={getStatusVariant(ticket.status)}>{ticket.status}</Badge></TableCell>
                                <TableCell>{format(parseISO(ticket.createdAt), 'PPP p')}</TableCell>
                                {isSuperAdmin && (
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => handleUpdateTicket(ticket)}>
                                            Update Status
                                        </Button>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow><TableCell colSpan={isSuperAdmin ? 5 : isAdmin ? 4 : 3} className="h-24 text-center">No tickets found.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Contact Form Messages</CardTitle>
            <CardDescription>Messages sent from the public Contact page.</CardDescription>
          </CardHeader>
          <CardContent>
            {contactMessages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>
            ) : (
              <div className="space-y-4">
                {contactMessages.map(msg => (
                  <div key={msg.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{msg.subject}</p>
                        <p className="text-sm text-muted-foreground">
                          {msg.name} · <a className="underline" href={'mailto:' + msg.email}>{msg.email}</a>
                          {msg.company ? ' · ' + msg.company : ''} · {msg.reason || 'Other'} · {format(parseISO(msg.createdAt), 'PPP p')}
                        </p>
                      </div>
                      <Select value={msg.status} onValueChange={(v) => updateContactStatus(msg.id, v as ContactMessage['status'])}>
                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {contactStatuses.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm">{msg.message}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
