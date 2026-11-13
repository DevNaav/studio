

'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, where, getDocs, writeBatch, serverTimestamp, getDoc, Query, orderBy
} from "firebase/firestore";
import { uploadFile, deleteUploadedFile } from '@/lib/file-upload';

import { Site, Document as DocumentType, MaintenanceLog, InventoryItem, Labor, Attendance, Expense, Purchase, LaborTransaction, EmiPayment, MachineAttendance, MachineAttendanceStatus, Machine, Company, Payment, Sale, SalePayment, RentedMaterial, RentedMaterialAttendance, RentedMaterialAttendanceStatus } from '@/lib/types';
import useLocalStorage from '@/hooks/use-local-storage';
import { useAuth } from './auth-context';
import { addMonths, format } from 'date-fns';
import { extractDocumentData } from '@/ai/flows/extract-document-data-flow';
import { getIdTokenOrThrow } from '@/lib/id-token';


// Standalone data fetching functions
export const onSubCollectionSnapshot = <T extends { isDeleted?: boolean }>(collectionName: string, companyId: string | null | undefined, siteId: string, callback: (data: T[]) => void) => {
    if (!companyId || !siteId) {
        callback([]);
        return () => {}; // Return an empty unsubscribe function
    }
    const q = query(collection(db, collectionName), where("companyId", "==", companyId), where("siteId", "==", siteId));
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T)).filter(item => !item.isDeleted);
        callback(data);
    }, (error) => {
        console.error(`Error fetching ${collectionName} for site ${siteId}:`, error);
    });
};

export const onGlobalCollectionSnapshot = <T extends { isDeleted?: boolean }>(collectionName: string | Query, companyId: string | null | undefined | ((data: T[]) => void), callback?: (data: T[]) => void) => {
    let finalCallback: (data: T[]) => void;
    let q: Query;
    let finalCompanyId: string | null | undefined;

    if (typeof companyId === 'function') {
        finalCallback = companyId;
        q = collectionName as Query;
        finalCompanyId = null; // Not needed as query is pre-built
    } else {
        finalCallback = callback!;
        finalCompanyId = companyId;
         if (typeof collectionName === 'string') {
            if (!finalCompanyId) {
                finalCallback([]);
                return () => {};
            }
            q = query(collection(db, collectionName), where("companyId", "==", finalCompanyId));
        } else {
            q = collectionName;
        }
    }
        
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T)).filter(item => !item.isDeleted);
        finalCallback(data);
    }, (error) => {
        console.error(`Error fetching global collection:`, error);
    });
};

// Overload for the super admin case where the query is passed directly
export const onCompanyCollectionSnapshot = <T,>(q: Query, callback: (data: T[]) => void) => {
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T));
        callback(data);
    }, (error) => {
        console.error(`Error fetching collection:`, error);
    });
};


export const getSubCollection = async <T extends { isDeleted?: boolean }>(collectionName: string, companyId: string | null | undefined, siteId: string, includeDeleted = false): Promise<T[]> => {
    if (!companyId || !siteId) {
        return [];
    }
    const q = query(collection(db, collectionName), where("companyId", "==", companyId), where("siteId", "==", siteId));
    const snapshot = await getDocs(q);
    const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T));

    if (includeDeleted) {
        return allDocs;
    }
    
    return allDocs.filter(doc => !doc.isDeleted);
};


export const addDocWithSiteId = async (collectionName: string, companyId: string, siteId: string, data: object) => {
    return await addDoc(collection(db, collectionName), { ...data, companyId, siteId, isDeleted: false });
};

export const addDocToGlobalCollection = async (collectionName: string, companyId: string, data: object) => {
    if (!companyId) throw new Error("Company ID is required to add to a global collection.");
    return await addDoc(collection(db, collectionName), { ...data, companyId, isDeleted: false });
};

export const updateDocWithId = async (collectionName: string, docId: string, data: object) => {
    return await updateDoc(doc(db, collectionName, docId), data);
};

export const deleteDocWithId = async (collectionName: string, docId: string) => {
    return await deleteDoc(doc(db, collectionName, docId));
};

export const softDeleteDocWithId = async (collectionName: string, docId: string) => {
    return await updateDoc(doc(db, collectionName, docId), { isDeleted: true });
};

