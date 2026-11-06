import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  auth, 
  db, 
  signInWithGoogle, 
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
  onSnapshot 
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
  
  // Personal finance stats
  personalStats: {
    totalLoansGiven: number;
    totalLoansTaken: number;
    totalPersonalExpenses: number;
    totalPersonalIncome: number;
    netBalance: number;
  };

  // Actions
  loginWithGoogle: () => Promise<void>;
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
  saveWorkOrder: (order: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<string>;
  removeWorkOrder: (id: string) => Promise<void>;
  deliverWorkOrder: (
    orderId: string, 
    deliveryItems: { itemId: string; quantityToDeliver: number }[], 
    paymentType: 'debt' | 'paid_full' | 'paid_partial', 
    paidAmountInput?: number, 
    notes?: string
  ) => Promise<{ invoiceId: string; newStatus: OrderStatus }>;

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

// Initial sample data if brand new local session
const initialProducts: Product[] = [
  { id: 'prod_1', name: 'كرتونة زيت طعام ممتاز (12 لتر)', price: 850, costPrice: 790, unit: 'كرتونة', notes: 'سعر الجملة للتجار', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'prod_2', name: 'شيكارة أرز درجة أولى (25 كجم)', price: 620, costPrice: 580, unit: 'شيكارة', notes: 'أرز عريض الحبة', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'prod_3', name: 'كرتونة مكرونة مشكلة (20 كيس)', price: 340, costPrice: 300, unit: 'كرتونة', notes: 'وزن الكيس 400 جرام', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'prod_4', name: 'شيكارة سكر بلوري (50 كجم)', price: 1450, costPrice: 1380, unit: 'شيكارة', notes: 'جملة تجار التجزئة', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const initialMerchants: Merchant[] = [
  { id: 'm_1', name: 'الحاج محمود - سوبر ماركت الأمانة', phone: '01012345678', address: 'شارع الجمهورية - وسط البلد', notes: 'تاجر ملتزم، يطلب خصم 2% أحياناً', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'm_2', name: 'التاجر أبو كريم - بقالة البركة', phone: '01198765432', address: 'شارع المحطة - المنشية', notes: 'دفعات أسبوعية كل يوم خميس', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'm_3', name: 'محلات النور للسلع الغذائية', phone: '01234567890', address: 'السوق الكبير - المحل رقم 14', notes: 'سحب مستمر بفواتير دورية', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

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

  // 1. Initial local load
  useEffect(() => {
    try {
      const storedCurr = localStorage.getItem(STORAGE_KEYS.currency);
      if (storedCurr) setCurrency(storedCurr);

      const storedStore = localStorage.getItem(STORAGE_KEYS.storeName);
      if (storedStore) setStoreName(storedStore);

      const m = localStorage.getItem(STORAGE_KEYS.merchants);
      setMerchants(m ? JSON.parse(m) : initialMerchants);

      const p = localStorage.getItem(STORAGE_KEYS.products);
      setProducts(p ? JSON.parse(p) : initialProducts);

      const inv = localStorage.getItem(STORAGE_KEYS.invoices);
      setInvoices(inv ? JSON.parse(inv) : []);

      const pay = localStorage.getItem(STORAGE_KEYS.payments);
      setPayments(pay ? JSON.parse(pay) : []);

      const exp = localStorage.getItem(STORAGE_KEYS.expenses);
      setExpenses(exp ? JSON.parse(exp) : []);

      const ord = localStorage.getItem(STORAGE_KEYS.orders);
      setOrders(ord ? JSON.parse(ord) : []);

      const pc = localStorage.getItem(STORAGE_KEYS.personalContacts);
      setPersonalContacts(pc ? JSON.parse(pc) : [
        { id: 'pc_1', name: 'محمد عبد الله (شخصي)', phone: '01000000001', relationship: 'صديق', notes: 'حساب سلف شخصية', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ]);

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

  // 2. Auth listener & Firestore live sync
  useEffect(() => {
    testConnection().then((ok) => setCloudConnected(ok));

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        setCloudConnected(true);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // When currentUser is logged in, attach live Firestore subscriptions
  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.uid;

    const unsubs: (() => void)[] = [];

    const setupListener = <T,>(subcoll: string, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      const colRef = collection(db, 'users', uid, subcoll);
      const unsub = onSnapshot(colRef, (snapshot) => {
        const items: T[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as T);
        });
        if (items.length > 0 || snapshot.metadata.hasPendingWrites) {
          setter(items);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, `users/${uid}/${subcoll}`);
      });
      unsubs.push(unsub);
    };

    setupListener<Merchant>('merchants', setMerchants);
    setupListener<Product>('products', setProducts);
    setupListener<Invoice>('invoices', setInvoices);
    setupListener<Payment>('payments', setPayments);
    setupListener<Expense>('expenses', setExpenses);
    setupListener<WorkOrder>('orders', setOrders);
    setupListener<PersonalContact>('personal_contacts', setPersonalContacts);
    setupListener<PersonalTransaction>('personal_transactions', setPersonalTransactions);

    return () => {
      unsubs.forEach(fn => fn());
    };
  }, [currentUser]);

  // Auth actions
  const loginWithGoogle = async () => {
    try {
      const user = await signInWithGoogle();
      setCurrentUser(user);
      setCloudConnected(true);

      // Auto migrate existing local items to Firestore if new in Firestore
      if (user) {
        const uid = user.uid;
        for (const m of merchants) {
          await setDoc(doc(db, 'users', uid, 'merchants', m.id), m, { merge: true });
        }
        for (const p of products) {
          await setDoc(doc(db, 'users', uid, 'products', p.id), p, { merge: true });
        }
        for (const inv of invoices) {
          await setDoc(doc(db, 'users', uid, 'invoices', inv.id), inv, { merge: true });
        }
        for (const pay of payments) {
          await setDoc(doc(db, 'users', uid, 'payments', pay.id), pay, { merge: true });
        }
        for (const ord of orders) {
          await setDoc(doc(db, 'users', uid, 'orders', ord.id), ord, { merge: true });
        }
        for (const c of personalContacts) {
          await setDoc(doc(db, 'users', uid, 'personal_contacts', c.id), c, { merge: true });
        }
        for (const tx of personalTransactions) {
          await setDoc(doc(db, 'users', uid, 'personal_transactions', tx.id), tx, { merge: true });
        }
      }
    } catch (e) {
      console.error("Login failed:", e);
      throw e;
    }
  };

  const logoutUser = async () => {
    await logOut();
    setCurrentUser(null);
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

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'merchants', id), record);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/merchants/${id}`);
      }
    }
    return id;
  };

  const removeMerchant = async (id: string) => {
    setMerchants(prev => prev.filter(m => m.id !== id));
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'merchants', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/merchants/${id}`);
      }
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
      costPrice: data.costPrice !== undefined ? Number(data.costPrice) : undefined,
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

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'products', id), record);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/products/${id}`);
      }
    }
    return id;
  };

  const removeProduct = async (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'products', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/products/${id}`);
      }
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
      merchantId: data.merchantId,
      merchantName: data.merchantName,
      date: data.date,
      monthKey,
      items: data.items,
      subtotal: Number(data.subtotal) || 0,
      discountType: data.discountType || 'amount',
      discountValue: Number(data.discountValue) || 0,
      discount: Number(data.discount) || 0,
      total: Number(data.total) || 0,
      paidAmount: Number(data.paidAmount) || 0,
      remainingAmount: Number(data.remainingAmount) || 0,
      notes: data.notes || '',
      orderId: data.orderId,
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

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'invoices', id), record);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/invoices/${id}`);
      }
    }

    // If an upfront payment was made with the invoice, also record it as a Payment record
    if (autoAddPayment && record.paidAmount > 0 && !data.id) {
      await savePayment({
        merchantId: record.merchantId,
        merchantName: record.merchantName,
        amount: record.paidAmount,
        date: record.date,
        monthKey: record.monthKey,
        paymentMethod: 'كاش',
        notes: `دفعة نقدية مسددة عند استلام الفاتورة رقم ${record.invoiceNumber}`,
        invoiceId: record.id,
      });
    }

    return id;
  };

  const removeInvoice = async (id: string) => {
    setInvoices(prev => prev.filter(inv => inv.id !== id));
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'invoices', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/invoices/${id}`);
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

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'payments', id), record);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/payments/${id}`);
      }
    }
    return id;
  };

  const removePayment = async (id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'payments', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/payments/${id}`);
      }
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

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'expenses', id), record);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/expenses/${id}`);
      }
    }
    return id;
  };

  const removeExpense = async (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'expenses', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/expenses/${id}`);
      }
    }
  };

  // --- WORK ORDERS CRUD & DELIVERY ---
  const saveWorkOrder = async (data: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const now = new Date().toISOString();
    const id = data.id || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const monthKey = data.monthKey || getMonthKeyFromDate(data.date);

    const record: WorkOrder = {
      id,
      orderNumber: data.orderNumber || `طلب-${Date.now().toString().slice(-4)}`,
      merchantId: data.merchantId,
      merchantName: data.merchantName,
      date: data.date,
      monthKey,
      items: data.items,
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

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'orders', id), record);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/orders/${id}`);
      }
    }
    return id;
  };

  const removeWorkOrder = async (id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'orders', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/orders/${id}`);
      }
    }
  };

  const deliverWorkOrder = async (
    orderId: string,
    deliveryItems: { itemId: string; quantityToDeliver: number }[],
    paymentType: 'debt' | 'paid_full' | 'paid_partial',
    paidAmountInput?: number,
    notes?: string
  ): Promise<{ invoiceId: string; newStatus: OrderStatus }> => {
    const order = orders.find(o => o.id === orderId);
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
          productId: item.productId,
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
    const invoiceId = await saveInvoice({
      invoiceNumber: generateInvoiceNumber(invoices.length),
      merchantId: order.merchantId,
      merchantName: order.merchantName,
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
      orderId: order.id,
    }, true);

    // Save updated order
    setOrders(prev => prev.map(o => o.id === orderId ? updatedOrder : o));

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'orders', orderId), updatedOrder);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/orders/${orderId}`);
      }
    }

    return { invoiceId, newStatus };
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

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'personal_contacts', id), record);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/personal_contacts/${id}`);
      }
    }
    return id;
  };

  const removePersonalContact = async (id: string) => {
    setPersonalContacts(prev => prev.filter(c => c.id !== id));
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'personal_contacts', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/personal_contacts/${id}`);
      }
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

    if (currentUser) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'personal_transactions', id), record);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/personal_transactions/${id}`);
      }
    }
    return id;
  };

  const removePersonalTransaction = async (id: string) => {
    setPersonalTransactions(prev => prev.filter(tx => tx.id !== id));
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'personal_transactions', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${currentUser.uid}/personal_transactions/${id}`);
      }
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

    invoices.forEach(inv => {
      if (!map[inv.merchantId]) {
        map[inv.merchantId] = {
          merchantId: inv.merchantId,
          merchantName: inv.merchantName,
          totalInvoicedAllTime: 0,
          totalPaidAllTime: 0,
          currentDebt: 0,
          monthInvoiced: 0,
          monthPaid: 0,
          carriedDebt: 0,
        };
      }
      const b = map[inv.merchantId];
      b.totalInvoicedAllTime += (inv.total || 0);

      const invMonth = inv.monthKey || getMonthKeyFromDate(inv.date);
      if (invMonth === selectedMonth) {
        b.monthInvoiced += (inv.total || 0);
      } else if (invMonth < selectedMonth) {
        b.carriedDebt += (inv.total || 0);
      }
    });

    payments.forEach(pay => {
      if (!map[pay.merchantId]) {
        map[pay.merchantId] = {
          merchantId: pay.merchantId,
          merchantName: pay.merchantName,
          totalInvoicedAllTime: 0,
          totalPaidAllTime: 0,
          currentDebt: 0,
          monthInvoiced: 0,
          monthPaid: 0,
          carriedDebt: 0,
        };
      }
      const b = map[pay.merchantId];
      b.totalPaidAllTime += (pay.amount || 0);

      const payMonth = pay.monthKey || getMonthKeyFromDate(pay.date);
      if (payMonth === selectedMonth) {
        b.monthPaid += (pay.amount || 0);
      } else if (payMonth < selectedMonth) {
        b.carriedDebt -= (pay.amount || 0);
      }
    });

    // Compute current total debts
    Object.values(map).forEach(b => {
      b.currentDebt = b.totalInvoicedAllTime - b.totalPaidAllTime;
    });

    return map;
  }, [merchants, invoices, payments, selectedMonth]);

  // Overall totals across all time
  const totalAllTimeSales = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  }, [invoices]);

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
    return totalAllTimeSales - totalAllTimeCollections;
  }, [totalAllTimeSales, totalAllTimeCollections]);

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
    let totalLoansGiven = 0;
    let totalLoansTaken = 0;
    let totalPersonalExpenses = 0;
    let totalPersonalIncome = 0;

    personalTransactions.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      switch (tx.type) {
        case 'loan_given':
          totalLoansGiven += amt;
          break;
        case 'loan_repaid':
          totalLoansGiven -= amt;
          break;
        case 'loan_taken':
          totalLoansTaken += amt;
          break;
        case 'debt_paid':
          totalLoansTaken -= amt;
          break;
        case 'expense':
        case 'personal_expense':
          totalPersonalExpenses += amt;
          break;
        case 'income':
        case 'personal_income':
          totalPersonalIncome += amt;
          break;
      }
    });

    return {
      totalLoansGiven,
      totalLoansTaken,
      totalPersonalExpenses,
      totalPersonalIncome,
      netBalance: (totalPersonalIncome + totalLoansTaken) - (totalPersonalExpenses + totalLoansGiven)
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

      if (currentUser) {
        const uid = currentUser.uid;
        for (const m of parsed.merchants || []) {
          await setDoc(doc(db, 'users', uid, 'merchants', m.id), m);
        }
        for (const p of parsed.products || []) {
          await setDoc(doc(db, 'users', uid, 'products', p.id), p);
        }
        for (const inv of parsed.invoices || []) {
          await setDoc(doc(db, 'users', uid, 'invoices', inv.id), inv);
        }
        for (const pay of parsed.payments || []) {
          await setDoc(doc(db, 'users', uid, 'payments', pay.id), pay);
        }
        for (const exp of parsed.expenses || []) {
          await setDoc(doc(db, 'users', uid, 'expenses', exp.id), exp);
        }
        for (const ord of parsed.orders || []) {
          await setDoc(doc(db, 'users', uid, 'orders', ord.id), ord);
        }
        for (const c of parsed.personalContacts || []) {
          await setDoc(doc(db, 'users', uid, 'personal_contacts', c.id), c);
        }
        for (const tx of parsed.personalTransactions || []) {
          await setDoc(doc(db, 'users', uid, 'personal_transactions', tx.id), tx);
        }
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
      personalStats,
      loginWithGoogle,
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
