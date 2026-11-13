
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Settings, User, AlertTriangle, Loader2, UploadCloud, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useThemePreference, LIGHT_THEME, DARK_THEME, type ThemePreference } from '@/lib/theme';
import { useAuth } from '@/context/auth-context';
import { EditProfileDialog } from './edit-profile-dialog';
import { Separator } from './ui/separator';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import { clearAllEntries } from '@/lib/clear-entries';
import { updateCompanyLogo } from '@/context/site-context';
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';
import { AnimationToggleSection } from './animation-toggle-section';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const themes: { name: string; key: ThemePreference; colors: { primary: string; secondary: string; accent: string; background: string; card: string; }; }[] = [
  { name: 'Synthwave', key: 'dark', colors: { primary: '325 100% 60%', secondary: '260 30% 17%', accent: '190 100% 50%', background: '260 60% 7%', card: '260 45% 11%' } },
  { name: 'Construction', key: 'construction', colors: { primary: '45 96% 50%', secondary: '20 14.3% 4.1%', accent: '240 5.9% 90%', background: '48 6% 95%', card: '0 0% 100%' } },
  { name: 'Glacial Cyan', key: 'futuristic', colors: { primary: '195 100% 50%', secondary: '220 20% 14%', accent: '210 100% 60%', background: '220 30% 5%', card: '220 25% 9%' } }
];