const fileToDataURI = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

export const addDocumentDb = async (
    companyId: string, 
    siteId: string, 
    data: { name: string, file: File, expiryDate?: string }, 
    onExtractionComplete?: () => void,
    machineId?: string
) => {
    const { name, file, expiryDate } = data;
    // The file goes to the server's upload folder; Firestore only keeps the link and path.
    const { url, path: filePath } = await uploadFile('documents', file, companyId);


    const docData: Partial<DocumentType> & { createdAt: ReturnType<typeof serverTimestamp> } = {
        companyId,
        siteId,
        name,
        url,
        filePath,
        uploadDate: new Date().toISOString().split('T')[0],
        // Firestore rejects undefined values, so only include optional fields when set.
        ...(expiryDate ? { expiryDate } : {}),
        createdAt: serverTimestamp(),
        isDeleted: false,
    };

    if (machineId) {
        docData.machineId = machineId;
    }
    
    const docRef = await addDoc(collection(db, "documents"), docData);

    // Run AI extraction in the background, but don't wait for it
    (async () => {
        try {
            const dataUri = await fileToDataURI(file);
            const extractionResult = await extractDocumentData({ documentDataUri: dataUri }, await getIdTokenOrThrow());
            if (extractionResult.summary) {
                 await updateDoc(docRef, { extractedText: extractionResult.summary });
            }
        } catch (aiError) {
            console.error("AI data extraction failed:", aiError);
        } finally {
            onExtractionComplete?.();
        }
    })();

};

export const deleteDocumentDb = async (docData: DocumentType) => {
    // Old documents were stored in Firebase Storage (https URLs); only server-stored files can be removed here.
    if (docData.filePath && docData.url?.startsWith('/api/files/')) {
      await deleteUploadedFile(docData.filePath);
    }
    await softDeleteDocWithId("documents", docData.id);
};


export const addMaintenanceLogDb = async (companyId: string, machineId: string, data: Omit<MaintenanceLog, 'id' | 'isDeleted' | 'companyId'>) => {
    // Remember which site the machine was on, so site reports (e.g. Defect Liability) can attribute the cost.
    let siteId: string | undefined;
    try {
        const machineSnap = await getDoc(doc(db, 'machines', machineId));
        siteId = machineSnap.exists() ? (machineSnap.data().assignedSiteId || undefined) : undefined;
    } catch (error) {
        console.warn('Could not look up machine site for maintenance log:', error);
    }
    const logRef = await addDocToGlobalCollection('maintenance_logs', companyId, { ...data, machineId, ...(siteId ? { siteId } : {}) });
    return logRef;
};


export const markAttendance = async (companyId: string, siteId: string, laborId: string, date: string, status: any, batch?: any) => {
    if (!companyId) return;
    const q = query(collection(db, "attendances"), where("companyId", "==", companyId), where("laborId", "==", laborId), where("date", "==", date));
    const snapshot = await getDocs(q);
    const useBatch = batch || writeBatch(db);

    if (snapshot.empty) {
        const newAttendanceRef = doc(collection(db, "attendances"));
        useBatch.set(newAttendanceRef, { companyId, siteId, laborId, date, status, isDeleted: false });
    } else {
        const docId = snapshot.docs[0].id;
        const docRef = doc(db, 'attendances', docId);
        useBatch.update(docRef, { status });
    }

    if (!batch) {
        await useBatch.commit();
    }
};

export const markMachineAttendance = async (companyId: string, machineId: string, date: string, status: MachineAttendanceStatus) => {
    if (!companyId) return;
    const q = query(collection(db, "machine_attendances"), where("companyId", "==", companyId), where("machineId", "==", machineId), where("date", "==", date));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      await addDocToGlobalCollection('machine_attendances', companyId, { machineId, date, status, isDeleted: false });
    } else {
      const docId = snapshot.docs[0].id;
      await updateDocWithId('machine_attendances', docId, { status });
    }
};

