import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  auth, 
  db, 
  signInWithGoogle, 
  signInWithGoogleRedirect,
  signInAnonymouslyUser,
  checkRedirectResult,
  logOut, 
  onAuthStateChanged, 
  type User,
  OperationType,
  handleFirestoreError,
  testConnection
} from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  getDocs,
  getDoc
} from 'firebase/firestore';
import type { 
  Merchant, 
  Product, 
  Invoice, 
  Payment, 
  WorkOrder,
  OrderItem,
  OrderStatus,
  InvoiceItem,
  PersonalContact, 
  PersonalTransaction,
  MerchantBalance,
  MonthSummary,
  Expense,
  ExpenseCategory
} from '../types';
import { 
  getCurrentMonthKey, 
  getMonthKeyFromDate, 
  formatMonthName,
  getTodayDateString,
  generateInvoiceNumber
} from '../utils/formatters';

interface AppContextType {
  currentUser: User | null;
  authLoading: boolean;
  cloudConnected: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  currency: string;
  setCurrency: (c: string) => void;
  storeName: string;
  setStoreName: (s: string) => void;
  
  // Theme Dark / Light mode
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  
  // Data
  merchants: Merchant[];
  products: Product[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  orders: WorkOrder[];
  pendingOrdersCount: number;
  personalContacts: PersonalContact[];
  personalTransactions: PersonalTransaction[];

  // Summaries & Calculations
  currentMonthSummary: MonthSummary;
  allMonthsArchive: MonthSummary[];
  merchantBalances: Record<string, MerchantBalance>;
  totalAllTimeDebt: number;
  totalAllTimeSales: number;
  totalAllTimeCollections: number;
  totalAllTimeExpenses: number;
  totalAllTimeNetCollections: number;
  debtorMerchantsCount: number;
  
  // Personal finance stats
  personalStats: {
    totalWithdrawals: number;
    totalDeposits: number;
    netBalance: number;
  };

  // Actions
  loginWithGoogle: () => Promise<void>;
  loginWithGoogleRedirect: () => Promise<void>;
  loginAnonymously: () => Promise<void>;
  logoutUser: () => Promise<void>;
  
  // Merchants CRUD
  saveMerchant: (merchant: Omit<Merchant, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<string>;
  removeMerchant: (id: string) => Promise<void>;

  // Products CRUD
  saveProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<string>;
  removeProduct: (id: string) => Promise<void>;

  // Invoices CRUD
  saveInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, autoAddPayment?: boolean) => Promise<string>;
  removeInvoice: (id: string) => Promise<void>;

  // Payments CRUD
  savePayment: (payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<string>;
  removePayment: (id: string) => Promise<void>;

  // Expenses CRUD (مسحوبات ومصروفات تقلل صافي التحصيل)
  saveExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<string>;
  removeExpense: (id: string) => Promise<void>;

  // Work Orders CRUD & Delivery
  saveWorkOrder: (order: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<WorkOrder>;
  removeWorkOrder: (id: string) => Promise<void>;
  deliverWorkOrder: (
    orderId: string, 
    deliveryItems: { itemId: string; quantityToDeliver: number }[], 
    paymentType: 'debt' | 'paid_full' | 'paid_partial', 
    paidAmountInput?: number, 
    notes?: string,
    fallbackOrder?: WorkOrder
  ) => Promise<{ invoiceId: string; newStatus: OrderStatus; invoice?: Invoice }>;

  // Personal Contacts CRUD
  savePersonalContact: (contact: Omit<PersonalContact, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<string>;
  removePersonalContact: (id: string) => Promise<void>;

  // Personal Transactions CRUD
  savePersonalTransaction: (tx: Omit<PersonalTransaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<string>;
  removePersonalTransaction: (id: string) => Promise<void>;

  // Notifications
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // Data management
  exportDataJSON: () => string;
  importDataJSON: (jsonStr: string) => Promise<boolean>;
  refreshFromCloud: () => Promise<void>;

  // Security Lock & PIN
  isLocked: boolean;
  unlockSystem: () => void;
  lockSystem: () => void;
  systemPin: string;
  updateSystemPin: (newPin: string) => Promise<void>;
  isPinEnabled: boolean;
  togglePinEnabled: (enabled: boolean) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEYS = {
  merchants: 'account_app_merchants',
  products: 'account_app_products',
  invoices: 'account_app_invoices',
  payments: 'account_app_payments',
  expenses: 'account_app_expenses',
  orders: 'account_app_orders',
  personalContacts: 'account_app_personal_contacts',
  personalTransactions: 'account_app_personal_transactions',
  currency: 'account_app_currency',
  storeName: 'account_app_store_name',
  theme: 'account_app_theme',
};

// Dedicated SmartScanner cloud store identifier in Firebase Firestore
export const SMARTSCANNER_STORE_ID = 'smartscanner_main_store';
export const SHARED_STORE_ID = SMARTSCANNER_STORE_ID;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cloudConnected, setCloudConnected] = useState(false);
  
  // Theme state (Dark Mode / Light Mode)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.theme) === 'dark';
    } catch {
      return false;
    }
  });

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEYS.theme, next ? 'dark' : 'light');
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Security Lock & PIN State
  const [systemPin, setSystemPin] = useState<string>(() => {
    try {
      return localStorage.getItem('account_app_system_pin') || '1999';
    } catch {
      return '1999';
    }
  });

