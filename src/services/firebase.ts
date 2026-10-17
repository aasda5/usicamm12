import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, limit, doc, setDoc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const ADMIN_EMAIL = 'cursospv@vamosporeducacion.com';
export const DEFAULT_ADMIN_PASSWORDS = ['Ma920622+'];

export const verifyAdminPassword = (password: string): boolean => {
  if (!password) return false;
  const cleanPass = password.trim();
  if (DEFAULT_ADMIN_PASSWORDS.includes(cleanPass)) return true;
  try {
    const custom = localStorage.getItem('usicamm_admin_password');
    if (custom && cleanPass === custom.trim()) return true;
  } catch (e) {}
  return false;
};

export const setCustomAdminPassword = (newPassword: string): boolean => {
  if (!newPassword || newPassword.trim().length < 4) return false;
  try {
    localStorage.setItem('usicamm_admin_password', newPassword.trim());
    return true;
  } catch (e) {
    return false;
  }
};

export const getAdminPassword = (): string => {
  try {
    const custom = localStorage.getItem('usicamm_admin_password');
    if (custom) return custom;
  } catch (e) {}
  return DEFAULT_ADMIN_PASSWORDS[0];
};

export const isUserAdmin = (userOrEmail: any): boolean => {
  if (!userOrEmail) return false;
  let email = '';
  if (typeof userOrEmail === 'string') {
    email = userOrEmail;
  } else if (userOrEmail.email) {
    email = userOrEmail.email;
  }
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error supporting Google sign in", error);
    throw error;
  }
};

export const logout = () => auth.signOut();

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
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
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In development/preview we log and continue without crashing app flow
}

