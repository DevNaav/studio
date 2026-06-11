
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Task, TaskStatus, taskStatuses, Site, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, CheckCircle, Clock, XCircle, AlertTriangle, Loader2, ListTodo } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { onSubCollectionSnapshot, addDocWithSiteId, updateDocWithId, softDeleteDocWithId, onGlobalCollectionSnapshot } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { DeleteConfirmationDialog } from '../delete-confirmation-dialog';
import { Badge } from '../ui/badge';
import { format, isPast } from 'date-fns';

const formSchema = z.object({
  title: z.string().min(5, 'Title is too short'),
  description: z.string().optional(),
  assigneeId: z.string().min(1, 'Please assign the task to a user.'),
  dueDate: z.string().min(1, 'Due date is required'),
  status: z.enum(taskStatuses),
});

const reasonFormSchema = z.object({
  status: z.enum(taskStatuses),
  reason: z.string().optional(),
}).refine(data => data.status !== 'Blocked' || (!!data.reason && data.reason.length > 10), {
    message: 'A reason of at least 10 characters is required when a task is blocked.',
    path: ['reason'],
});


interface TasksTabProps {
  site: Site;
}

export function TasksTab({ site }: TasksTabProps) {
  const { id: siteId, companyId } = site;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [siteUsers, setSiteUsers] = useState<UserProfile[]>([]);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();
  const { user, userProfile, isAdmin } = useAuth();
  
  useEffect(() => {
    if (!companyId) return;

    const unsubTasks = onSubCollectionSnapshot<Task>('tasks', companyId, siteId, setTasks);
    const unsubUsers = onGlobalCollectionSnapshot<UserProfile>('users', companyId, (allUsers) => {
      const usersForSite = allUsers.filter(u => 
        u.role === 'Admin' || u.assignedSites?.includes(siteId)
      );
      setSiteUsers(usersForSite);
    });

    return () => {
      unsubTasks();
      unsubUsers();
    };
  }, [siteId, companyId]);

  const taskForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const reasonForm = useForm<z.infer<typeof reasonFormSchema>>({
    resolver: zodResolver(reasonFormSchema),
  });
  
  useEffect(() => {
    if(isTaskDialogOpen && !selectedTask) {
        taskForm.reset({
            title: '',
            description: '',
            assigneeId: undefined,
            dueDate: new Date().toISOString().split('T')[0],
            status: 'To Do',
        });
    } else if (isTaskDialogOpen && selectedTask) {
        taskForm.reset(selectedTask);
    }
  }, [isTaskDialogOpen, selectedTask, taskForm]);

  useEffect(() => {
    if (isUpdateDialogOpen && selectedTask) {
      reasonForm.reset({
        status: selectedTask.status,
        reason: selectedTask.reasonIfNotDone || '',
      });
    }
  }, [isUpdateDialogOpen, selectedTask, reasonForm]);


  const handleOpenTaskDialog = (task: Task | null = null) => {
    setSelectedTask(task);
    setIsTaskDialogOpen(true);
  };
  
  const handleOpenUpdateDialog = (task: Task) => {
    setSelectedTask(task);
    setIsUpdateDialogOpen(true);
  };

  const handleOpenDeleteDialog = (task: Task) => {
    setSelectedTask(task);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedTask) {
      await softDeleteDocWithId('tasks', selectedTask.id);
      toast({ title: 'Task Deleted' });
    }
    setIsDeleteDialogOpen(false);
  };

  const onTaskSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!companyId) return;
    setIsSubmitting(true);
    const assignee = siteUsers.find(u => u.uid === values.assigneeId);
    if (!assignee) {
        toast({ variant: 'destructive', title: 'Error', description: 'Assignee not found.'});
        setIsSubmitting(false);
        return;
    }

    const taskData: Partial<Task> = {
        ...values,
        assigneeName: assignee.name || assignee.email,
        createdAt: selectedTask?.createdAt || new Date().toISOString(),
    };
    
    try {
        if (selectedTask) {
            await updateDocWithId('tasks', selectedTask.id, taskData);
            toast({ title: 'Task Updated' });
        } else {
            await addDocWithSiteId('tasks', companyId, siteId, taskData);
            toast({ title: 'Task Created' });
        }
        setIsTaskDialogOpen(false);
    } catch(e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save task.'});
    } finally {
        setIsSubmitting(false);
    }
  };

  const onUpdateSubmit = async (values: z.infer<typeof reasonFormSchema>) => {
    if (!selectedTask) return;
    setIsSubmitting(true);
    try {
      await updateDocWithId('tasks', selectedTask.id, {
        status: values.status,
        reasonIfNotDone: values.reason,
      });
      toast({ title: 'Task Status Updated' });
      setIsUpdateDialogOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update task status.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusVariant = (status: TaskStatus) => {
    switch(status) {
      case 'To Do': return 'outline';
      case 'In Progress': return 'secondary';
      case 'Done': return 'default';
      case 'Blocked': return 'destructive';
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><ListTodo />Daily Tasks</CardTitle>
            <CardDescription>Assign and track daily work for this site.</CardDescription>
          </div>
          {isAdmin && <Button onClick={() => handleOpenTaskDialog()}><Plus className="mr-2 h-4 w-4" /> Add Task</Button>}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason (if blocked)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map(task => {
                const isOverdue = !['Done', 'Blocked'].includes(task.status) && isPast(new Date(task.dueDate));
                const canUpdate = isAdmin || task.assigneeId === user?.uid;
                
                return (
                  <TableRow key={task.id} className={isOverdue ? 'bg-destructive/10' : ''}>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>{task.assigneeName}</TableCell>
                    <TableCell>
                        {format(new Date(task.dueDate), 'PPP')}
                        {isOverdue && <Badge variant="destructive" className="ml-2">Overdue</Badge>}
                    </TableCell>
                    <TableCell><Badge variant={getStatusVariant(task.status)}>{task.status}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate">{task.reasonIfNotDone || 'N/A'}</TableCell>
                    <TableCell className="text-right">
                       {canUpdate && (
                         <Button variant="outline" size="sm" onClick={() => handleOpenUpdateDialog(task)}>Update Status</Button>
                       )}
                       {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenTaskDialog(task)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(task)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </>
                       )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Task Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedTask ? 'Edit' : 'Create'} Task</DialogTitle>
            <DialogDescription>Fill in the details for the daily task.</DialogDescription>
          </DialogHeader>
          <Form {...taskForm}>
            <form onSubmit={taskForm.handleSubmit(onTaskSubmit)} className="space-y-4 py-4">
              <fieldset disabled={isSubmitting}>
                <FormField control={taskForm.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Task Title</FormLabel><FormControl><Input placeholder="e.g., Complete foundation wiring" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={taskForm.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea placeholder="Add more details about the task..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={taskForm.control} name="assigneeId" render={({ field }) => (
                  <FormItem><FormLabel>Assign To</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger></FormControl>
                    <SelectContent>{siteUsers.map(u => <SelectItem key={u.uid} value={u.uid}>{u.name} ({u.role})</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
                )} />
                <FormField control={taskForm.control} name="dueDate" render={({ field }) => (
                  <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={taskForm.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                    <SelectContent>{taskStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
                )} />
              </fieldset>
              <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setIsTaskDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{selectedTask ? 'Save Changes' : 'Create Task'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Update Status/Reason Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Task: {selectedTask?.title}</DialogTitle>
            <DialogDescription>Change the status and provide a reason if the task is blocked.</DialogDescription>
          </DialogHeader>
          <Form {...reasonForm}>
            <form onSubmit={reasonForm.handleSubmit(onUpdateSubmit)} className="space-y-4 py-4">
              <fieldset disabled={isSubmitting}>
                <FormField control={reasonForm.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>New Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{taskStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                {reasonForm.watch('status') === 'Blocked' && (
                    <FormField control={reasonForm.control} name="reason" render={({ field }) => (
                    <FormItem><FormLabel>Reason for Blocker</FormLabel><FormControl><Textarea placeholder="e.g., Waiting for materials delivery..." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                )}
              </fieldset>
              <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setIsUpdateDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Task"
        description={`Are you sure you want to delete the task "${selectedTask?.title}"?`}
      />
    </>
  );
}
