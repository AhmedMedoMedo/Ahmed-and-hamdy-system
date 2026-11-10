export type PaymentMethod = 'كاش' | 'تحويل بنكي' | 'فودافون كاش / إنستاباي' | 'شيك' | 'أخرى';

export type PersonalTransactionType = 
  | 'withdrawal'  // سحب فلوس (يزيد الدين)
  | 'deposit';    // إضافة فلوس (ينقص الدين)

export interface Merchant {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  costPrice?: number | null;
  unit: string;
  stock?: number;
  notes?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  merchantId: string;
  merchantName: string;
  date: string;         // YYYY-MM-DD
  monthKey: string;     // YYYY-MM
  items: InvoiceItem[];
  subtotal: number;
  discountType: 'amount' | 'percentage';
  discountValue: number;
  discount: number;     // calculated discount in currency
  total: number;        // net total after discount
  paidAmount: number;   // paid upfront at time of invoice
  remainingAmount: number; // remaining to be added to merchant debt
  notes?: string;
  orderId?: string;     // Reference to originating work order if created upon delivery
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  merchantId: string;
  merchantName: string;
  amount: number;
  date: string;         // YYYY-MM-DD
  monthKey: string;     // YYYY-MM
  paymentMethod: PaymentMethod;
  notes?: string;
  invoiceId?: string;
  receiptNumber?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Work Order / Delivery Preparation Types
export type OrderStatus = 'pending' | 'partially_delivered' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: string;
  productId?: string;
  productName: string;
  unitPrice: number;
  quantityOrdered: number;       // الكمية المطلوبة كاملة
  quantityDelivered: number;     // الكمية المسلمة حتى الآن
  quantityRemaining: number;     // الكمية المتبقية للتسليم
  unit?: string;
}

export interface WorkOrder {
  id: string;
  orderNumber: string;           // e.g. طلب-26-001
  merchantId: string;
  merchantName: string;
  date: string;                  // YYYY-MM-DD
  monthKey: string;              // YYYY-MM
  items: OrderItem[];
  status: OrderStatus;
  totalEstimatedAmount: number;  // إجمالي قيمة الطلب الكامل
  deliveredTotalAmount: number;  // قيمة ما تم تسليمه فعلياً حتى الآن
  notes?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalContact {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
  notes?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalTransaction {
  id: string;
  contactId?: string;
  contactName?: string;
  type: PersonalTransactionType;
  amount: number;
  date: string;         // YYYY-MM-DD
  monthKey: string;     // YYYY-MM
  notes?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantBalance {
  merchantId: string;
  merchantName: string;
  totalInvoicedAllTime: number;
  totalPaidAllTime: number;
  currentDebt: number; // Invoiced - Paid
  
  // For selected month
  monthInvoiced: number;
  monthPaid: number;
  carriedDebt: number; // Debt accumulated prior to selected month
}

export type ExpenseCategory = 
  | 'مصاريف عامة وتوريد'
  | 'مرتبات وأجور'
  | 'صيانة وتصليح'
  | 'نقل وتوصيل'
  | 'إيجار'
  | 'كهرباء'
  | 'إيجار وكهرباء'
  | 'مسحوبات شخصية'
  | 'أخرى';

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;         // YYYY-MM-DD
  monthKey: string;     // YYYY-MM
  paymentMethod: PaymentMethod;
  notes?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type TrashCollectionType = 
  | 'merchants' 
  | 'products' 
  | 'invoices' 
  | 'payments' 
  | 'expenses' 
  | 'orders' 
  | 'personal_contacts' 
  | 'personal_transactions';

export interface TrashItem {
  id: string;
  collectionName: TrashCollectionType;
  typeLabel: string;
  title: string;
  subtitle?: string;
  amount?: number;
  date?: string;
  deletedAt?: string;
  rawData?: any;
}

export interface MonthSummary {
  monthKey: string;             // YYYY-MM
  monthName: string;            // e.g. "أكتوبر 2026"
  newSales: number;             // مبيعات الشهر الجديد (يبدأ بصفر)
  newCollections: number;       // تحصيلات الشهر الجديد (يبدأ بصفر)
  newExpenses: number;          // مسحوبات ومصاريف الشهر
  netCollections: number;       // صافي التحصيل بعد خصم المسحوبات (newCollections - newExpenses)
  netMonthMovement: number;     // newSales - newCollections
  carriedForwardDebt: number;   // ديون مرحلة من الشهور السابقة
  endingDebt: number;           // إجمالي الدين بنهاية هذا الشهر
  invoicesCount: number;
  paymentsCount: number;
  expensesCount: number;
}export interface MerchantStatementTransaction {
  id: string;
  type: 'invoice' | 'payment';
  date: string;
  title: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  notes?: string;
  createdAt: string;
  rawInvoice?: Invoice;
  rawPayment?: Payment;
}

export interface MerchantStatementPrintData {
  merchant: Merchant;
  balances: {
    totalInvoicedAllTime: number;
    totalPaidAllTime: number;
    currentDebt: number;
  };
  invoices: Invoice[];
  payments: Payment[];
  transactions: MerchantStatementTransaction[];
  generatedAt?: string;
}
