
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db, getProvisioningAuth } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, ConfirmationResult, verifyBeforeUpdateEmail, updateProfile as updateFirebaseProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, where, addDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '@/lib/types';
import { addMonths } from 'date-fns';
import { deleteUserAccount } from '@/app/actions/delete-user';
import { uploadFile } from '@/lib/file-upload';
import { useToast } from '@/hooks/use-toast';
import { activity, logActivity, setActivityActor } from '@/lib/activity-log';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  loading: boolean;
  authLoading: boolean; // For tracking login/logout process specifically
  logout: () => Promise<void>;
  logIn: (email: string, pass: string) => Promise<User | null>;
  signUp: (email: string, pass: string, name: string, companyName?: string, mobileNumber?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** True when the user is signed in but has no profile yet (e.g. first Google sign-in). */
  profileMissing: boolean;
  completeProfile: (name: string, companyName: string, mobileNumber?: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  sendVerificationEmail: (user: User) => Promise<void>;
  getAllUsers: () => Promise<UserProfile[]>;
  updateUser: (uid: string, data: Partial<UserProfile>) => Promise<void>;
  updateUserProfilePicture: (uid: string, file: File) => Promise<string>;
  addUserByAdmin: (name: string, email: string, pass: string, companyId: string, role: UserRole) => Promise<void>;
  /** Deletes a team member. authDeleted=false means only the profile was removed (no server credentials). */
  deleteUser: (uid: string) => Promise<{ authDeleted: boolean }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true); // For initial page load
  const [authLoading, setAuthLoading] = useState(false); // For login/logout actions
  const [profileMissing, setProfileMissing] = useState(false);
  const { toast } = useToast();

  const isSuperAdmin = !!userProfile && userProfile.role === 'SuperAdmin' && !userProfile.companyId;

  // Tell the activity log who is making changes.
  useEffect(() => {
    setActivityActor(userProfile ? { uid: userProfile.uid, name: userProfile.name || userProfile.email || 'Unknown', role: String(userProfile.role) } : null);
  }, [userProfile]);
  const isAdmin = !!userProfile && (userProfile.role === 'Admin' || isSuperAdmin);
  
  useEffect(() => {
    let verificationTimer: NodeJS.Timeout | null = null;
    let profileUnsubscribe: () => void = () => {};

    // Finishes a full-page Google sign-in (used when pop-ups are blocked) and reports its errors.
    getRedirectResult(auth).catch((error: any) => {
      console.error('Google redirect sign-in failed', error);
      toast({
        variant: 'destructive',
        title: 'Google Sign-In Failed',
        description: `Could not sign in with Google. Please try again.${error?.code ? ` (${String(error.code).replace('auth/', '')})` : ''}`,
      });
    });

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setLoading(true);
        if (verificationTimer) clearInterval(verificationTimer);
        profileUnsubscribe(); // Unsubscribe from previous profile listener

        if (currentUser) {
            setUser(currentUser);

            // Always fetch/listen to profile
            const userDocRef = doc(db, 'users', currentUser.uid);
            profileUnsubscribe = onSnapshot(userDocRef, (userDoc) => {
                setProfileMissing(!userDoc.exists());
                if (userDoc.exists()) {
                    const profileData = userDoc.data() as UserProfile;
                    setUserProfile(profileData);

                    // Now check for verification, but only if the profile is loaded
                    if (!currentUser.emailVerified && !(profileData.role === 'SuperAdmin' && !profileData.companyId)) {
                        verificationTimer = setInterval(async () => {
                            try {
                                await currentUser.reload();
                                if (auth.currentUser?.emailVerified) {
                                    if (verificationTimer) clearInterval(verificationTimer);
                                    // The user object will be updated by the outer onAuthStateChanged,
                                    // so we just need to stop polling.
                                }
                            } catch (error) {
                                console.error("Error reloading user for verification check:", error);
                                // Stop polling if there's a persistent error (like network failure)
                                if (verificationTimer) clearInterval(verificationTimer);
                            }
                        }, 3000);
                    }
                }
                setLoading(false);
            }, (error) => {
                console.error("Error fetching user profile:", error);
                setLoading(false);
            });

        } else {
            setUser(null);
            setUserProfile(null);
            setProfileMissing(false);
            setLoading(false);
        }
    });

    return () => {
        authUnsubscribe();
        if (verificationTimer) clearInterval(verificationTimer);
        profileUnsubscribe();
    };
}, []);


  const logIn = async (email: string, pass: string) => {
    setAuthLoading(true);
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        // onAuthStateChanged will handle the rest
        return userCredential.user;
    } catch (error: any) {
        // Wrong password / unknown account are expected user errors: show a clear
        // message instead of logging (console.error triggers Next's red dev overlay).
        const friendly: Record<string, string> = {
          'auth/invalid-credential': 'Incorrect email or password. If you signed up with Google, use "Sign in with Google" instead.',
          'auth/user-not-found': 'No account found with this email.',
          'auth/wrong-password': 'Incorrect email or password.',
          'auth/invalid-email': 'Please enter a valid email address.',
          'auth/user-disabled': 'This account has been disabled. Please contact your administrator.',
          'auth/too-many-requests': 'Too many failed attempts. Please wait a few minutes or reset your password.',
          'auth/network-request-failed': 'Network error. Please check your internet connection.',
        };
        if (error?.code && friendly[error.code]) {
          console.warn("Login failed:", error.code);
          throw new Error(friendly[error.code]);
        }
        console.error("Login failed:", error);
        throw error;
    } finally {
      setAuthLoading(false);
    }
  }
  
  /** Creates a trial company owned by the user, then their Admin profile. */
  const createCompanyAndProfile = async (newUser: User, name: string, companyName?: string, mobileNumber?: string) => {
      let companyId: string | undefined;
      if (companyName) {
        const now = new Date();
        const companyDocRef = await addDoc(collection(db, 'companies'), {
          name: companyName,
          ownerId: newUser.uid,
          createdAt: now.toISOString(),
          planId: 'premium-annually',
          billingCycle: 'annually',
          subscriptionStatus: 'Trial',
          subscriptionEndDate: addMonths(now, 2).toISOString(),
          enableOrderMaterials: true,
        });
        companyId = companyDocRef.id;
      }
      // Firestore rejects undefined values, so only include optional fields when set.
      const newProfileData: UserProfile = {
        uid: newUser.uid,
        email: newUser.email,
        name,
        role: 'Admin',
        hasCompletedOnboarding: false,
        ...(companyId ? { companyId } : {}),
        ...(mobileNumber ? { mobileNumber } : {}),
        ...(newUser.photoURL ? { photoURL: newUser.photoURL } : {}),
      };
      await setDoc(doc(db, 'users', newUser.uid), newProfileData);
  };

  /** Finishes setup for a signed-in user who has no profile yet (first Google sign-in). */
  const completeProfile = async (name: string, companyName: string, mobileNumber?: string) => {
    if (!user) throw new Error("Not signed in.");
    await createCompanyAndProfile(user, name, companyName, mobileNumber);
  };

  const signUp = async (email: string, pass: string, name: string, companyName?: string, mobileNumber?: string) => {
    setAuthLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const newUser = userCredential.user;
      
      await createCompanyAndProfile(newUser, name, companyName, mobileNumber);
      await sendEmailVerification(newUser);

    } catch(error) {
        console.error("Signup failed:", error);
        throw error;
    } finally {
        setAuthLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    setAuthLoading(true);
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged and the profile listener will handle profile creation/fetching.
    } catch (error: any) {
      const code: string = error?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      // Popups blocked (browser setting, in-app browsers): sign in on a full page instead.
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider);
        return;
      }
      console.error("Error signing in with Google", error);
      const reasons: Record<string, string> = {
        'auth/unauthorized-domain': 'This website address is not allowed to use Google sign-in yet.',
        'auth/operation-not-allowed': 'Google sign-in is turned off for this app.',
        'auth/network-request-failed': 'Network problem. Check your internet connection and try again.',
        'auth/account-exists-with-different-credential': 'An account with this email already exists. Sign in with your email and password.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/too-many-requests': 'Too many attempts. Please wait a minute and try again.',
        'auth/internal-error': 'Google sign-in was interrupted. Please try again, or allow pop-ups for this site.',
      };
      toast({
        variant: 'destructive',
        title: 'Google Sign-In Failed',
        description: `${reasons[code] ?? 'Could not sign in with Google. Please try again.'}${code ? ` (${code.replace('auth/', '')})` : ''}`,
      });
    } finally {
       setAuthLoading(false);
    }
  };
  
  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };
  
  const sendVerificationEmail = async (user: User) => {
    await sendEmailVerification(user);
  };

  const logout = async () => {
    setAuthLoading(true);
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
    setAuthLoading(false);
  };

  const getAllUsers = async (): Promise<UserProfile[]> => {
    if (!userProfile) return [];

    let q;
    if (isSuperAdmin) {
        q = query(collection(db, 'users'));
    } else if (isAdmin && userProfile.companyId) {
        q = query(collection(db, 'users'), where('companyId', '==', userProfile.companyId));
    } else {
        return [];
    }

    const userSnapshot = await getDocs(q);
    return userSnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
  };


  const updateUser = async (uid: string, data: Partial<UserProfile>) => {
    if (!user) throw new Error("Not authenticated.");
    if (!isAdmin && uid !== user.uid) throw new Error("Permission denied.");

    // Separate Firebase Auth updates from Firestore updates
    const authUpdates: { displayName?: string, photoURL?: string } = {};
    const firestoreUpdates: Partial<UserProfile> = { ...data };

    if (data.name) {
        authUpdates.displayName = data.name;
    }
    // Firebase Auth only accepts absolute http(s) URLs; uploaded pictures (/api/files/… links) live on the Firestore profile only.
    if (data.photoURL && /^https?:\/\//.test(data.photoURL)) {
        authUpdates.photoURL = data.photoURL;
    }
    
    if (data.email && data.email !== user.email) {
      await verifyBeforeUpdateEmail(user, data.email);
      // We don't update the email in firestore until it's verified, which is a more complex flow
      // For now, we just send the verification email.
      delete firestoreUpdates.email;
    }

    // Update Firebase Auth profile if there are changes
    if (Object.keys(authUpdates).length > 0) {
        await updateFirebaseProfile(user, authUpdates);
    }
    
    // Update Firestore user profile
    const userDocRef = doc(db, 'users', uid);
    const before = uid !== user.uid ? (await getDoc(userDocRef)).data() : undefined;
    await updateDoc(userDocRef, firestoreUpdates);
    // Log what an admin changed on someone else's account (role, site access...).
    if (before) activity.updated('users', uid, before, firestoreUpdates as Record<string, any>);
  };

  const addUserByAdmin = async (name: string, email: string, pass: string, companyId: string, role: UserRole) => {
    if (!isAdmin) throw new Error("Only admins can add new users.");
    if (role === 'SuperAdmin') throw new Error("SuperAdmin accounts can only be created in the Firebase console.");
    if (!isSuperAdmin && companyId !== userProfile?.companyId) throw new Error("You can only add users to your own company.");

    // Create the account on a separate Auth instance so the admin stays signed in.
    // The admin (not the new user) then writes the profile, which the Firestore
    // rules only allow for admins of that company.
    const provisioningAuth = getProvisioningAuth();
    try {
        const { user: newUser } = await createUserWithEmailAndPassword(provisioningAuth, email, pass);
        
        const userProfileData: UserProfile = {
            uid: newUser.uid,
            email: email,
            name: name,
            role: role,
            companyId: companyId,
        };
        await setDoc(doc(db, 'users', newUser.uid), userProfileData);
        logActivity({ companyId, action: 'create', entity: 'users', entityId: newUser.uid, label: name, summary: `Added team member "${name}" (${email}) as ${role}` });
        await sendEmailVerification(newUser);
        await signOut(provisioningAuth);

    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Failed to create user",
            description: error.message || "An unknown error occurred.",
        });
        throw error;
    }
  };

  const deleteUser = async (uid: string) => {
    if (!isAdmin || !user) throw new Error("Permission denied.");
    const removed = (await getDoc(doc(db, 'users', uid))).data();
    const logRemoval = () => removed && logActivity({
      companyId: removed.companyId, action: 'delete', entity: 'users', entityId: uid, label: removed.name,
      summary: `Removed team member "${removed.name || removed.email}"`,
    });
    // Delete the login + profile on the server (needs Firebase Admin credentials).
    const result = await deleteUserAccount(uid, await user.getIdToken());
    if (result.ok) {
      logRemoval();
      return { authDeleted: true };
    }
    if (result.reason !== 'no-credentials') throw new Error(result.message);
    // No server credentials (e.g. local dev): remove the profile only. With no
    // profile, the security rules give this account no access to any data.
    await deleteDoc(doc(db, "users", uid));
    logRemoval();
    return { authDeleted: false };
  };

  /**
   * Uploads a profile picture to the server's upload folder and returns its
   * link; the link is saved on the profile (photoURL) when the user presses Save.
   */
  const updateUserProfilePicture = async (_uid: string, file: File): Promise<string> => {
    if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Image is too large (max 5 MB).');
    const { url } = await uploadFile('avatars', file);
    return url;
  };

  const value = {
    user,
    userProfile,
    isSuperAdmin,
    isAdmin,
    profileMissing,
    completeProfile,
    loading,
    authLoading,
    logout,
    logIn,
    signUp,
    signInWithGoogle,
    sendPasswordReset,
    sendVerificationEmail,
    getAllUsers,
    updateUser,
    updateUserProfilePicture, // added this
    addUserByAdmin,
    deleteUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