export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [theme, setTheme, appliedTheme] = useThemePreference();
  const { userProfile, isSuperAdmin, isAdmin } = useAuth();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleThemeChange = (themeName: ThemePreference) => setTheme(themeName);
  const themeLabel = (key: string) => themes.find(t => t.key === key)?.name ?? key;
  
  const handleClearData = async () => {
    setIsClearing(true);
    try {
        const result = await clearAllEntries();
        toast({
            title: "Data Cleared",
            description: result.message
        });
    } catch(e) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not clear all data. Please check console for details."
        });
    } finally {
        setIsClearing(false);
        setIsClearConfirmOpen(false);
    }
  }

  const handleLogoUpload = async () => {
    if (!logoFile || !userProfile?.companyId) return;
    setIsUploading(true);
    try {
        await updateCompanyLogo(userProfile.companyId, logoFile);
        toast({ title: 'Logo Uploaded', description: 'Your company logo has been updated.'});
        setLogoFile(null);
    } catch(e: any) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Upload Failed', description: e?.message || 'Could not upload your logo.'});
    } finally {
        setIsUploading(false);
    }
  }

  if (!userProfile) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><Settings /> Application Settings</DialogTitle>
                  <DialogDescription>Manage your workspace and profile settings.</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-8">

                  <div className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-lg font-semibold">Profile</h3>
                        <p className="text-sm text-muted-foreground">This is your profile information.</p>
                    </div>
                    <div className='flex items-center justify-between rounded-lg border p-4'>
                        <div className='flex items-center gap-4'>
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                <User className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="font-semibold">{userProfile.name}</p>
                                <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                                <p className="text-sm text-muted-foreground">{userProfile.mobileNumber}</p>
                            </div>
                        </div>
                        <Button variant="outline" onClick={() => setIsEditProfileOpen(true)}>Edit Profile</Button>
                    </div>
                  </div>
                  
                  {userProfile.companyId && isAdmin && (
                     <>
                        <Separator />
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold">Company Logo</h3>
                                <p className="text-sm text-muted-foreground">Upload a PNG, JPG or WebP logo (max 5 MB; a square image looks best). It is shown in the sidebar.</p>
                            </div>
                             <div className='flex items-end gap-4 rounded-lg border p-4'>
                                <div className="grid w-full max-w-sm items-center gap-1.5">
                                    <Input 
                                      id="logo-upload" 
                                      type="file" 
                                      accept="image/png, image/jpeg, image/webp"
                                      onChange={(e) => setLogoFile(e.target.files ? e.target.files[0] : null)}
                                    />
                                </div>
                                <Button onClick={handleLogoUpload} disabled={!logoFile || isUploading}>
                                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UploadCloud className="mr-2 h-4 w-4" />}
                                    Upload
                                </Button>
                            </div>
                        </div>
                     </>
                  )}

                  <Separator />
                  
                  <AnimationToggleSection />

                  <Separator />

                  <div className="space-y-4">
                      <div className="space-y-1">
                          <h3 className="text-lg font-semibold">Appearance</h3>
                          <p className="text-sm text-muted-foreground">Choose a theme, or pick System to follow your device&apos;s light/dark mode automatically.</p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="space-y-2">
                              <Button
                                  variant="outline"
                                  className={cn(
                                      "w-full h-24 flex flex-col items-start justify-between p-4",
                                      theme === 'system' && "border-primary ring-2 ring-primary"
                                  )}
                                  onClick={() => handleThemeChange('system')}
                              >
                                  <div className="flex items-center gap-2">
                                      {theme === 'system' ? <Check className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                                      <span className="font-semibold">System</span>
                                  </div>
                                  <span className="text-left text-[11px] font-normal leading-snug text-muted-foreground">
                                      Light: {themeLabel(LIGHT_THEME)} · Dark: {themeLabel(DARK_THEME)}
                                      {theme === 'system' && <><br />Now: {themeLabel(appliedTheme)}</>}
                                  </span>
                              </Button>
                          </div>
                      {themes.map((t) => (
                          <div key={t.key} className="space-y-2">
                              <Button
                                  variant="outline"
                                  className={cn(
                                      "w-full h-24 flex flex-col items-start justify-between p-4",
                                      theme === t.key && "border-primary ring-2 ring-primary"
                                  )}
                                  onClick={() => handleThemeChange(t.key)}
                              >
                                  <div className="flex items-center gap-2">
                                      {theme === t.key && <Check className="h-4 w-4" />}
                                      <span className="font-semibold capitalize">{t.name}</span>
                                  </div>
                                  <div className="flex w-full -space-x-1 overflow-hidden">
                                      <div className="h-6 w-6 rounded-full" style={{ backgroundColor: `hsl(${t.colors.primary})` }}></div>
                                      <div className="h-6 w-6 rounded-full" style={{ backgroundColor: `hsl(${t.colors.secondary})` }}></div>
                                      <div className="h-6 w-6 rounded-full" style={{ backgroundColor: `hsl(${t.colors.accent})` }}></div>
                                      <div className="h-6 w-6 rounded-full" style={{ backgroundColor: `hsl(${t.colors.card})` }}></div>
                                      <div className="h-6 w-6 rounded-full" style={{ backgroundColor: `hsl(${t.colors.background})` }}></div>
                                  </div>
                              </Button>
                          </div>
                      ))}
                      </div>
                  </div>

                  {isSuperAdmin && (
                    <>
                        <Separator />
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
                                    <AlertTriangle /> Danger Zone
                                </h3>
                                <p className="text-sm text-muted-foreground">These actions are destructive and cannot be undone.</p>
                            </div>
                            <div className='flex items-center justify-between rounded-lg border border-destructive/50 p-4'>
                                <div>
                                    <p className="font-semibold">Clear All Entries</p>
                                    <p className="text-sm text-muted-foreground">This will permanently delete all data across all companies.</p>
                                </div>
                                <Button variant="destructive" onClick={() => setIsClearConfirmOpen(true)} disabled={isClearing}>
                                    {isClearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Clear Data
                                </Button>
                            </div>
                        </div>
                    </>
                  )}
              </div>
          </DialogContent>
      </Dialog>
      
      <EditProfileDialog 
        open={isEditProfileOpen}
        onOpenChange={setIsEditProfileOpen}
      />
      
      <DeleteConfirmationDialog
        open={isClearConfirmOpen}
        onOpenChange={setIsClearConfirmOpen}
        onConfirm={handleClearData}
        title="Are you absolutely sure?"
        description="This will permanently delete all data, including sites, users, machines, and all logs across all companies. This action cannot be undone."
      />
    </>
  );
}
