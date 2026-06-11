
'use client';

import { useState, useEffect } from 'react';

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      // If the item is a string that doesn't look like JSON, don't parse it.
      if (item && (item.startsWith('{') || item.startsWith('['))) {
        return JSON.parse(item);
      }
      // Handle simple string values or null/undefined
      return item ? item as T : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        // Only stringify if the value is an object or array
        if (typeof valueToStore === 'object' && valueToStore !== null) {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } else {
          window.localStorage.setItem(key, String(valueToStore));
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
        try {
            const item = window.localStorage.getItem(key);
             if (item) {
                // Same logic as initialization to avoid hydration mismatches
                if (item && (item.startsWith('{') || item.startsWith('['))) {
                    setStoredValue(JSON.parse(item));
                } else {
                    setStoredValue(item as T);
                }
            }
        } catch (error) {
            console.error(error)
        }
    }
  }, [key]);

  return [storedValue, setValue];
}

export default useLocalStorage;