export const markRentedMaterialAttendance = async (companyId: string, siteId: string, rentedMaterialId: string, date: string, status: RentedMaterialAttendanceStatus) => {
    if (!companyId) return;
    const q = query(collection(db, "rented_material_attendances"), where("companyId", "==", companyId), where("rentedMaterialId", "==", rentedMaterialId), where("date", "==", date));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      await addDocToGlobalCollection('rented_material_attendances', companyId, { siteId, rentedMaterialId, date, status });
    } else {
      const docId = snapshot.docs[0].id;
      await updateDocWithId('rented_material_attendances', docId, { status });
    }
};

export const addLaborerDb = async (companyId: string, data: Partial<Omit<Labor, 'id' | 'isDeleted' | 'companyId'>>, idProofFile?: File) => {
    if (!companyId) throw new Error("Company ID is required.");
    const laborData: any = { ...data, isDeleted: false };
    delete laborData.idProof;

    if (idProofFile) {
        const { url, path } = await uploadFile('labor_ids', idProofFile, companyId);
        laborData.idProofUrl = url;
        laborData.idProofFilePath = path;
    }

    return await addDocToGlobalCollection('labors', companyId, laborData);
};

export const updateLaborerDb = async (laborId: string, data: Partial<Omit<Labor, 'id' | 'isDeleted' | 'companyId'>>, idProofFile?: File) => {
    const laborData: any = { ...data };
    delete laborData.idProof;

    const laborDoc = await getDoc(doc(db, 'labors', laborId));
    if (!laborDoc.exists()) throw new Error("Laborer not found");
    const companyId = laborDoc.data().companyId;
    
    if (!companyId) throw new Error("Laborer is not associated with a company.");


    if (idProofFile) {
        const { url, path } = await uploadFile('labor_ids', idProofFile, companyId);
        laborData.idProofUrl = url;
        laborData.idProofFilePath = path;
    }

    const result = await updateDocWithId('labors', laborId, laborData);

    // Remove the replaced ID proof from the server (older Firebase Storage files are left alone).
    const previous = laborDoc.data();
    if (idProofFile && previous.idProofFilePath && previous.idProofUrl?.startsWith('/api/files/')) {
        deleteUploadedFile(previous.idProofFilePath).catch(err => console.warn('Could not delete old ID proof:', err));
    }
    return result;
};


export const generateEmiSchedule = async (companyId: string | null | undefined, machineId: string, startDate: string, tenureYears: number, emiAmount: number) => {
    if (!companyId) return;
    const batch = writeBatch(db);
    const numberOfMonths = tenureYears * 12;
    const start = new Date(startDate);

    // Clear existing schedule for this machine
    const q = query(collection(db, 'emi_payments'), where("companyId", "==", companyId), where('machineId', '==', machineId));
    const existingDocs = await getDocs(q);
    existingDocs.forEach(doc => batch.delete(doc.ref));

    for (let i = 0; i < numberOfMonths; i++) {
        const dueDate = addMonths(start, i + 1);
        const newPayment: Omit<EmiPayment, 'id'> = {
            companyId,
            machineId,
            dueDate: format(dueDate, 'yyyy-MM-dd'),
            amount: emiAmount,
            status: 'Upcoming',
            isDeleted: false,
        };
        const docRef = doc(collection(db, 'emi_payments'));
        batch.set(docRef, newPayment);
    }
    await batch.commit();
};

export const markEmiAsPaid = async (paymentId: string) => {
    const paymentDate = format(new Date(), 'yyyy-MM-dd');
    const paymentDocRef = doc(db, 'emi_payments', paymentId);
    
    const batch = writeBatch(db);
    
    const paymentDoc = await getDoc(paymentDocRef);
    if (!paymentDoc.exists()) {
        throw new Error("Payment document not found.");
    }
    const paymentData = paymentDoc.data() as EmiPayment;
    const machineId = paymentData.machineId;
    const companyId = paymentData.companyId;
    if (!companyId) throw new Error("Payment is not associated with a company.");

    batch.update(paymentDocRef, {
        status: 'Paid',
        paymentDate: paymentDate,
    });
    
    const machineDoc = await getDoc(doc(db, 'machines', machineId));
    if (machineDoc.exists()) {
        const machine = machineDoc.data() as Machine;
        if (machine.assignedSiteId) {
            const expenseData: Partial<Expense> = {
                companyId,
                siteId: machine.assignedSiteId,
                description: `EMI Payment for ${machine.name}`,
                category: 'EMI',
                amount: paymentData.amount,
                date: paymentDate,
                machineId: machineId,
                isDeleted: false,
            };
            const expenseDocRef = doc(collection(db, 'expenses'));
            batch.set(expenseDocRef, expenseData);
        }
    }

    await batch.commit();
};