export const saveQuizResult = async (userId: string, data: {
  score: number,
  totalQuestions: number,
  userAnswers: number[],
  correctAnswers: number[],
  questionIds: number[],
  email?: string | null
}) => {
  const path = 'quizResults';
  const newEntry = {
    id: `local_${Date.now()}`,
    userId,
    userEmail: data.email || null,
    score: data.score,
    totalQuestions: data.totalQuestions,
    userAnswers: data.userAnswers,
    correctAnswers: data.correctAnswers,
    questionIds: data.questionIds,
    createdAt: new Date().toISOString()
  };

  // Cache locally
  try {
    const local = localStorage.getItem('usicamm_quiz_results_cache');
    const list = local ? JSON.parse(local) : [];
    list.unshift(newEntry);
    localStorage.setItem('usicamm_quiz_results_cache', JSON.stringify(list.slice(0, 50)));
  } catch (e) {}

  try {
    await addDoc(collection(db, path), {
      userId,
      userEmail: data.email || null,
      score: data.score,
      totalQuestions: data.totalQuestions,
      userAnswers: data.userAnswers,
      correctAnswers: data.correctAnswers,
      questionIds: data.questionIds,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("Could not write result to Firestore (cached locally):", error);
  }
};

export const getUserHistory = async (userId: string) => {
  const path = 'quizResults';
  try {
    const q = query(
      collection(db, path), 
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  } catch (error) {
    console.warn("Error getting Firestore user history, fallback to local:", error);
  }

  try {
    const local = localStorage.getItem('usicamm_quiz_results_cache');
    if (local) {
      const list = JSON.parse(local);
      return list.filter((item: any) => item.userId === userId || !userId);
    }
  } catch (e) {}
  return [];
};

export interface AuthorizedEmailRecord {
  id: string;
  email: string;
  active: boolean;
  name?: string;
  notes?: string;
  addedAt?: any;
  addedBy?: string;
}

const LOCAL_STORAGE_EMAILS_KEY = 'usicamm_authorized_emails_cache';

const DEFAULT_SEEDED_EMAILS: AuthorizedEmailRecord[] = [
  {
    id: 'cursospv@vamosporeducacion.com',
    email: 'cursospv@vamosporeducacion.com',
    active: true,
    name: 'Director del Curso (Administrador)',
    notes: 'Super Administrador del Sistema',
    addedAt: new Date().toISOString(),
    addedBy: 'Sistema'
  },
  {
    id: 'aspirante.demo@gmail.com',
    email: 'aspirante.demo@gmail.com',
    active: true,
    name: 'Prof. Demo Ejemplo',
    notes: 'Aspirante Inicial Autorizado',
    addedAt: new Date().toISOString(),
    addedBy: 'Sistema'
  }
];

export const checkUserAuthorization = async (userEmail: string): Promise<boolean> => {
  if (!userEmail) return false;
  const cleanEmail = userEmail.trim().toLowerCase();
  
  // Super admin is always authorized
  if (cleanEmail === ADMIN_EMAIL.toLowerCase()) {
    return true;
  }

  // 1. Check local cache first for instant responsiveness
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_EMAILS_KEY);
    if (local) {
      const list: AuthorizedEmailRecord[] = JSON.parse(local);
      const matched = list.find(item => item.email.trim().toLowerCase() === cleanEmail);
      if (matched) {
        return matched.active !== false;
      }
    }
  } catch (e) {}

  // 2. Check Firestore
  const path = 'authorizedEmails';
  try {
    const directDoc = await getDoc(doc(db, path, cleanEmail));
    if (directDoc.exists()) {
      const data = directDoc.data();
      const isActive = data?.active !== false;
      // Sync into local cache
      syncLocalEmailItem({
        id: directDoc.id,
        email: data?.email || directDoc.id,
        active: isActive,
        name: data?.name || '',
        notes: data?.notes || ''
      });
      return isActive;
    }

    const q = query(collection(db, path), where('email', '==', cleanEmail), where('active', '==', true));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (error) {
    console.warn("Firestore checkUserAuthorization fallback:", error);
    // If not in cache and Firestore query fails, fallback to local default list
    return DEFAULT_SEEDED_EMAILS.some(e => e.email.toLowerCase() === cleanEmail && e.active !== false);
  }
};

export const getAuthorizedUserRecord = async (userEmail: string): Promise<AuthorizedEmailRecord | null> => {
  if (!userEmail) return null;
  const cleanEmail = userEmail.trim().toLowerCase();
  try {
    const list = getLocalEmails();
    const matched = list.find(item => item.email.trim().toLowerCase() === cleanEmail);
    if (matched) return matched;
  } catch (e) {}
  return null;
};

function getLocalEmails(): AuthorizedEmailRecord[] {
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_EMAILS_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  localStorage.setItem(LOCAL_STORAGE_EMAILS_KEY, JSON.stringify(DEFAULT_SEEDED_EMAILS));
  return DEFAULT_SEEDED_EMAILS;
}

function saveLocalEmails(emails: AuthorizedEmailRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_EMAILS_KEY, JSON.stringify(emails));
  } catch (e) {}
}

function syncLocalEmailItem(item: AuthorizedEmailRecord) {
  const current = getLocalEmails();
  const index = current.findIndex(e => e.email.toLowerCase() === item.email.toLowerCase() || e.id === item.id);
  if (index >= 0) {
    current[index] = { ...current[index], ...item };
  } else {
    current.unshift(item);
  }
  saveLocalEmails(current);
}

export const getAuthorizedEmails = async (): Promise<AuthorizedEmailRecord[]> => {
  const path = 'authorizedEmails';
  let firestoreList: AuthorizedEmailRecord[] = [];

  try {
    const snapshot = await getDocs(collection(db, path));
    if (!snapshot.empty) {
      firestoreList = snapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email || doc.id,
        active: doc.data().active !== false,
        name: doc.data().name || '',
        notes: doc.data().notes || '',
        addedAt: doc.data().addedAt?.toDate ? doc.data().addedAt.toDate().toISOString() : doc.data().addedAt,
        addedBy: doc.data().addedBy || ''
      }));
    }
  } catch (error) {
    console.warn("Error getting Firestore authorized emails, using local cache:", error);
  }

  const localList = getLocalEmails();
  
  // Merge Firestore list with local cache, preserving newer entries
  const map = new Map<string, AuthorizedEmailRecord>();
  localList.forEach(item => map.set(item.email.toLowerCase(), item));
  firestoreList.forEach(item => map.set(item.email.toLowerCase(), item));
  
  const merged = Array.from(map.values());
  saveLocalEmails(merged);
  return merged;
};

