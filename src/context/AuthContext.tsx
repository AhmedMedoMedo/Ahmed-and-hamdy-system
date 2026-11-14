import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export type AuthRole = 'admin' | 'tenant' | null;

export interface TenantPermissions {
  showHome?: boolean;
  showMerchants?: boolean;
  showWorkOrders?: boolean;
  showPersonal?: boolean;
  showDebts?: boolean;
  showArchive?: boolean;
  showActivityLog?: boolean;
  showSettings?: boolean;
  showCloudStatus?: boolean;
}

export const DEFAULT_TENANT_PERMISSIONS: Required<TenantPermissions> = {
  showHome: true,
  showMerchants: true,
  showWorkOrders: true,
  showPersonal: true,
  showDebts: true,
  showArchive: true,
  showActivityLog: true,
  showSettings: true,
  showCloudStatus: true,
};

export interface TenantData {
  id: string;
  name: string;
  pin: string;
  logoUrl?: string;
  permissions?: TenantPermissions;
  createdAt?: string;
}

interface StoredAuthSession {
  isAuthenticated: boolean;
  role: AuthRole;
  tenantData: TenantData | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  role: AuthRole;
  tenantData: TenantData | null;
  login: (pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AUTH_STORAGE_KEY = 'ah_saas_auth_session_v1';
const ADMIN_PIN = '2026';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseTenantPermissions(raw: unknown): TenantPermissions | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Record<string, unknown>;
  return {
    showHome: src.showHome !== false,
    showMerchants: src.showMerchants !== false,
    showWorkOrders: src.showWorkOrders !== false,
    showPersonal: src.showPersonal !== false,
    showDebts: src.showDebts !== false,
    showArchive: src.showArchive !== false,
    showActivityLog: src.showActivityLog !== false,
    showSettings: src.showSettings !== false,
    showCloudStatus: src.showCloudStatus !== false,
  };
}

function readStoredSession(): StoredAuthSession {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return { isAuthenticated: false, role: null, tenantData: null };
    }
    const parsed = JSON.parse(raw) as Partial<StoredAuthSession>;
    if (parsed.isAuthenticated && (parsed.role === 'admin' || parsed.role === 'tenant')) {
      return {
        isAuthenticated: true,
        role: parsed.role,
        tenantData: parsed.role === 'tenant' && parsed.tenantData ? parsed.tenantData : null,
      };
    }
  } catch {
    // Ignore malformed local storage
  }
  return { isAuthenticated: false, role: null, tenantData: null };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<StoredAuthSession>(() => readStoredSession());

  const persistSession = useCallback((nextSession: StoredAuthSession) => {
    setSession(nextSession);
    try {
      if (nextSession.isAuthenticated) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  // Keep active tenant branding & permissions synced in real-time
  useEffect(() => {
    if (!session.isAuthenticated || session.role !== 'tenant' || !session.tenantData?.id) {
      return;
    }

    const tenantDocRef = doc(db, 'tenants', session.tenantData.id);
    const unsubscribe = onSnapshot(
      tenantDocRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const updatedTenant: TenantData = {
          id: snap.id,
          name: String(data.name || ''),
          pin: String(data.pin || session.tenantData?.pin || ''),
          logoUrl: typeof data.logoUrl === 'string' && data.logoUrl.trim() ? data.logoUrl.trim() : undefined,
          permissions: parseTenantPermissions(data.permissions),
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : session.tenantData?.createdAt,
        };
        persistSession({
          isAuthenticated: true,
          role: 'tenant',
          tenantData: updatedTenant,
        });
      },
      () => {
        // Keep cached session if offline
      }
    );

    return () => unsubscribe();
  }, [session.isAuthenticated, session.role, session.tenantData?.id, persistSession]);

  const login = useCallback(async (pin: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedPin = pin.trim();
    if (!trimmedPin) {
      return { success: false, error: 'يرجى إدخال رمز الدخول السري' };
    }

    let masterPin = ADMIN_PIN;
    try {
      const masterSnap = await getDoc(doc(db, 'global_settings', 'master_auth'));
      if (masterSnap.exists()) {
        const storedPin = masterSnap.data()?.pin;
        if (storedPin !== undefined && storedPin !== null && String(storedPin).trim()) {
          masterPin = String(storedPin).trim();
        }
      }
    } catch {
      // Fallback to default master PIN if doc is unreadable/offline
    }

    if (trimmedPin === masterPin) {
      persistSession({
        isAuthenticated: true,
        role: 'admin',
        tenantData: null,
      });
      return { success: true };
    }

    try {
      const q = query(collection(db, 'tenants'), where('pin', '==', trimmedPin));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data();
        const tenant: TenantData = {
          id: docSnap.id,
          name: String(data.name || ''),
          pin: String(data.pin || trimmedPin),
          logoUrl: typeof data.logoUrl === 'string' && data.logoUrl.trim() ? data.logoUrl.trim() : undefined,
          permissions: parseTenantPermissions(data.permissions),
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
        };

        persistSession({
          isAuthenticated: true,
          role: 'tenant',
          tenantData: tenant,
        });
        return { success: true };
      }

      return { success: false, error: 'رمز الدخول غير صحيح، يرجى التأكد والمحاولة مرة أخرى' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('insufficient')) {
        try {
          handleFirestoreError(error, OperationType.LIST, 'tenants');
        } catch {
          // Structured error logged via handleFirestoreError
        }
      }
      return {
        success: false,
        error: 'تعذر التحقق من رمز الدخول حالياً، تأكد من الاتصال بالإنترنت وحاول مجدداً',
      };
    }
  }, [persistSession]);

  const logout = useCallback(() => {
    persistSession({
      isAuthenticated: false,
      role: null,
      tenantData: null,
    });
  }, [persistSession]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: session.isAuthenticated,
        role: session.role,
        tenantData: session.tenantData,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