export const getEmiPaymentsForMachine = async (companyId: string, machineId: string): Promise<EmiPayment[]> => {
    if (!companyId) return [];
    const q = query(collection(db, 'emi_payments'), where("companyId", "==", companyId), where('machineId', '==', machineId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmiPayment));
};

export const distributeFoodCostDb = async (siteId: string, date: string, totalCost: number, laborIds: string[]) => {
    if (laborIds.length === 0) return;
    const laborDoc = await getDoc(doc(db, 'labors', laborIds[0]));
    if (!laborDoc.exists()) return;
    const companyId = laborDoc.data().companyId;
    if (!companyId) return;

    const costPerLaborer = totalCost / laborIds.length;
    const batch = writeBatch(db);

    laborIds.forEach(laborId => {
        const newTransaction: Omit<LaborTransaction, 'id' | 'isDeleted'> = {
            laborId,
            companyId,
            siteId,
            type: 'Food',
            amount: costPerLaborer,
            date,
        };
        const docRef = doc(collection(db, 'labor_transactions'));
        batch.set(docRef, { ...newTransaction, isDeleted: false });
    });

    await batch.commit();
};

export const assignRentedMachineToSite = async (machine: Machine, siteId: string, assignmentDate: string) => {
    const machineRef = doc(db, 'machines', machine.id);
    await updateDoc(machineRef, { 
      assignedSiteId: siteId === 'unassigned' ? null : siteId,
      assignmentDate: assignmentDate 
    });
};

export const updateCompanySubscription = async (companyId: string, data: Partial<Pick<Company, 'planId' | 'subscriptionStatus' | 'subscriptionEndDate' | 'billingCycle'>>) => {
  const companyRef = doc(db, 'companies', companyId);
  await updateDoc(companyRef, data);
};

/**
 * Uploads a company logo to the server's upload folder and saves only its link
 * (logoUrl) and storage path (logoPath) on the company document.
 */
export const updateCompanyLogo = async (companyId: string, file: File) => {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (PNG, JPG or WebP).');
  if (file.size > 5 * 1024 * 1024) throw new Error('Logo is too large (max 5 MB).');

  const companyDoc = await getDoc(doc(db, 'companies', companyId));
  const previous = companyDoc.data() as Company | undefined;

  const { url, path } = await uploadFile('logos', file, companyId);
  await updateDoc(doc(db, 'companies', companyId), { logoUrl: url, logoPath: path });

  // Remove the old logo file from the server (older Firebase Storage logos are left alone).
  if (previous?.logoPath && previous.logoUrl?.startsWith('/api/files/')) {
    deleteUploadedFile(previous.logoPath).catch(err => console.warn('Could not delete old logo:', err));
  }
};


export const recordPaymentAndUpdateSubscription = async (
    companyId: string, 
    subscriptionData: Partial<Pick<Company, 'planId' | 'subscriptionStatus' | 'subscriptionEndDate' | 'billingCycle'>>,
    paymentData: Omit<Payment, 'id' | 'companyId' | 'isDeleted'>
) => {
    const batch = writeBatch(db);

    const companyRef = doc(db, 'companies', companyId);
    batch.update(companyRef, subscriptionData);

    const paymentRef = doc(collection(db, 'payments'));
    batch.set(paymentRef, { ...paymentData, companyId, isDeleted: false });

    await batch.commit();
};


