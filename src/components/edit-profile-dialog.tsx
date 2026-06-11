

'use client';

import { useEffect, useState, useRef } from 'react';
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
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Briefcase, Camera, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';
import { useSite } from '@/context/site-context';
import { Label } from './ui/label';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email(),
  mobileNumber: z.string().min(10, { message: 'Please enter a valid 10-digit mobile number.' }).regex(/^\d{10}$/, 'Mobile number must be 10 digits.').optional(),
});

// Generate a list of random avatar URLs
const randomAvatarSeeds = Array.from({ length: 8 }, (_, i) => `avatar${i + 1}`);

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProfileDialog({ open, onOpenChange }: EditProfileDialogProps) {
  const { user, userProfile, updateUser, updateUserProfilePicture } = useAuth();
  const { allCompanies } = useSite();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentCompany = allCompanies.find(c => c.id === userProfile?.companyId);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (userProfile) {
      form.reset({
        name: userProfile.name || '',
        email: userProfile.email || '',
        mobileNumber: userProfile.mobileNumber?.startsWith('+91') ? userProfile.mobileNumber.slice(3) : userProfile.mobileNumber || '',
      });
      setSelectedAvatar(userProfile.photoURL || null);
    }
    setIsEditingEmail(false);
  }, [userProfile, form, open]);

  const handleUpdateEmail = async () => {
    if (!user || !userProfile) return;
    
    const newEmail = form.getValues('email');
    if (newEmail === userProfile.email) {
      setIsEditingEmail(false);
      return;
    }

    setIsSubmitting(true);
    try {
        await updateUser(user.uid, { email: newEmail });
        toast({
            title: "Verification Email Sent",
            description: `A verification link has been sent to ${newEmail}. Please click the link to finalize the change.`,
        });
        setIsEditingEmail(false);
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Failed to Update Email",
            description: error.message || "An unexpected error occurred.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const onProfileSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!userProfile) return;
    setIsSubmitting(true);

    const updates: Partial<UserProfile> = {};
    if (values.name !== userProfile.name) {
        updates.name = values.name;
    }

    if (selectedAvatar && selectedAvatar !== userProfile.photoURL) {
        updates.photoURL = selectedAvatar;
    }

    if (Object.keys(updates).length === 0) {
        onOpenChange(false);
        setIsSubmitting(false);
        return;
    }

    try {
      await updateUser(userProfile.uid, updates);
      toast({
        title: 'Profile Updated',
        description: "Your profile has been successfully updated.",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && user) {
        setIsSubmitting(true);
        try {
            const photoURL = await updateUserProfilePicture(user.uid, file);
            setSelectedAvatar(photoURL);
            toast({ title: 'Profile Picture Uploaded' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload image.' });
        } finally {
            setIsSubmitting(false);
        }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your personal information and profile picture.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center items-center py-4">
            <div className="relative">
                <Avatar className="h-24 w-24">
                    <AvatarImage src={selectedAvatar || userProfile?.photoURL || ''} alt={userProfile?.name || ''} />
                    <AvatarFallback className="text-3xl">
                        {userProfile?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <Button 
                    size="icon" 
                    className="absolute bottom-0 right-0 rounded-full h-8 w-8"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Camera className="h-4 w-4" />
                </Button>
                <Input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/png, image/jpeg"
                    onChange={handleFileChange}
                />
            </div>
        </div>

        <div className="space-y-2">
            <Label className="text-sm font-medium">Choose an avatar</Label>
            <div className="grid grid-cols-5 gap-2">
                {currentCompany?.logoUrl && (
                    <div 
                        className={cn("relative rounded-full cursor-pointer ring-2 ring-transparent hover:ring-primary", selectedAvatar === currentCompany.logoUrl && "ring-primary")}
                        onClick={() => setSelectedAvatar(currentCompany.logoUrl!)}
                    >
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={currentCompany.logoUrl} />
                            <AvatarFallback><Briefcase /></AvatarFallback>
                        </Avatar>
                        {selectedAvatar === currentCompany.logoUrl && <Check className="absolute top-1 right-1 h-4 w-4 bg-primary text-primary-foreground rounded-full p-0.5" />}
                    </div>
                )}
                {randomAvatarSeeds.map((seed) => (
                    <div 
                        key={seed} 
                        className={cn("relative rounded-full cursor-pointer ring-2 ring-transparent hover:ring-primary", selectedAvatar === `https://picsum.photos/seed/${seed}/200` && "ring-primary")}
                        onClick={() => setSelectedAvatar(`https://picsum.photos/seed/${seed}/200`)}
                    >
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={`https://picsum.photos/seed/${seed}/200`} />
                        </Avatar>
                         {selectedAvatar === `https://picsum.photos/seed/${seed}/200` && <Check className="absolute top-1 right-1 h-4 w-4 bg-primary text-primary-foreground rounded-full p-0.5" />}
                    </div>
                ))}
            </div>
        </div>
        
        <Separator />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onProfileSubmit)} className="space-y-4 pt-4">
             <fieldset disabled={isSubmitting} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input type="email" {...field} readOnly={!isEditingEmail} />
                        </FormControl>
                        {!isEditingEmail ? (
                          <Button type="button" variant="outline" onClick={() => setIsEditingEmail(true)}>Change</Button>
                        ) : (
                          <Button type="button" onClick={handleUpdateEmail} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : "Verify"}
                          </Button>
                        )}
                      </div>
                       <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="mobileNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Your 10-digit mobile number" {...field} readOnly className="cursor-not-allowed bg-muted/50" />
                      </FormControl>
                       <FormMessage />
                    </FormItem>
                  )}
                />
            </fieldset>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || isEditingEmail}>
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