  const [isPinEnabled, setIsPinEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('account_app_pin_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      const enabled = localStorage.getItem('account_app_pin_enabled') !== 'false';
      if (!enabled) return false;
      return localStorage.getItem('account_app_pin_verified') !== 'true';
    } catch {
      return false;
    }
  });

  const unlockSystem = useCallback(() => {
    try {
      localStorage.setItem('account_app_pin_verified', 'true');
    } catch {}
    setIsLocked(false);
  }, []);

  const lockSystem = useCallback(() => {
    try {
      localStorage.removeItem('account_app_pin_verified');
    } catch {}
    setIsLocked(true);
  }, []);

  const updateSystemPin = useCallback(async (newPin: string) => {
    const cleanPin = (newPin || '').trim();
    if (!cleanPin) return;
    setSystemPin(cleanPin);
    try {
      localStorage.setItem('account_app_system_pin', cleanPin);
    } catch {}
    try {
      await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'config', 'security'), {
        pin: cleanPin,
        isPinEnabled: true,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn("Save PIN to Firestore error:", e);
    }
  }, []);

  const togglePinEnabled = useCallback(async (enabled: boolean) => {
    setIsPinEnabled(enabled);
    try {
      localStorage.setItem('account_app_pin_enabled', enabled ? 'true' : 'false');
      if (!enabled) {
        setIsLocked(false);
      }
    } catch {}
    try {
      await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'config', 'security'), {
        isPinEnabled: enabled,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn("Save PIN enabled to Firestore error:", e);
    }
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const [currency, setCurrency] = useState<string>('ج.م');
  const [storeName, setStoreName] = useState<string>('Ahmed And Hamdy');

  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [personalContacts, setPersonalContacts] = useState<PersonalContact[]>([]);
  const [personalTransactions, setPersonalTransactions] = useState<PersonalTransaction[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 3000);
  }, []);

  // 1. Initial local load (Strictly sanitizing any mock sample data)
  useEffect(() => {
    try {
      const storedCurr = localStorage.getItem(STORAGE_KEYS.currency);
      if (storedCurr) setCurrency(storedCurr);

      const storedStore = localStorage.getItem(STORAGE_KEYS.storeName);
      if (storedStore) setStoreName(storedStore);

      const m = localStorage.getItem(STORAGE_KEYS.merchants);
      if (m) {
        const parsed: Merchant[] = JSON.parse(m);
        // Exclude fake sample merchants (الحاج محمود, أبو كريم, محلات النور)
        const clean = parsed.filter(item => 
          item.id !== 'm_1' && item.id !== 'm_2' && item.id !== 'm_3' &&
          !item.name.includes('الحاج محمود') && !item.name.includes('التاجر أبو كريم')
        );
        setMerchants(clean);
      } else {
        setMerchants([]);
      }

      const p = localStorage.getItem(STORAGE_KEYS.products);
      if (p) {
        const parsed: Product[] = JSON.parse(p);
        const clean = parsed.filter(item => item.id !== 'prod_1' && item.id !== 'prod_2' && item.id !== 'prod_3' && item.id !== 'prod_4');
        setProducts(clean);
      } else {
        setProducts([]);
      }

      const inv = localStorage.getItem(STORAGE_KEYS.invoices);
      setInvoices(inv ? JSON.parse(inv) : []);

      const pay = localStorage.getItem(STORAGE_KEYS.payments);
      setPayments(pay ? JSON.parse(pay) : []);

      const exp = localStorage.getItem(STORAGE_KEYS.expenses);
      setExpenses(exp ? JSON.parse(exp) : []);

      const ord = localStorage.getItem(STORAGE_KEYS.orders);
      setOrders(ord ? JSON.parse(ord) : []);

      const pc = localStorage.getItem(STORAGE_KEYS.personalContacts);
      if (pc) {
        const parsed: PersonalContact[] = JSON.parse(pc);
        const clean = parsed.filter(item => item.id !== 'pc_1');
        setPersonalContacts(clean);
      } else {
        setPersonalContacts([]);
      }

      const pt = localStorage.getItem(STORAGE_KEYS.personalTransactions);
      setPersonalTransactions(pt ? JSON.parse(pt) : []);
    } catch (e) {
      console.error("Local storage load error:", e);
    }
  }, []);

  // Sync to local storage for instant offline resilience
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.currency, currency);
    localStorage.setItem(STORAGE_KEYS.storeName, storeName);
    localStorage.setItem(STORAGE_KEYS.merchants, JSON.stringify(merchants));
    localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
    localStorage.setItem(STORAGE_KEYS.invoices, JSON.stringify(invoices));
    localStorage.setItem(STORAGE_KEYS.payments, JSON.stringify(payments));
    localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(expenses));
    localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
    localStorage.setItem(STORAGE_KEYS.personalContacts, JSON.stringify(personalContacts));
    localStorage.setItem(STORAGE_KEYS.personalTransactions, JSON.stringify(personalTransactions));
  }, [currency, storeName, merchants, products, invoices, payments, expenses, orders, personalContacts, personalTransactions]);

  // 2. Auth listener & Auto Anonymous Sign-In on boot
  useEffect(() => {
    testConnection().then((ok) => setCloudConnected(ok));

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setCloudConnected(true);
        setAuthLoading(false);
      } else {
        // Automatically authenticate anonymously so all devices sync without manual clicks
        try {
          const anonUser = await signInAnonymouslyUser();
          setCurrentUser(anonUser);
          setCloudConnected(true);
        } catch (e) {
          console.error("Auto sign-in error:", e);
        } finally {
          setAuthLoading(false);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 3. Attach Unified Shared Store Firestore Subscriptions
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const setupStoreListener = <T extends { id: string }>(
      subcoll: string, 
      setter: React.Dispatch<React.SetStateAction<T[]>>, 
      storageKey: string,
      filterClean?: (items: T[]) => T[]
    ) => {
      const colRef = collection(db, 'stores', SHARED_STORE_ID, subcoll);
      const unsub = onSnapshot(colRef, (snapshot) => {
        let items: T[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as T);
        });
        if (filterClean) {
          items = filterClean(items);
        }
        setter(items);
        try {
          localStorage.setItem(storageKey, JSON.stringify(items));
        } catch {}
      }, (err) => {
        console.warn(`Shared store listener warning on ${subcoll}:`, err);
      });
      unsubs.push(unsub);
    };

    setupStoreListener<Merchant>('merchants', setMerchants, STORAGE_KEYS.merchants, (items) =>
      items.filter(m => m.id !== 'm_1' && m.id !== 'm_2' && m.id !== 'm_3')
    );
    setupStoreListener<Product>('products', setProducts, STORAGE_KEYS.products, (items) =>
      items.filter(p => p.id !== 'prod_1' && p.id !== 'prod_2' && p.id !== 'prod_3' && p.id !== 'prod_4')
    );
    setupStoreListener<Invoice>('invoices', setInvoices, STORAGE_KEYS.invoices);
    setupStoreListener<Payment>('payments', setPayments, STORAGE_KEYS.payments);
    setupStoreListener<Expense>('expenses', setExpenses, STORAGE_KEYS.expenses);
    setupStoreListener<WorkOrder>('orders', setOrders, STORAGE_KEYS.orders);
    setupStoreListener<PersonalContact>('personal_contacts', setPersonalContacts, STORAGE_KEYS.personalContacts);
    setupStoreListener<PersonalTransaction>('personal_transactions', setPersonalTransactions, STORAGE_KEYS.personalTransactions);

    // Real-time security PIN & config subscription
    const secDocRef = doc(db, 'stores', SHARED_STORE_ID, 'config', 'security');
    const unsubSec = onSnapshot(secDocRef, (snap) => {
      if (snap.exists()) {
        const secData = snap.data();
        if (secData?.pin) {
          const pinStr = String(secData.pin).trim();
          setSystemPin(pinStr);
          try {
            localStorage.setItem('account_app_system_pin', pinStr);
          } catch {}
        }
        if (typeof secData?.isPinEnabled === 'boolean') {
          setIsPinEnabled(secData.isPinEnabled);
          try {
            localStorage.setItem('account_app_pin_enabled', secData.isPinEnabled ? 'true' : 'false');
            if (!secData.isPinEnabled) {
              setIsLocked(false);
            }
          } catch {}
        }
      }
    }, (err) => {
      console.warn("Security config listener warning:", err);
    });
    unsubs.push(unsubSec);

    // Seamless one-time migration from legacy 'ahmed_and_hamdy' to 'smartscanner_main_store' if newly initialized
    const checkAndMigrateLegacyStore = async () => {
      try {
        const testSnap = await getDocs(collection(db, 'stores', SMARTSCANNER_STORE_ID, 'invoices'));
        if (testSnap.empty) {
          const collectionsToMigrate = ['merchants', 'products', 'invoices', 'payments', 'expenses', 'orders', 'personal_contacts', 'personal_transactions'];
          for (const collName of collectionsToMigrate) {
            const legacySnap = await getDocs(collection(db, 'stores', 'ahmed_and_hamdy', collName));
            for (const docItem of legacySnap.docs) {
              await setDoc(doc(db, 'stores', SMARTSCANNER_STORE_ID, collName, docItem.id), docItem.data(), { merge: true });
            }
          }
        }
      } catch (err) {
        console.warn("Legacy store migration check notice:", err);
      }
    };

    checkAndMigrateLegacyStore();

    return () => {
      unsubs.forEach(fn => fn());
    };
  }, []);

  // Migrate all local state to Firebase Firestore shared store
  const migrateLocalDataToCloud = async (_uid?: string) => {
    try {
      for (const m of merchants) {
        if (m.id !== 'm_1' && m.id !== 'm_2' && m.id !== 'm_3') {
          await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'merchants', m.id), m, { merge: true });
        }
      }
      for (const p of products) {
        if (p.id !== 'prod_1' && p.id !== 'prod_2') {
          await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'products', p.id), p, { merge: true });
        }
      }
      for (const inv of invoices) await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'invoices', inv.id), inv, { merge: true });
      for (const pay of payments) await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'payments', pay.id), pay, { merge: true });
      for (const exp of expenses) await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'expenses', exp.id), exp, { merge: true });
      for (const ord of orders) await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'orders', ord.id), ord, { merge: true });
      for (const c of personalContacts) await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'personal_contacts', c.id), c, { merge: true });
      for (const tx of personalTransactions) await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'personal_transactions', tx.id), tx, { merge: true });
    } catch (e) {
      console.warn("Migration warning:", e);
    }
  };

  // Auth actions
  const loginWithGoogle = async () => {
    try {
      const user = await signInWithGoogle();
      setCurrentUser(user);
      setCloudConnected(true);
      if (user) {
        await migrateLocalDataToCloud(user.uid);
      }
    } catch (e) {
      console.error("Login with Google failed:", e);
      throw e;
    }
  };

  const loginWithGoogleRedirect = async () => {
    await signInWithGoogleRedirect();
  };

  const loginAnonymously = async () => {
    try {
      const user = await signInAnonymouslyUser();
      setCurrentUser(user);
      setCloudConnected(true);
      if (user) {
        await migrateLocalDataToCloud(user.uid);
      }
    } catch (e) {
      console.error("Anonymous cloud login failed:", e);
      throw e;
    }
  };

  const logoutUser = async () => {
    await logOut();
    setCurrentUser(null);
  };

  // Direct manual and boot fetch from Cloud Firestore
  const refreshFromCloud = async () => {
    try {
      showToast('جاري سحب وتحديث البيانات من السحابة... ⏳');
      const mSnap = await getDocs(collection(db, 'stores', SHARED_STORE_ID, 'merchants'));
      const mItems: Merchant[] = [];
      mSnap.forEach(d => mItems.push({ id: d.id, ...d.data() } as Merchant));
      const cleanM = mItems.filter(m => m.id !== 'm_1' && m.id !== 'm_2' && m.id !== 'm_3');
      setMerchants(cleanM);
      localStorage.setItem(STORAGE_KEYS.merchants, JSON.stringify(cleanM));

      const invSnap = await getDocs(collection(db, 'stores', SHARED_STORE_ID, 'invoices'));
      const invItems: Invoice[] = [];
      invSnap.forEach(d => invItems.push({ id: d.id, ...d.data() } as Invoice));
      setInvoices(invItems);
      localStorage.setItem(STORAGE_KEYS.invoices, JSON.stringify(invItems));

      const paySnap = await getDocs(collection(db, 'stores', SHARED_STORE_ID, 'payments'));
      const payItems: Payment[] = [];
      paySnap.forEach(d => payItems.push({ id: d.id, ...d.data() } as Payment));
      setPayments(payItems);
      localStorage.setItem(STORAGE_KEYS.payments, JSON.stringify(payItems));

      const pSnap = await getDocs(collection(db, 'stores', SHARED_STORE_ID, 'products'));
      const pItems: Product[] = [];
      pSnap.forEach(d => pItems.push({ id: d.id, ...d.data() } as Product));
      const cleanP = pItems.filter(p => p.id !== 'prod_1' && p.id !== 'prod_2' && p.id !== 'prod_3' && p.id !== 'prod_4');
      setProducts(cleanP);
      localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(cleanP));

      const expSnap = await getDocs(collection(db, 'stores', SHARED_STORE_ID, 'expenses'));
      const expItems: Expense[] = [];
      expSnap.forEach(d => expItems.push({ id: d.id, ...d.data() } as Expense));
      setExpenses(expItems);
      localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(expItems));

      const ordSnap = await getDocs(collection(db, 'stores', SHARED_STORE_ID, 'orders'));
      const ordItems: WorkOrder[] = [];
      ordSnap.forEach(d => ordItems.push({ id: d.id, ...d.data() } as WorkOrder));
      setOrders(ordItems);
      localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(ordItems));

      // Fetch security config
      try {
        const secSnap = await getDoc(doc(db, 'stores', SHARED_STORE_ID, 'config', 'security'));
        if (secSnap.exists()) {
          const secData = secSnap.data();
          if (secData?.pin) {
            const pinStr = String(secData.pin).trim();
            setSystemPin(pinStr);
            localStorage.setItem('account_app_system_pin', pinStr);
          }
          if (typeof secData?.isPinEnabled === 'boolean') {
            setIsPinEnabled(secData.isPinEnabled);
            localStorage.setItem('account_app_pin_enabled', secData.isPinEnabled ? 'true' : 'false');
          }
        }
      } catch (err) {
        console.warn("Security fetch warning in refreshFromCloud:", err);
      }

      showToast(`تمت المزامنة بنجاح! متصل بسحابة المحل الموحدة ☁️`);
    } catch (e) {
      console.warn("Refresh from cloud error:", e);
    }
  };

  // --- MERCHANTS CRUD ---
  const saveMerchant = async (data: Omit<Merchant, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const now = new Date().toISOString();
    const id = data.id || `m_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: Merchant = {
      id,
      name: data.name.trim(),
      phone: data.phone || '',
      address: data.address || '',
      notes: data.notes || '',
      createdAt: (data as any).createdAt || now,
      updatedAt: now,
    };

    setMerchants(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = record;
        return updated;
      }
      return [record, ...prev];
    });

    try {
      await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'merchants', id), record, { merge: true });
    } catch (err) {
      console.warn("Save merchant warning:", err);
    }
    return id;
  };

  const removeMerchant = async (id: string) => {
    setMerchants(prev => prev.filter(m => m.id !== id));
    try {
      await deleteDoc(doc(db, 'stores', SHARED_STORE_ID, 'merchants', id));
    } catch (err) {
      console.warn("Delete merchant warning:", err);
    }
  };

  // --- PRODUCTS CRUD ---
  const saveProduct = async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const now = new Date().toISOString();
    const id = data.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: Product = {
      id,
      name: data.name.trim(),
      price: Number(data.price) || 0,
      costPrice: data.costPrice ? Number(data.costPrice) : null,
      unit: data.unit || 'قطعة',
      notes: data.notes || '',
      createdAt: (data as any).createdAt || now,
      updatedAt: now,
    };

    setProducts(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = record;
        return updated;
      }
      return [record, ...prev];
    });

    try {
      await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'products', id), record, { merge: true });
    } catch (err) {
      console.warn("Save product warning:", err);
    }
    return id;
  };

  const removeProduct = async (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    try {
      await deleteDoc(doc(db, 'stores', SHARED_STORE_ID, 'products', id));
    } catch (err) {
      console.warn("Delete product warning:", err);
    }
  };

  // --- INVOICES CRUD ---
  const saveInvoice = async (
    data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    autoAddPayment = true
  ) => {
    const now = new Date().toISOString();
    const id = data.id || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const monthKey = data.monthKey || getMonthKeyFromDate(data.date);

    const record: Invoice = {
      id,
      invoiceNumber: data.invoiceNumber || `فاتورة-${Date.now().toString().slice(-4)}`,
      merchantId: data.merchantId || '',
      merchantName: data.merchantName || '',
      date: data.date,
      monthKey,
      items: (data.items || []).map(it => ({
        id: it.id || `inv_it_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: it.productId || '',
        productName: it.productName || '',
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        total: Number(it.total) || 0,
      })),
      subtotal: Number(data.subtotal) || 0,
      discountType: data.discountType || 'amount',
      discountValue: Number(data.discountValue) || 0,
      discount: Number(data.discount) || 0,
      total: Number(data.total) || 0,
      paidAmount: Number(data.paidAmount) || 0,
      remainingAmount: Number(data.remainingAmount) || 0,
      notes: data.notes || '',
      orderId: data.orderId || '',
      createdAt: (data as any).createdAt || now,
      updatedAt: now,
    };

    setInvoices(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = record;
        return updated;
      }
      return [record, ...prev];
    });

    try {
      await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'invoices', id), record, { merge: true });
    } catch (err) {
      console.warn("Save invoice warning:", err);
    }

    // Keep linked payment strictly synchronized with invoice paidAmount
    if (autoAddPayment) {
      const existingLinkedPay = payments.find(p => p.invoiceId === record.id);
      if (record.paidAmount > 0) {
        await savePayment({
          ...(existingLinkedPay ? { id: existingLinkedPay.id } : {}),
          merchantId: record.merchantId,
          merchantName: record.merchantName,
          amount: record.paidAmount,
          date: record.date,
          monthKey: record.monthKey,
          paymentMethod: 'كاش',
          notes: `دفعة نقدية مسددة عند استلام الفاتورة رقم ${record.invoiceNumber}`,
          invoiceId: record.id,
        });
      } else if (existingLinkedPay) {
        // If invoice was updated to unpaid/debt, remove the linked payment to keep merchant ledger pure!
        await removePayment(existingLinkedPay.id);
      }
    }

    return id;
  };

  const removeInvoice = async (id: string) => {
    const inv = invoices.find(item => item.id === id);

    // 1. Remove the invoice from state and Firestore
    setInvoices(prev => prev.filter(item => item.id !== id));
    try {
      await deleteDoc(doc(db, 'stores', SHARED_STORE_ID, 'invoices', id));
    } catch (err) {
      console.warn("Delete invoice warning:", err);
    }

    // 2. Remove any linked payment created alongside this invoice
    const linkedPayments = payments.filter(p => p.invoiceId === id);
    if (linkedPayments.length > 0) {
      setPayments(prev => prev.filter(p => p.invoiceId !== id));
      for (const lp of linkedPayments) {
        try {
          await deleteDoc(doc(db, 'stores', SHARED_STORE_ID, 'payments', lp.id));
        } catch (e) {
          console.warn("Delete linked payment error:", e);
        }
      }
    }

    // 3. Rollback delivered quantities on the linked Work Order if this invoice came from an order
    if (inv?.orderId) {
      const order = orders.find(o => o.id === inv.orderId);
      if (order) {
        const revertedItems = order.items.map(it => {
          const invItem = inv.items.find(it2 => it2.productId === it.productId || it2.productName === it.productName);
          const deliveredInInv = invItem ? invItem.quantity : 0;
          const newDelivered = Math.max(0, it.quantityDelivered - deliveredInInv);
          const newRemaining = Math.max(0, it.quantityOrdered - newDelivered);
          return {
            ...it,
            quantityDelivered: newDelivered,
            quantityRemaining: newRemaining,
          };
        });
        const someDelivered = revertedItems.some(it => it.quantityDelivered > 0);
        const allDelivered = revertedItems.every(it => it.quantityRemaining === 0);
        const newStatus: OrderStatus = allDelivered ? 'delivered' : someDelivered ? 'partially_delivered' : 'pending';
        const newDeliveredTotal = Math.max(0, (order.deliveredTotalAmount || 0) - inv.total);

        const updatedOrder: WorkOrder = {
          ...order,
          items: revertedItems,
          status: newStatus,
          deliveredTotalAmount: newDeliveredTotal,
          updatedAt: new Date().toISOString(),
        };
        setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
        try {
          await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'orders', order.id), updatedOrder, { merge: true });
        } catch (e) {
          console.warn("Rollback order error:", e);
        }
      }
    }
  };

  // --- PAYMENTS CRUD ---
  const savePayment = async (data: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const now = new Date().toISOString();
    const id = data.id || `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const monthKey = data.monthKey || getMonthKeyFromDate(data.date);

    const record: Payment = {
      id,
      merchantId: data.merchantId,
      merchantName: data.merchantName,
      amount: Number(data.amount) || 0,
      date: data.date,
      monthKey,
      paymentMethod: data.paymentMethod || 'كاش',
      notes: data.notes || '',
      invoiceId: data.invoiceId || '',
      receiptNumber: data.receiptNumber || `سند-${Date.now().toString().slice(-4)}`,
      createdAt: (data as any).createdAt || now,
      updatedAt: now,
    };

    setPayments(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = record;
        return updated;
      }
      return [record, ...prev];
    });

    try {
      await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'payments', id), record, { merge: true });
    } catch (err) {
      console.warn("Save payment warning:", err);
    }
    return id;
  };

  const removePayment = async (id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
    try {
      await deleteDoc(doc(db, 'stores', SHARED_STORE_ID, 'payments', id));
    } catch (err) {
      console.warn("Delete payment warning:", err);
    }
  };

  // --- EXPENSES & CASH WITHDRAWALS CRUD ---
  const saveExpense = async (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const now = new Date().toISOString();
    const id = data.id || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const monthKey = data.monthKey || getMonthKeyFromDate(data.date);

    const record: Expense = {
      id,
      title: data.title.trim(),
      category: data.category,
      amount: Number(data.amount) || 0,
      date: data.date,
      monthKey,
      paymentMethod: data.paymentMethod || 'كاش',
      notes: data.notes ? data.notes.trim() : '',
      createdAt: (data as any).createdAt || now,
      updatedAt: now,
    };

    setExpenses(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = record;
        return updated;
      }
      return [record, ...prev];
    });

    try {
      await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'expenses', id), record, { merge: true });
    } catch (err) {
      console.warn("Save expense warning:", err);
    }
    return id;
  };

  const removeExpense = async (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    try {
      await deleteDoc(doc(db, 'stores', SHARED_STORE_ID, 'expenses', id));
    } catch (err) {
      console.warn("Delete expense warning:", err);
    }
  };

  // --- WORK ORDERS CRUD & DELIVERY ---
  const saveWorkOrder = async (data: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<WorkOrder> => {
    const now = new Date().toISOString();
    const id = data.id || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const monthKey = data.monthKey || getMonthKeyFromDate(data.date);

    const sanitizedItems: OrderItem[] = (data.items || []).map(it => ({
      id: it.id || `ord_it_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      productId: it.productId || '',
      productName: it.productName || '',
      unitPrice: Number(it.unitPrice) || 0,
      quantityOrdered: Number(it.quantityOrdered) || 0,
      quantityDelivered: Number(it.quantityDelivered) || 0,
      quantityRemaining: Number(it.quantityRemaining) || 0,
      unit: it.unit || '',
    }));

    const record: WorkOrder = {
      id,
      orderNumber: data.orderNumber || `طلب-${Date.now().toString().slice(-4)}`,
      merchantId: data.merchantId || '',
      merchantName: data.merchantName || '',
      date: data.date,
      monthKey,
      items: sanitizedItems,
      status: data.status || 'pending',
      totalEstimatedAmount: Number(data.totalEstimatedAmount) || 0,
      deliveredTotalAmount: Number(data.deliveredTotalAmount) || 0,
      notes: data.notes || '',
      createdAt: (data as any).createdAt || now,
      updatedAt: now,
    };

    setOrders(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = record;
        return updated;
      }
      return [record, ...prev];
    });

    try {
      await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'orders', id), record, { merge: true });
    } catch (err) {
      console.warn("Save order warning:", err);
    }
    return record;
  };

  const removeWorkOrder = async (id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
    try {
      await deleteDoc(doc(db, 'stores', SHARED_STORE_ID, 'orders', id));
    } catch (err) {
      console.warn("Delete order warning:", err);
    }
  };

  const deliverWorkOrder = async (
    orderId: string,
    deliveryItems: { itemId: string; quantityToDeliver: number }[],
    paymentType: 'debt' | 'paid_full' | 'paid_partial',
    paidAmountInput?: number,
    notes?: string,
    fallbackOrder?: WorkOrder
  ): Promise<{ invoiceId: string; newStatus: OrderStatus; invoice?: Invoice }> => {
    const order = fallbackOrder || orders.find(o => o.id === orderId);
    if (!order) throw new Error('Order not found');

    const now = new Date().toISOString();
    const invoiceItems: InvoiceItem[] = [];
    let batchDeliveryTotal = 0;

    // Clone items and update delivered & remaining quantities
    const updatedItems: OrderItem[] = order.items.map(item => {
      const delivery = deliveryItems.find(d => d.itemId === item.id);
      const qtyNow = delivery ? Math.min(Math.max(0, delivery.quantityToDeliver), item.quantityRemaining) : 0;
      
      if (qtyNow > 0) {
        const lineTotal = qtyNow * item.unitPrice;
        batchDeliveryTotal += lineTotal;
        invoiceItems.push({
          id: `inv_it_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          productId: item.productId || '',
          productName: item.productName,
          quantity: qtyNow,
          unitPrice: item.unitPrice,
          total: lineTotal,
        });
      }

      const newDelivered = item.quantityDelivered + qtyNow;
      const newRemaining = Math.max(0, item.quantityOrdered - newDelivered);

      return {
        ...item,
        productId: item.productId || '',
        unit: item.unit || '',
        quantityDelivered: newDelivered,
        quantityRemaining: newRemaining,
      };
    });

    if (invoiceItems.length === 0) {
      throw new Error('يرجى تحديد كمية للتسليم (أكبر من صفر)');
    }

    // Calculate new status
    const hasRemaining = updatedItems.some(it => it.quantityRemaining > 0);
    const newStatus: OrderStatus = hasRemaining ? 'partially_delivered' : 'delivered';
    const newDeliveredTotal = (order.deliveredTotalAmount || 0) + batchDeliveryTotal;

    // Update order record
    const updatedOrder: WorkOrder = {
      ...order,
      items: updatedItems,
      status: newStatus,
      deliveredTotalAmount: newDeliveredTotal,
      updatedAt: now,
    };

    // Determine invoice payment amounts
    let paidAmount = 0;
    if (paymentType === 'paid_full') {
      paidAmount = batchDeliveryTotal;
    } else if (paymentType === 'paid_partial') {
      paidAmount = Math.min(Number(paidAmountInput) || 0, batchDeliveryTotal);
    }
    const remainingDebt = Math.max(0, batchDeliveryTotal - paidAmount);

    // Automatically record sales invoice for this delivery batch
    const invData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = {
      invoiceNumber: generateInvoiceNumber(invoices.length),
      merchantId: order.merchantId || '',
      merchantName: order.merchantName || '',
      date: getTodayDateString(),
      monthKey: getMonthKeyFromDate(getTodayDateString()),
      items: invoiceItems,
      subtotal: batchDeliveryTotal,
      discountType: 'amount',
      discountValue: 0,
      discount: 0,
      total: batchDeliveryTotal,
      paidAmount,
      remainingAmount: remainingDebt,
      notes: notes 
        ? `تسليم من طلب الشغل #${order.orderNumber}: ${notes}` 
        : `تسليم من طلب الشغل #${order.orderNumber} (${newStatus === 'delivered' ? 'تسليم كامل' : 'تسليم جزئي'})`,
      orderId: order.id || '',
    };

    const invoiceId = await saveInvoice(invData, true);

    // Save updated order
    setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));

    try {
      await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'orders', orderId), updatedOrder, { merge: true });
    } catch (err) {
      console.warn("Save delivered order warning:", err);
    }

    const createdInvoice: Invoice = {
      ...invData,
      id: invoiceId,
      createdAt: now,
      updatedAt: now,
    };

    return { invoiceId, newStatus, invoice: createdInvoice };
  };

  const pendingOrdersCount = useMemo(() => {
    return orders.filter(o => o.status === 'pending' || o.status === 'partially_delivered').length;
  }, [orders]);

  // --- PERSONAL CONTACTS CRUD ---
  const savePersonalContact = async (data: Omit<PersonalContact, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const now = new Date().toISOString();
    const id = data.id || `pc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: PersonalContact = {
      id,
      name: data.name.trim(),
      phone: data.phone || '',
      relationship: data.relationship || '',
      notes: data.notes || '',
      createdAt: (data as any).createdAt || now,
      updatedAt: now,
    };

    setPersonalContacts(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = record;
        return updated;
      }
      return [record, ...prev];
    });

    try {
      await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'personal_contacts', id), record, { merge: true });
    } catch (err) {
      console.warn("Save personal contact warning:", err);
    }
    return id;
  };

  const removePersonalContact = async (id: string) => {
    setPersonalContacts(prev => prev.filter(c => c.id !== id));
    try {
      await deleteDoc(doc(db, 'stores', SHARED_STORE_ID, 'personal_contacts', id));
    } catch (err) {
      console.warn("Delete personal contact warning:", err);
    }
  };

  // --- PERSONAL TRANSACTIONS CRUD ---
  const savePersonalTransaction = async (data: Omit<PersonalTransaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const now = new Date().toISOString();
    const id = data.id || `pt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const monthKey = data.monthKey || getMonthKeyFromDate(data.date);

    const record: PersonalTransaction = {
      id,
      contactId: data.contactId || '',
      contactName: data.contactName || '',
      type: data.type,
      amount: Number(data.amount) || 0,
      date: data.date,
      monthKey,
      notes: data.notes || '',
      createdAt: (data as any).createdAt || now,
      updatedAt: now,
    };

    setPersonalTransactions(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = record;
        return updated;
      }
      return [record, ...prev];
    });

    try {
      await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'personal_transactions', id), record, { merge: true });
    } catch (err) {
      console.warn("Save personal transaction warning:", err);
    }
    return id;
  };

  const removePersonalTransaction = async (id: string) => {
    setPersonalTransactions(prev => prev.filter(tx => tx.id !== id));
    try {
      await deleteDoc(doc(db, 'stores', SHARED_STORE_ID, 'personal_transactions', id));
    } catch (err) {
      console.warn("Delete personal transaction warning:", err);
    }
  };

  // --- CALCULATIONS & STATS ---

  // Merchant balances across all time & for selected month
  const merchantBalances = useMemo(() => {
    const map: Record<string, MerchantBalance> = {};

    merchants.forEach(m => {
      map[m.id] = {
        merchantId: m.id,
        merchantName: m.name,
        totalInvoicedAllTime: 0,
        totalPaidAllTime: 0,
        currentDebt: 0,
        monthInvoiced: 0,
        monthPaid: 0,
        carriedDebt: 0,
      };
    });

    // Helper to find canonical merchant ID by ID or by name
    const findCanonicalId = (targetId?: string, targetName?: string): string => {
      if (targetId && merchants.some(m => m.id === targetId)) {
        return targetId;
      }
      if (targetName && targetName.trim()) {
        const foundByName = merchants.find(m => m.name.trim().toLowerCase() === targetName.trim().toLowerCase());
        if (foundByName) return foundByName.id;
      }
      if (targetId && targetId.trim()) {
        const foundByName = merchants.find(m => m.name.trim().toLowerCase() === targetId.trim().toLowerCase());
        if (foundByName) return foundByName.id;
      }
      return targetId || targetName || 'unknown_merchant';
    };

    invoices.forEach(inv => {
      const canonicalId = findCanonicalId(inv.merchantId, inv.merchantName);
      if (!map[canonicalId]) {
        map[canonicalId] = {
          merchantId: canonicalId,
          merchantName: inv.merchantName || 'تاجر غير محدد',
          totalInvoicedAllTime: 0,
          totalPaidAllTime: 0,
          currentDebt: 0,
          monthInvoiced: 0,
          monthPaid: 0,
          carriedDebt: 0,
        };
      }
      const b = map[canonicalId];
      b.totalInvoicedAllTime += (inv.total || 0);

      const invMonth = inv.monthKey || getMonthKeyFromDate(inv.date);
      if (invMonth === selectedMonth) {
        b.monthInvoiced += (inv.total || 0);
      } else if (invMonth < selectedMonth) {
        b.carriedDebt += (inv.total || 0);
      }
    });

    payments.forEach(pay => {
      const canonicalId = findCanonicalId(pay.merchantId, pay.merchantName);
      if (!map[canonicalId]) {
        map[canonicalId] = {
          merchantId: canonicalId,
          merchantName: pay.merchantName || 'تاجر غير محدد',
          totalInvoicedAllTime: 0,
          totalPaidAllTime: 0,
          currentDebt: 0,
          monthInvoiced: 0,
          monthPaid: 0,
          carriedDebt: 0,
        };
      }
      const b = map[canonicalId];
      b.totalPaidAllTime += (pay.amount || 0);

      const payMonth = pay.monthKey || getMonthKeyFromDate(pay.date);
      if (payMonth === selectedMonth) {
        b.monthPaid += (pay.amount || 0);
      } else if (payMonth < selectedMonth) {
        b.carriedDebt -= (pay.amount || 0);
      }
    });

    // Also include any delivered or debt work orders that don't have a duplicate invoice record in invoices
    orders.forEach(ord => {
      const hasInvoice = invoices.some(inv => inv.orderId === ord.id || (inv.notes && inv.notes.includes(ord.orderNumber)));
      if (!hasInvoice) {
        const orderDebt = ord.status === 'delivered'
          ? (ord.deliveredTotalAmount || ord.totalEstimatedAmount || 0)
          : (ord.deliveredTotalAmount || 0);

        if (orderDebt > 0) {
          const canonicalId = findCanonicalId(ord.merchantId, ord.merchantName);
          if (!map[canonicalId]) {
            map[canonicalId] = {
              merchantId: canonicalId,
              merchantName: ord.merchantName || 'تاجر غير محدد',
              totalInvoicedAllTime: 0,
              totalPaidAllTime: 0,
              currentDebt: 0,
              monthInvoiced: 0,
              monthPaid: 0,
              carriedDebt: 0,
            };
          }
          const b = map[canonicalId];
          b.totalInvoicedAllTime += orderDebt;

          const ordMonth = ord.monthKey || getMonthKeyFromDate(ord.date);
          if (ordMonth === selectedMonth) {
            b.monthInvoiced += orderDebt;
          } else if (ordMonth < selectedMonth) {
            b.carriedDebt += orderDebt;
          }
        }
      }
    });

    // Compute current total debts
    Object.values(map).forEach(b => {
      b.currentDebt = b.totalInvoicedAllTime - b.totalPaidAllTime;
    });

    return map;
  }, [merchants, invoices, payments, orders, selectedMonth]);

  // Overall totals across all time
  const totalAllTimeSales = useMemo(() => {
    const invTotal = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const unbilledOrders = orders
      .filter(ord => !invoices.some(inv => inv.orderId === ord.id || (inv.notes && inv.notes.includes(ord.orderNumber))))
      .reduce((sum, ord) => sum + (ord.status === 'delivered' ? (ord.deliveredTotalAmount || ord.totalEstimatedAmount || 0) : (ord.deliveredTotalAmount || 0)), 0);
    return invTotal + unbilledOrders;
  }, [invoices, orders]);

  const totalAllTimeCollections = useMemo(() => {
    return payments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
  }, [payments]);

  const totalAllTimeExpenses = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  }, [expenses]);

  const totalAllTimeNetCollections = useMemo(() => {
    return totalAllTimeCollections - totalAllTimeExpenses;
  }, [totalAllTimeCollections, totalAllTimeExpenses]);

  const totalAllTimeDebt = useMemo(() => {
    return Object.values(merchantBalances).reduce((sum, b) => sum + Math.max(0, b.currentDebt), 0);
  }, [merchantBalances]);

  // Debtor merchants count (any merchant with currentDebt > 0 across the entire system)
  const debtorMerchantsCount = useMemo(() => {
    return Object.values(merchantBalances).filter(b => b.currentDebt > 0).length;
  }, [merchantBalances]);

  // Current Month Summary with Zero Reset & Carried Balances & Expenses Deduction
  const currentMonthSummary = useMemo<MonthSummary>(() => {
    // 1. Invoices in selected month
    const monthInvs = invoices.filter(inv => {
      const m = inv.monthKey || getMonthKeyFromDate(inv.date);
      return m === selectedMonth;
    });
    const newSales = monthInvs.reduce((sum, inv) => sum + (inv.total || 0), 0);

    // 2. Payments in selected month
    const monthPays = payments.filter(pay => {
      const m = pay.monthKey || getMonthKeyFromDate(pay.date);
      return m === selectedMonth;
    });
    const newCollections = monthPays.reduce((sum, pay) => sum + (pay.amount || 0), 0);

    // 3. Expenses/Withdrawals in selected month
    const monthExps = expenses.filter(exp => {
      const m = exp.monthKey || getMonthKeyFromDate(exp.date);
      return m === selectedMonth;
    });
    const newExpenses = monthExps.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const netCollections = newCollections - newExpenses;

    // 4. Transactions prior to selected month
    const priorInvs = invoices.filter(inv => {
      const m = inv.monthKey || getMonthKeyFromDate(inv.date);
      return m < selectedMonth;
    });
    const priorSales = priorInvs.reduce((sum, inv) => sum + (inv.total || 0), 0);

    const priorPays = payments.filter(pay => {
      const m = pay.monthKey || getMonthKeyFromDate(pay.date);
      return m < selectedMonth;
    });
    const priorCollections = priorPays.reduce((sum, pay) => sum + (pay.amount || 0), 0);

    const carriedForwardDebt = priorSales - priorCollections;
    const netMonthMovement = newSales - newCollections;
    const endingDebt = carriedForwardDebt + netMonthMovement;

    return {
      monthKey: selectedMonth,
      monthName: formatMonthName(selectedMonth),
      newSales,
      newCollections,
      newExpenses,
      netCollections,
      netMonthMovement,
      carriedForwardDebt,
      endingDebt,
      invoicesCount: monthInvs.length,
      paymentsCount: monthPays.length,
      expensesCount: monthExps.length,
    };
  }, [invoices, payments, expenses, selectedMonth]);

  // All Months Archive
  const allMonthsArchive = useMemo<MonthSummary[]>(() => {
    const monthSet = new Set<string>();
    invoices.forEach(inv => monthSet.add(inv.monthKey || getMonthKeyFromDate(inv.date)));
    payments.forEach(pay => monthSet.add(pay.monthKey || getMonthKeyFromDate(pay.date)));
    expenses.forEach(exp => monthSet.add(exp.monthKey || getMonthKeyFromDate(exp.date)));
    monthSet.add(getCurrentMonthKey());
    monthSet.add(selectedMonth);

    const sortedMonths = Array.from(monthSet).filter(Boolean).sort().reverse();

    return sortedMonths.map(mKey => {
      const mInvs = invoices.filter(inv => (inv.monthKey || getMonthKeyFromDate(inv.date)) === mKey);
      const mPays = payments.filter(pay => (pay.monthKey || getMonthKeyFromDate(pay.date)) === mKey);
      const mExps = expenses.filter(exp => (exp.monthKey || getMonthKeyFromDate(exp.date)) === mKey);
      
      const sales = mInvs.reduce((s, i) => s + (i.total || 0), 0);
      const collections = mPays.reduce((s, p) => s + (p.amount || 0), 0);
      const exps = mExps.reduce((s, e) => s + (e.amount || 0), 0);

      // Prior debt
      const priorInvs = invoices.filter(inv => (inv.monthKey || getMonthKeyFromDate(inv.date)) < mKey);
      const priorPays = payments.filter(pay => (pay.monthKey || getMonthKeyFromDate(pay.date)) < mKey);
      const carried = priorInvs.reduce((s, i) => s + (i.total || 0), 0) - priorPays.reduce((s, p) => s + (p.amount || 0), 0);

      return {
        monthKey: mKey,
        monthName: formatMonthName(mKey),
        newSales: sales,
        newCollections: collections,
        newExpenses: exps,
        netCollections: collections - exps,
        netMonthMovement: sales - collections,
        carriedForwardDebt: carried,
        endingDebt: carried + (sales - collections),
        invoicesCount: mInvs.length,
        paymentsCount: mPays.length,
        expensesCount: mExps.length,
      };
    });
  }, [invoices, payments, expenses, selectedMonth]);

  // Personal finance statistics
  const personalStats = useMemo(() => {
    let totalWithdrawals = 0;
    let totalDeposits = 0;

    personalTransactions.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      const isWithdrawal = tx.type === 'withdrawal' || (tx.type as string) === 'loan_given' || (tx.type as string) === 'loan_taken' || (tx.type as string) === 'personal_expense';
      if (isWithdrawal) {
        totalWithdrawals += amt;
      } else {
        totalDeposits += amt;
      }
    });

    return {
      totalWithdrawals,
      totalDeposits,
      netBalance: totalWithdrawals - totalDeposits,
    };
  }, [personalTransactions]);

  // Backup JSON
  const exportDataJSON = useCallback(() => {
    const data = {
      version: '1.2',
      exportedAt: new Date().toISOString(),
      merchants,
      products,
      invoices,
      payments,
      expenses,
      orders,
      personalContacts,
      personalTransactions,
      currency,
    };
    return JSON.stringify(data, null, 2);
  }, [merchants, products, invoices, payments, expenses, orders, personalContacts, personalTransactions, currency]);

  const importDataJSON = useCallback(async (jsonStr: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.merchants) setMerchants(parsed.merchants);
      if (parsed.products) setProducts(parsed.products);
      if (parsed.invoices) setInvoices(parsed.invoices);
      if (parsed.payments) setPayments(parsed.payments);
      if (parsed.expenses) setExpenses(parsed.expenses);
      if (parsed.orders) setOrders(parsed.orders);
      if (parsed.personalContacts) setPersonalContacts(parsed.personalContacts);
      if (parsed.personalTransactions) setPersonalTransactions(parsed.personalTransactions);
      if (parsed.currency) setCurrency(parsed.currency);

      for (const m of parsed.merchants || []) {
        if (m.id !== 'm_1' && m.id !== 'm_2' && m.id !== 'm_3') {
          await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'merchants', m.id), m, { merge: true });
        }
      }
      for (const p of parsed.products || []) {
        if (p.id !== 'prod_1' && p.id !== 'prod_2') {
          await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'products', p.id), p, { merge: true });
        }
      }
      for (const inv of parsed.invoices || []) {
        await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'invoices', inv.id), inv, { merge: true });
      }
      for (const pay of parsed.payments || []) {
        await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'payments', pay.id), pay, { merge: true });
      }
      for (const exp of parsed.expenses || []) {
        await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'expenses', exp.id), exp, { merge: true });
      }
      for (const ord of parsed.orders || []) {
        await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'orders', ord.id), ord, { merge: true });
      }
      for (const c of parsed.personalContacts || []) {
        await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'personal_contacts', c.id), c, { merge: true });
      }
      for (const tx of parsed.personalTransactions || []) {
        await setDoc(doc(db, 'stores', SHARED_STORE_ID, 'personal_transactions', tx.id), tx, { merge: true });
      }
      return true;
    } catch (e) {
      console.error("Failed to import JSON:", e);
      return false;
    }
  }, [currentUser]);

  return (
    <AppContext.Provider value={{
      currentUser,
      authLoading,
      cloudConnected,
      activeTab,
      setActiveTab,
      selectedMonth,
      setSelectedMonth,
      currency,
      setCurrency,
      storeName,
      setStoreName,
      isDarkMode,
      toggleDarkMode,
      merchants,
      products,
      invoices,
      payments,
      expenses,
      orders,
      pendingOrdersCount,
      personalContacts,
      personalTransactions,
      currentMonthSummary,
      allMonthsArchive,
      merchantBalances,
      totalAllTimeDebt,
      totalAllTimeSales,
      totalAllTimeCollections,
      totalAllTimeExpenses,
      totalAllTimeNetCollections,
      debtorMerchantsCount,
      personalStats,
      loginWithGoogle,
      loginWithGoogleRedirect,
      loginAnonymously,
      logoutUser,
      saveMerchant,
      removeMerchant,
      saveProduct,
      removeProduct,
      saveInvoice,
      removeInvoice,
      savePayment,
      removePayment,
      saveExpense,
      removeExpense,
      saveWorkOrder,
      removeWorkOrder,
      deliverWorkOrder,
      savePersonalContact,
      removePersonalContact,
      savePersonalTransaction,
      removePersonalTransaction,
      toastMessage,
      showToast,
      exportDataJSON,
      importDataJSON,
      refreshFromCloud,
      isLocked,
      unlockSystem,
      lockSystem,
      systemPin,
      updateSystemPin,
      isPinEnabled,
      togglePinEnabled,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
