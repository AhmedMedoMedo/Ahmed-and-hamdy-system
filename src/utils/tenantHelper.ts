import { collection, doc, type CollectionReference, type DocumentReference, type Firestore } from 'firebase/firestore';

export interface ActiveTenantSession {
  isTenant: boolean;
  role: 'admin' | 'tenant' | null;
  tenantId: string | null;
  tenantName: string | null;
}

const AUTH_STORAGE_KEY = 'ah_saas_auth_session_v1';

export const getActiveTenantSession = (): ActiveTenantSession => {
  try {
    const sessionRaw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw);
      if (parsed?.role === 'tenant' && parsed?.tenantData) {
        const tenantId = String(parsed.tenantData.pin || parsed.tenantData.id || '')
          .trim()
          .replace(/\//g, '_');
        if (tenantId) {
          return {
            isTenant: true,
            role: 'tenant',
            tenantId,
            tenantName: parsed.tenantData.name ? String(parsed.tenantData.name) : null,
          };
        }
      }
      if (parsed?.role === 'admin') {
        return { isTenant: false, role: 'admin', tenantId: null, tenantName: null };
      }
    }

    const legacyRole = localStorage.getItem('role');
    if (legacyRole === 'tenant') {
      const tenantDataStr = localStorage.getItem('tenantData');
      if (tenantDataStr) {
        const tenantData = JSON.parse(tenantDataStr);
        const tenantId = String(tenantData.pin || tenantData.id || '')
          .trim()
          .replace(/\//g, '_');
        if (tenantId) {
          return {
            isTenant: true,
            role: 'tenant',
            tenantId,
            tenantName: tenantData.name ? String(tenantData.name) : null,
          };
        }
      }
    } else if (legacyRole === 'admin') {
      return { isTenant: false, role: 'admin', tenantId: null, tenantName: null };
    }
  } catch (e) {
    console.error('Error reading active tenant session:', e);
  }

  return { isTenant: false, role: null, tenantId: null, tenantName: null };
};

export const getCollectionPath = (baseName: string): string => {
  if (baseName === 'tenants') return baseName;

  try {
    const session = getActiveTenantSession();
    if (session.isTenant && session.tenantId) {
      return `tenants/${session.tenantId}/${baseName}`;
    }
  } catch (e) {
    console.error('Error getting tenant path:', e);
  }

  return baseName;
};

export const isTenantSession = (): boolean => {
  return getActiveTenantSession().isTenant;
};

export const getScopedStorageKey = (baseKey: string): string => {
  const session = getActiveTenantSession();
  if (session.isTenant && session.tenantId) {
    return `tenant_${session.tenantId}_${baseKey}`;
  }
  return baseKey;
};

export const getStoreCollectionRef = (
  db: Firestore,
  baseName: string,
  adminStoreId: string
): CollectionReference => {
  const path = getCollectionPath(baseName);
  if (path.startsWith('tenants/')) {
    const [, tenantId, collName] = path.split('/');
    return collection(db, 'tenants', tenantId, collName);
  }
  return collection(db, 'stores', adminStoreId, baseName);
};

export const getStoreDocRef = (
  db: Firestore,
  baseName: string,
  docId: string,
  adminStoreId: string
): DocumentReference => {
  const path = getCollectionPath(baseName);
  if (path.startsWith('tenants/')) {
    const [, tenantId, collName] = path.split('/');
    return doc(db, 'tenants', tenantId, collName, docId);
  }
  return doc(db, 'stores', adminStoreId, baseName, docId);
};
