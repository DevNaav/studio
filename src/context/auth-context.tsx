
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, ConfirmationResult, verifyBeforeUpdateEmail, updateProfile as updateFirebaseProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, where, addDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '@/lib/types';
import { addMonths } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

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
  sendPasswordReset: (email: string) => Promise<void>;
  sendVerificationEmail: (user: User) => Promise<void>;
  getAllUsers: () => Promise<UserProfile[]>;
  updateUser: (uid: string, data: Partial<UserProfile>) => Promise<void>;
  updateUserProfilePicture: (uid: string, file: File) => Promise<string>;
  addUserByAdmin: (name: string, email: string, pass: string, companyId: string, role: UserRole) => Promise<void>;
  deleteUser: (uid: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true); // For initial page load
  const [authLoading, setAuthLoading] = useState(false); // For login/logout actions
  const { toast } = useToast();

  const isSuperAdmin = !!userProfile && userProfile.role === 'SuperAdmin' && !userProfile.companyId;
  const isAdmin = !!userProfile && (userProfile.role === 'Admin' || isSuperAdmin);
  
  useEffect(() => {
    let verificationTimer: NodeJS.Timeout | null = null;
    let profileUnsubscribe: () => void = () => {};

    const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setLoading(true);
        if (verificationTimer) clearInterval(verificationTimer);
        profileUnsubscribe(); // Unsubscribe from previous profile listener

        if (currentUser) {
            setUser(currentUser);

            // Always fetch/listen to profile
            const userDocRef = doc(db, 'users', currentUser.uid);
            profileUnsubscribe = onSnapshot(userDocRef, (userDoc) => {
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
    } catch (error) {
        console.error("Login failed:", error);
        throw error;
    } finally {
      setAuthLoading(false);
    }
  }
  
  const signUp = async (email: string, pass: string, name: string, companyName?: string, mobileNumber?: string) => {
    setAuthLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const newUser = userCredential.user;
      
      let companyId;
      const role: UserRole = 'Admin'; 

      if (companyName) {
        const now = new Date();
        const trialEndDate = addMonths(now, 2);

        const companyDocRef = await addDoc(collection(db, 'companies'), {
          name: companyName,
          ownerId: newUser.uid,
          createdAt: now.toISOString(),
          planId: 'premium-annually',
          billingCycle: 'annually',
          subscriptionStatus: 'Trial',
          subscriptionEndDate: trialEndDate.toISOString(),
          enableOrderMaterials: true,
        });
        companyId = companyDocRef.id;
      }
      
      const newProfileData: UserProfile = { 
        uid: newUser.uid, 
        email: newUser.email, 
        name, 
        role,
        companyId,
        hasCompletedOnboarding: false,
        mobileNumber,
      };
      await setDoc(doc(db, 'users', newUser.uid), newProfileData);
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
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged and the profile listener will handle profile creation/fetching.
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error("Error signing in with Google", error);
        toast({
          variant: 'destructive',
          title: 'Google Sign-In Failed',
          description: 'Could not sign in with Google. Please try again.',
        });
      }
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
    if (data.photoURL) {
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
    await updateDoc(userDocRef, firestoreUpdates);
  };

  const addUserByAdmin = async (name: string, email: string, pass: string, companyId: string, role: UserRole) => {
    if (!isAdmin) throw new Error("Only admins can add new users.");
    
    // In a real-world app, this logic should be moved to a secure backend function
    // to avoid security risks of handling credentials on the client.
    // This client-side implementation is for demonstration purposes.
    try {
        const { user: newUser } = await createUserWithEmailAndPassword(auth, email, pass);
        
        const userProfileData: UserProfile = {
            uid: newUser.uid,
            email: email,
            name: name,
            role: role,
            companyId: companyId,
        };
        await setDoc(doc(db, 'users', newUser.uid), userProfileData);
        await sendEmailVerification(newUser);

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
    if (!isAdmin) throw new Error("Permission denied.");
    // This is also a placeholder for a secure, server-side function.
    console.warn("deleteUser is a client-side simulation. For production, this should be a secure Firebase Function.");
    await deleteDoc(doc(db, "users", uid));
  };

  const updateUserProfilePicture = async (uid: string, file: File): Promise<string> => {
    // This function is not implemented in the provided context
    console.log("updateUserProfilePicture not implemented in this context. Simulating success.");
    return URL.createObjectURL(file);
  };

  const value = {
    user,
    userProfile,
    isSuperAdmin,
    isAdmin,
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
