import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEPARTMENTS as DEFAULT_DEPARTMENTS } from '../constants';

export interface Department {
  name: string;
  short: string;
}

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>(DEFAULT_DEPARTMENTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'siteSettings', 'general'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.departments && Array.isArray(data.departments) && data.departments.length > 0) {
            setDepartments(data.departments);
          } else {
            setDepartments(DEFAULT_DEPARTMENTS);
          }
        } else {
          setDepartments(DEFAULT_DEPARTMENTS);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error loading departments, using default:", error);
        setDepartments(DEFAULT_DEPARTMENTS);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { departments, loading };
}
