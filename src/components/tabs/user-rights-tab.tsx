
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { UserProfile, UserRole, userRoles, Company, CustomRole, Permission, permissions } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Plus, ChevronsUpDown, Edit, Trash2, KeyRound, Lock } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useSite } from '@/context/site-context';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Checkbox } from '../ui/checkbox';
import { DeleteConfirmationDialog } from '../delete-confirmation-dialog';
import { EditUserDialog } from '../edit-user-dialog';
import { AddUserDialog } from '../add-user-dialog';
import { CompaniesPage } from '../companies-page';
import { Separator } from '../ui/separator';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { RoleManagementDialog } from '../role-management-dialog';
import { addDocWithSiteId, updateDocWithId, softDeleteDocWithId } from '@/context/site-context';
import { Switch } from '../ui/switch';
import { logActivity } from '@/lib/activity-log';

interface UserRightsTabProps {
    companyId: string | null | undefined;
    company: Company | undefined;
}

export function UserRightsTab({ companyId, company }: UserRightsTabProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allSystemUsers, setAllSystemUsers] = useState<UserProfile[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { getAllUsers, updateUser, deleteUser, user, userProfile, isSuperAdmin } = useAuth();
  const { sites } = useSite();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isDeleteRoleDialogOpen, setIsDeleteRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);

  const fetchUsers = async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const allUsers = await getAllUsers();
      if (isSuperAdmin) {
        setAllSystemUsers(allUsers);
        const companyUsers = companyId ? allUsers.filter(u => u.companyId === companyId) : [];
        setUsers(companyUsers);
      } else {
        setUsers(allUsers);
        setAllSystemUsers(allUsers);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error fetching users',
        description: 'Could not retrieve user list.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      const unsub = onSnapshot(collection(db, 'companies'), (snapshot) => {
        setAllCompanies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company)));
      });
      return () => unsub();
    }
  }, [isSuperAdmin]);
  
  useEffect(() => {
    if (!companyId) {
      setCustomRoles([]);
      return;
    };
    const q = query(collection(db, 'custom_roles'), where('companyId', '==', companyId));
    const unsub = onSnapshot(q, (snapshot) => {
      setCustomRoles(snapshot.docs.map(doc => ({id: doc.id, ...doc.data() } as CustomRole)));
    });
    return () => unsub();
  }, [companyId]);

  useEffect(() => {
    fetchUsers();
  }, [userProfile, companyId]);
  
  const handleOpenDeleteDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };
  
  const handleOpenEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setIsEditUserDialogOpen(true);
  };
  
  const handleOpenRoleDialog = (role: CustomRole | null = null) => {
    setSelectedRole(role);
    setIsRoleDialogOpen(true);
  }
  
  const handleOpenDeleteRoleDialog = (role: CustomRole) => {
    setSelectedRole(role);
    setIsDeleteRoleDialogOpen(true);
  }

  const handleDeleteConfirm = async () => {
    if (selectedUser) {
      try {
        const { authDeleted } = await deleteUser(selectedUser.uid);
        toast(authDeleted
          ? { title: 'User Deleted', description: `${selectedUser.name} has been removed and can no longer sign in.` }
          : { title: 'User Removed', description: `${selectedUser.name} no longer has access. Their login still exists — delete it under Firebase Console → Authentication.` });
        fetchUsers(); // Refresh the list
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Deletion Failed',
          description: error?.message || `Could not delete ${selectedUser.name}.`,
        });
      }
    }
    setIsDeleteDialogOpen(false);
    setSelectedUser(null);
  };
  
  const handleDeleteRoleConfirm = async () => {
    if(selectedRole) {
      // Check if any user is assigned this role
      if(users.some(u => u.role === selectedRole.name)) {
        toast({ variant: 'destructive', title: 'Deletion Failed', description: 'Cannot delete a role that is currently assigned to users.'});
      } else {
        await softDeleteDocWithId('custom_roles', selectedRole.id);
        toast({ title: 'Role Deleted' });
      }
    }
    setIsDeleteRoleDialogOpen(false);
    setSelectedRole(null);
  }
  
  const handleSaveRole = async (roleData: { name: string; permissions: Permission[] }) => {
    if (!companyId) return;
    try {
      if(selectedRole) {
        await updateDocWithId('custom_roles', selectedRole.id, roleData);
        toast({ title: 'Role Updated' });
      } else {
        await addDocWithSiteId('custom_roles', companyId, '', roleData);
        toast({ title: 'Role Created' });
      }
      setIsRoleDialogOpen(false);
    } catch(e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save role.'});
    }
  }

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    try {
      await updateUser(uid, { role: newRole });
      setUsers(users.map(u => u.uid === uid ? { ...u, role: newRole } : u));
      toast({
        title: 'Role Updated',
        description: `User role has been successfully changed to ${newRole}.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not update user role.',
      });
    }
  };

  const handleSiteAssignmentChange = async (uid: string, assignedSites: string[]) => {
    try {
        await updateUser(uid, { assignedSites });
        setUsers(users.map(u => u.uid === uid ? { ...u, assignedSites } : u));
        toast({
            title: 'Sites Updated',
            description: `User site assignments have been updated.`,
        });
    } catch (error) {
         toast({
            variant: 'destructive',
            title: 'Update Failed',
            description: 'Could not update site assignments.',
        });
    }
  };

  const handleLockToggle = async (companyId: string, isLocked: boolean) => {
    try {
      await updateDoc(doc(db, 'companies', companyId), { isLocked: isLocked });
      logActivity({ companyId, action: 'update', entity: 'companies', entityId: companyId, summary: isLocked ? 'Locked the company portal' : 'Unlocked the company portal' });
      toast({ title: "Company Updated", description: `Portal lock status has been changed.` });
    } catch(e) {
      toast({ variant: 'destructive', title: "Error", description: "Failed to update lock status."});
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    if (userRoles.includes(role)) {
      switch (role) {
        case 'Admin': return 'default';
        case 'Site Manager': case 'Project Manager': return 'secondary';
        default: return 'outline';
      }
    }
    return 'outline'; // For custom roles
  };
  
  const displayedUsers = users;
  const onBasicPlan = company?.planId.startsWith('basic') && company.subscriptionStatus === 'Active';
  const userLimitReached = onBasicPlan && users.length >= 10;
  const allRoleOptions = [...userRoles, ...customRoles.map(r => r.name)];

  return (
    <div className="space-y-6">
      {isSuperAdmin && (
        <>
            <CompaniesPage allUsers={allSystemUsers} />
            <Separator />
        </>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><KeyRound />Custom Roles & Permissions</CardTitle>
            <CardDescription>
              Define custom roles and assign granular permissions.
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenRoleDialog()} disabled={!companyId}><Plus className="mr-2 h-4 w-4" /> Add Role</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customRoles.length > 0 ? customRoles.map(role => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell className="space-x-1">
                    {role.permissions.map(p => <Badge key={p} variant="secondary">{p}</Badge>)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenRoleDialog(role)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteRoleDialog(role)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">No custom roles defined yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Users /> User Management</CardTitle>
            <CardDescription>
              {isSuperAdmin && !companyId
                ? 'Select a company above to view and manage its users.'
                : 'Manage user roles and their access to specific construction sites.'}
            </CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="relative">
                        <Button onClick={() => setAddUserDialogOpen(true)} disabled={(isSuperAdmin && !companyId) || userLimitReached}>
                            <Plus className="mr-2 h-4 w-4" /> Add User
                        </Button>
                    </div>
                </TooltipTrigger>
                {userLimitReached && (
                    <TooltipContent>
                        <p>You have reached the 10-user limit for the Basic plan. Please upgrade to add more users.</p>
                    </TooltipContent>
                )}
            </Tooltip>
          </TooltipProvider>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[50px]'>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assigned Sites</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                     <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  </TableCell>
                </TableRow>
              ) : displayedUsers.length > 0 ? (
                  displayedUsers.map((u, index) => (
                    <TableRow key={u.uid}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        {user?.uid !== u.uid ? (
                          <Select
                            value={u.role}
                            onValueChange={(newRole: UserRole) => handleRoleChange(u.uid, newRole)}
                            disabled={user?.uid === u.uid}
                          >
                            <SelectTrigger className="w-auto min-w-[120px]">
                                <Badge variant={getRoleBadgeVariant(u.role)} className="cursor-pointer">{u.role}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {allRoleOptions.map(role => (
                                <SelectItem key={role} value={role}>{role}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={getRoleBadgeVariant(u.role)}>{u.role}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.role !== 'Admin' ? (
                          <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-[200px] justify-between">
                                        {u.assignedSites?.length || 0} sites selected
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[200px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search sites..." />
                                        <CommandList>
                                            <CommandEmpty>No sites found.</CommandEmpty>
                                            <CommandGroup>
                                                {sites.map(site => (
                                                    <CommandItem
                                                        key={site.id}
                                                        onSelect={() => {
                                                            const selectedSites = u.assignedSites || [];
                                                            const newAssignedSites = selectedSites.includes(site.id)
                                                                ? selectedSites.filter(id => id !== site.id)
                                                                : [...selectedSites, site.id];
                                                            handleSiteAssignmentChange(u.uid, newAssignedSites);
                                                        }}
                                                    >
                                                        <Checkbox
                                                            className="mr-2"
                                                            checked={u.assignedSites?.includes(site.id)}
                                                        />
                                                        {site.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        ) : (
                            <span className='text-sm text-muted-foreground'>All sites (Admin)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {user?.uid !== u.uid && (
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(u)}>
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit User</span>
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(u)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                    <span className="sr-only">Delete User</span>
                                </Button>
                            </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center h-24">
                          {isSuperAdmin && !companyId
                                ? 'No company selected.'
                                : 'No users found for this company.'}
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <AddUserDialog
        open={isAddUserDialogOpen}
        onOpenChange={setAddUserDialogOpen}
        onUserAdded={fetchUsers}
        companyId={companyId}
        allCompanies={allCompanies}
      />
      
      {selectedUser && (
        <EditUserDialog
          open={isEditUserDialogOpen}
          onOpenChange={setIsEditUserDialogOpen}
          user={selectedUser}
          onUserUpdated={() => {
            fetchUsers();
            setIsEditUserDialogOpen(false);
          }}
        />
      )}

       <DeleteConfirmationDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen} 
        onConfirm={handleDeleteConfirm}
        title="Delete User"
        description={`Are you sure you want to delete the user "${selectedUser?.name}"? This action cannot be undone.`}
      />
      
      <RoleManagementDialog 
        open={isRoleDialogOpen}
        onOpenChange={setIsRoleDialogOpen}
        onSave={handleSaveRole}
        existingRole={selectedRole}
      />
      
      <DeleteConfirmationDialog 
        open={isDeleteRoleDialogOpen} 
        onOpenChange={setIsDeleteRoleDialogOpen} 
        onConfirm={handleDeleteRoleConfirm}
        title="Delete Custom Role"
        description={`Are you sure you want to delete the role "${selectedRole?.name}"? This role will be removed from all users.`}
      />
    </div>
  );
}