export const distributePaymentToSales = async (
  companyId: string,
  siteId: string,
  destinationId: string,
  payment: Omit<SalePayment, 'amount'> & { amount: number }
) => {
  if (!companyId) throw new Error("Company context is missing.");
  
  const salesQuery = query(
    collection(db, 'sales'),
    where('companyId', '==', companyId),
    where('siteId', '==', siteId),
    where('destinationSiteId', '==', (destinationId === 'external' ? '' : destinationId)),
    where('paymentStatus', 'in', ['Unpaid', 'Partially Paid']),
    orderBy('date', 'asc')
  );

  const salesSnapshot = await getDocs(salesQuery);
  const unpaidSales = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));

  let remainingPayment = payment.amount;
  const batch = writeBatch(db);

  for (const sale of unpaidSales) {
    if (remainingPayment <= 0) break;

    const balanceDue = sale.salePrice - sale.amountPaid;
    const paymentToApply = Math.min(remainingPayment, balanceDue);
    
    const newAmountPaid = sale.amountPaid + paymentToApply;
    const newPaymentStatus = newAmountPaid >= sale.salePrice ? 'Paid' : 'Partially Paid';
    
    const paymentRecord: SalePayment = {
      ...payment,
      amount: paymentToApply,
    };

    const saleRef = doc(db, 'sales', sale.id);
    batch.update(saleRef, {
      amountPaid: newAmountPaid,
      paymentStatus: newPaymentStatus,
      paymentHistory: [...(sale.paymentHistory || []), paymentRecord],
    });

    remainingPayment -= paymentToApply;
  }
  
  if (remainingPayment > 0) {
      // This case can happen if the payment exceeds the total outstanding balance.
      // You might want to log this or handle it, e.g., by creating a credit note.
      console.warn(`Payment of ${payment.amount} exceeded total outstanding balance by ${remainingPayment}.`);
  }

  await batch.commit();
};


// Site Context
type ActiveView = 'dashboard' | 'sites' | 'machines' | 'labor' | 'documents' | 'users' | 'subscription' | 'payment' | 'completed-sites' | 'support' | 'documentation' | 'theft' | 'analysis' | 'warehouse' | 'sales' | 'manufacturing' | 'threat-modeler' | 'defect-liability' | 'warranty-tracker';

interface SiteContextType {
  loading: boolean;
  sites: Site[];
  setSites: (sites: Site[]) => void;
  allCompanies: Company[];
  setCompanies: (companies: Company[]) => void;
  addSite: (site: Omit<Site, 'id' | 'companyId'>) => Promise<void>;
  updateSite: (site: Site) => Promise<void>;
  deleteSite: (siteId: string) => Promise<void>;
  selectedSiteId: string | null;
  setSelectedSiteId: (id: string | null) => void;
  setActiveView: (view: ActiveView) => void;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export const SiteProvider = ({ children, setActiveView }: { children: ReactNode, setActiveView: (view: ActiveView) => void }) => {
  const { userProfile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<Site[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useLocalStorage<string | null>('selectedSiteId', null);
  
  useEffect(() => {
    if (authLoading) return;
    const availableSites = sites;
    if (availableSites.length > 0 && !availableSites.some(s => s.id === selectedSiteId)) {
      setSelectedSiteId(availableSites[0].id);
    } else if (availableSites.length === 0) {
      setSelectedSiteId(null);
    }
    setLoading(false);
  }, [sites, selectedSiteId, setSelectedSiteId, authLoading]);


  const addSite = async (siteData: Omit<Site, 'id' | 'companyId'>) => {
    if (!userProfile?.companyId) {
        throw new Error("User is not associated with a company.");
    }
    await addDoc(collection(db, 'sites'), {...siteData, companyId: userProfile.companyId, isDeleted: false});
  };

  const updateSite = async (siteData: Site) => {
    const { id, ...data } = siteData;
    await updateDoc(doc(db, 'sites', id), data);
  };
  
  const deleteSite = async (siteId: string) => {
    await updateDoc(doc(db, 'sites', siteId), { isDeleted: true });
    if (selectedSiteId === siteId) {
        const remainingSites = sites.filter(s => s.id !== siteId);
        setSelectedSiteId(remainingSites.length > 0 ? remainingSites[0].id : null);
    }
  };

  const value = {
    loading,
    sites,
    setSites,
    allCompanies, 
    setCompanies: setAllCompanies,
    addSite, 
    updateSite, 
    deleteSite, 
    selectedSiteId, 
    setSelectedSiteId,
    setActiveView,
  };

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
};

export const useSite = () => {
    const context = useContext(SiteContext);
    if (context === undefined) {
        throw new Error('useSite must be used within a SiteProvider');
    }
    return context;
};
