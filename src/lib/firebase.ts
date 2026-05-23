import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, addDoc, collection } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
const firebaseConfig = {
  projectId: "gen-lang-client-0758178203",
  appId: "1:380694644226:web:667e436ebb4716d197091b",
  apiKey: "AIzaSyAFEiNX32LFclGVJ6P48jF6MMcgPHCaoFg",
  authDomain: "gen-lang-client-0758178203.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-db9e79bd-61e2-466b-80d0-f885d1e72017",
  storageBucket: "gen-lang-client-0758178203.firebasestorage.app",
  messagingSenderId: "380694644226",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-db9e79bd-61e2-466b-80d0-f885d1e72017");
export const auth = getAuth(app);
export const storage = getStorage(app, firebaseConfig.storageBucket);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const logEmailClientSide = async (emailData: {
  to: string;
  subject: string;
  status: 'sent' | 'failed';
  error?: string;
  type: 'certificate' | 'test' | 'bulk';
  sentBy: string;
}) => {
  try {
    await addDoc(collection(db, 'emailLogs'), {
      ...emailData,
      status: emailData.status || 'sent',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log email to Firestore from client:', error);
  }
};

export const getApiUrl = (endpoint: string, apiUrl?: string) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!apiUrl || !apiUrl.startsWith('http')) {
    return cleanEndpoint;
  }
  const base = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  return `${base}${cleanEndpoint}`;
};

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();
