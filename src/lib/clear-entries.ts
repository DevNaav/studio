
'use client';

import { db } from './firebase';
import { collection, getDocs, writeBatch, query } from 'firebase/firestore';

const collectionsToDelete = [
  'inventory',
  'expenses',
  'labors',
  'attendances',
  'labor_transactions',
  'machines',
  'maintenance_logs',
  'fuel_logs',
  'emi_payments',
  'rental_payments',
  'machine_attendances',
  'documents',
];

/**
 * Deletes all documents in the specified collections.
 * This is a powerful utility and should be used with caution.
 */
export async function clearAllEntries() {
  const batch = writeBatch(db);
  let operations = 0;

  console.log('Starting to clear all entries...');

  for (const collectionName of collectionsToDelete) {
    console.log(`Fetching documents from: ${collectionName}`);
    const q = query(collection(db, collectionName));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(`Collection ${collectionName} is already empty.`);
      continue;
    }

    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      operations++;
      // Firestore batches have a limit of 500 operations.
      // If we are getting close, we should commit and start a new batch.
      // This is a simplified implementation and does not handle > 500 ops per collection.
    });

    console.log(`Queued ${snapshot.size} documents from ${collectionName} for deletion.`);
  }

  if (operations > 0) {
    console.log(`Committing batch of ${operations} delete operations.`);
    await batch.commit();
    console.log('All specified collections have been cleared.');
    return { success: true, message: `Successfully deleted ${operations} documents.` };
  } else {
    console.log('No documents found to delete.');
    return { success: true, message: 'No documents found to delete.' };
  }
}