export const addAuthorizedEmail = async (email: string, name?: string, notes?: string): Promise<void> => {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Correo electrónico no válido');
  }

  const newRecord: AuthorizedEmailRecord = {
    id: cleanEmail,
    email: cleanEmail,
    active: true,
    name: name?.trim() || '',
    notes: notes?.trim() || '',
    addedAt: new Date().toISOString(),
    addedBy: auth.currentUser?.email || 'cursospv@vamosporeducacion.com'
  };

  // Update local cache immediately
  syncLocalEmailItem(newRecord);

  // Update Firestore
  const path = 'authorizedEmails';
  try {
    await setDoc(doc(db, path, cleanEmail), {
      email: cleanEmail,
      active: true,
      name: name?.trim() || '',
      notes: notes?.trim() || '',
      addedAt: serverTimestamp(),
      addedBy: auth.currentUser?.email || 'cursospv@vamosporeducacion.com'
    });
  } catch (error) {
    console.warn("Could not sync added email to Firestore (saved in local cache):", error);
  }
};

export const addMultipleAuthorizedEmails = async (emailsText: string): Promise<{ added: number; errors: number }> => {
  const rawList = emailsText
    .split(/[\n,;]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 3 && e.includes('@'));

  let added = 0;
  let errors = 0;

  for (const email of rawList) {
    try {
      await addAuthorizedEmail(email);
      added++;
    } catch (e) {
      errors++;
    }
  }

  return { added, errors };
};

export const toggleAuthorizedEmail = async (id: string, currentActive: boolean): Promise<void> => {
  const localList = getLocalEmails();
  const item = localList.find(e => e.id === id || e.email.toLowerCase() === id.toLowerCase());
  if (item) {
    item.active = !currentActive;
    saveLocalEmails(localList);
  }

  const path = 'authorizedEmails';
  try {
    await updateDoc(doc(db, path, id), {
      active: !currentActive
    });
  } catch (error) {
    console.warn("Firestore updateDoc error, preserved in local cache:", error);
  }
};

export const deleteAuthorizedEmail = async (id: string): Promise<void> => {
  const localList = getLocalEmails().filter(e => e.id !== id && e.email.toLowerCase() !== id.toLowerCase());
  saveLocalEmails(localList);

  const path = 'authorizedEmails';
  try {
    await deleteDoc(doc(db, path, id));
  } catch (error) {
    console.warn("Firestore deleteDoc error, deleted from local cache:", error);
  }
};

export const getAllQuizResultsForAdmin = async (): Promise<any[]> => {
  const path = 'quizResults';
  let list: any[] = [];
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  } catch (error) {
    console.warn("Firestore getAllQuizResultsForAdmin fallback to local:", error);
  }

  try {
    const local = localStorage.getItem('usicamm_quiz_results_cache');
    if (local) {
      const localResults = JSON.parse(local);
      const combined = [...list, ...localResults];
      // remove duplicate ids
      const seen = new Set();
      return combined.filter(item => {
        const id = item.id || item.createdAt;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    }
  } catch (e) {}

  return list;
};

export const clearAppMemory = () => {
  try {
    localStorage.removeItem('usicamm_seen_questions');
    localStorage.removeItem('usicamm_quiz_results_cache');
    return true;
  } catch (e) {
    console.error("Error clearing app memory:", e);
    return false;
  }
};

