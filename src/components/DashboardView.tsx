import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { Invoice, Payment, Expense, WorkOrder } from '../types';
import { 
  formatCurrency, 
  formatDateArabic,
  getTimeAgoArabic,
  formatTimeAgoArabic,
  getTodayDateString,
  isDateToday,
  isDateWithinDays,
  isDateInCurrentMonth,
  getMonthKeyFromDate
} from '../utils/formatters';
import { ConfirmModal } from './ConfirmModal';
import { ExpenseModal } from './ExpenseModal';
import { 
  TrendingUp, 
  HandCoins, 
  Clock, 
  AlertCircle, 
  Receipt, 
  Users, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ChevronLeft, 
  Calendar, 
  Package, 
  Truck, 
  Filter, 
  Trash2,
  Edit3,
  Printer,
  X,
  FileText,
  Percent,
  ArrowRightLeft,
  ArrowDownCircle,
  Coins,
  Search,
  Wallet
} from 'lucide-react';

interface DashboardViewProps {
  onOpenNewInvoice: () => void;
  onOpenNewPayment: () => void;
  onOpenNewMerchant: () => void;
  onOpenNewProduct: () => void;
  onOpenNewOrder?: () => void;
  onSelectMerchant: (merchantId: string) => void;
  onEditInvoice?: (invoice: Invoice) => void;
  onEditPayment?: (payment: Payment) => void;
  onPrintInvoice?: (invoice: Invoice) => void;
  onPrintPayment?: (payment: Payment) => void;
  onPrintOrder?: (order: WorkOrder) => void;
  onPrintExpense?: (expense: Expense) => void;
}

type PeriodFilter = 'today' | 'week' | 'month' | 'all';
type TransactionFilter = 'all' | 'invoices' | 'payments' | 'expenses';

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenNewInvoice,
  onOpenNewPayment,
  onOpenNewMerchant,
  onOpenNewProduct,
  onOpenNewOrder,
  onSelectMerchant,
  onEditInvoice,
  onEditPayment,
  onPrintInvoice,
  onPrintPayment,
  onPrintOrder,
  onPrintExpense,
}) => {
  const { 
    currentMonthSummary, 
    selectedMonth,
    currency, 
    merchantBalances, 
    merchants,
    invoices, 
    payments, 
    expenses,
    orders,
    pendingOrdersCount,
    setActiveTab,
    savePayment,
    removeInvoice,
    removePayment,
    removeExpense,
    removeWorkOrder,
    showToast
  } = useApp();

  // Period filter applied to BOTH top statistics cards AND recent operations
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');

  // Search and Transaction type filters for Recent Operations
  const [searchTerm, setSearchTerm] = useState('');
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>('all');

  // Expense modal state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Cash Deposit modal state
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositNotes, setDepositNotes] = useState('');

  // Handle saving general cash deposit
  const handleSaveDeposit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const amt = Number(depositAmount);
    if (!amt || amt <= 0) {
      showToast('يرجى إدخال مبلغ صحيح للإيداع');
      return;
    }

    const today = getTodayDateString();
    try {
      await savePayment({
        merchantId: 'general_deposit',
        merchantName: 'إيداع نقدي / إيراد عام',
        amount: amt,
        paymentMethod: 'كاش',
        date: today,
        monthKey: getMonthKeyFromDate(today),
        notes: depositNotes.trim() || 'إيداع نقدي / إيراد عام',
      });
      showToast('تم تسجيل الإيداع النقدي بنجاح');
    } catch (err) {
      console.warn('Deposit saved locally in offline mode:', err);
      showToast('تم تسجيل الإيداع النقدي محلياً (أوفلاين) 📴');
    } finally {
      setIsDepositModalOpen(false);
      setDepositAmount('');
      setDepositNotes('');
    }
  };

  // Deletion confirm modal state
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'invoice' | 'payment' | 'expense' | 'order';
    id: string;
    title: string;
    message: string;
  } | null>(null);

  // Selected operation detail modal state
  const [selectedOperation, setSelectedOperation] = useState<{
    type: 'invoice' | 'payment' | 'expense' | 'order';
    id: string;
    rawInvoice?: Invoice;
    rawPayment?: Payment;
    rawExpense?: Expense;
    rawOrder?: WorkOrder;
  } | null>(null);

  // Top debtors (Merchants with positive debt)
  const sortedDebtors = Object.values(merchantBalances)
    .filter(b => b.currentDebt > 0)
    .sort((a, b) => b.currentDebt - a.currentDebt);

  // Total current debt owed by all merchants
  const totalCurrentDebt = useMemo(() => {
    return Object.values(merchantBalances).reduce((sum, b) => sum + Math.max(0, b.currentDebt), 0);
  }, [merchantBalances]);

  // Combined Operations (Invoices + Payments + Expenses/Withdrawals + Work Orders)
  const allCombinedOperations = useMemo(() => {
    const invOps = invoices.map(inv => {
      const isFromOrder = Boolean(inv.orderId);
      const isCash = (inv.remainingAmount || 0) <= 0;
      return {
        id: inv.id,
        merchantId: inv.merchantId,
        merchantName: inv.merchantName,
        type: 'invoice' as const,
        date: inv.date,
        createdAt: inv.createdAt,
        title: inv.merchantName,
        referenceNumber: inv.invoiceNumber,
        subTitle: isFromOrder 
          ? `فاتورة تسليم طلب #${inv.invoiceNumber} (${isCash ? 'كاش فوري' : 'دين آجل'})` 
          : `فاتورة #${inv.invoiceNumber} (${isCash ? 'سداد كاش' : 'على الحساب'})`,
        amount: inv.total,
        remainingAmount: inv.remainingAmount,
        isPaid: inv.remainingAmount <= 0,
        isFromOrder,
        notes: inv.notes,
        raw: inv,
      };
    });

    const payOps = payments.map(pay => ({
      id: pay.id,
      merchantId: pay.merchantId,
      merchantName: pay.merchantName,
      type: 'payment' as const,
      date: pay.date,
      createdAt: pay.createdAt,
      title: pay.merchantName,
      referenceNumber: pay.receiptNumber || '',
      subTitle: `دفعة (${pay.paymentMethod}) #${pay.receiptNumber || ''}`,
      amount: pay.amount,
      remainingAmount: 0,
      isPaid: true,
      notes: pay.notes,
      raw: pay,
    }));

    const expOps = expenses.map(exp => ({
      id: exp.id,
      merchantId: undefined as string | undefined,
      merchantName: exp.category,
      type: 'expense' as const,
      date: exp.date,
      createdAt: exp.createdAt,
      title: exp.title,
      referenceNumber: exp.category,
      subTitle: `مسحوبات (${exp.category}) • ${exp.paymentMethod}`,
      amount: exp.amount,
      remainingAmount: 0,
      isPaid: true,
      notes: exp.notes,
      raw: exp,
    }));

    const orderOps = orders
      .filter(ord => {
        // If an invoice already exists for this order, the invoice is the authoritative operation
        const hasLinkedInvoice = invoices.some(inv => inv.orderId === ord.id || (inv.notes && inv.notes.includes(ord.orderNumber)));
        return !hasLinkedInvoice;
      })
      .map(ord => {
        const isDelivered = ord.status === 'delivered';
        const isPartial = ord.status === 'partially_delivered';
        const statusLabel = isDelivered ? 'تم تسليمه' : isPartial ? 'تسليم جزئي' : 'قيد التحضير';
        return {
          id: ord.id,
          merchantId: ord.merchantId,
          merchantName: ord.merchantName,
          type: 'order' as const,
          date: ord.date,
          createdAt: ord.createdAt,
          title: ord.merchantName,
          referenceNumber: ord.orderNumber,
          subTitle: `طلب شغل #${ord.orderNumber} • ${statusLabel}`,
          amount: ord.totalEstimatedAmount,
          remainingAmount: Math.max(0, (ord.totalEstimatedAmount || 0) - (ord.deliveredTotalAmount || 0)),
          isPaid: isDelivered,
          notes: ord.notes,
          raw: ord,
        };
      });

    return [...invOps, ...payOps, ...expOps, ...orderOps].sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [invoices, payments, expenses, orders]);

  // Operations filtered by the period selector
  const periodOperations = useMemo(() => {
    return allCombinedOperations.filter(op => {
      if (periodFilter === 'today') {
        return isDateToday(op.date);
      }
      if (periodFilter === 'week') {
        return isDateWithinDays(op.date, 7);
      }
      if (periodFilter === 'month') {
        return isDateInCurrentMonth(op.date, selectedMonth);
      }
      return true; // 'all'
    });
  }, [allCombinedOperations, periodFilter, selectedMonth]);

  // Filtered Operations based on transactionFilter and searchTerm
  const filteredOperations = useMemo(() => {
    return periodOperations.filter(op => {
      // 1. Transaction type filter
      if (transactionFilter === 'invoices') {
        if (op.type !== 'invoice') return false;
      } else if (transactionFilter === 'payments') {
        if (op.type !== 'payment') return false;
      } else if (transactionFilter === 'expenses') {
        if (op.type !== 'expense') return false;
      }

      // 2. Search term filter (searches merchant name, title, reference number, subtitle, notes)
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const merchantName = (op.merchantName || '').toLowerCase();
        const title = (op.title || '').toLowerCase();
        const refNumber = (op.referenceNumber || '').toLowerCase();
        const subTitle = (op.subTitle || '').toLowerCase();
        const notes = (op.notes || '').toLowerCase();

        const matches = 
          merchantName.includes(term) ||
          title.includes(term) ||
          refNumber.includes(term) ||
          subTitle.includes(term) ||
          notes.includes(term);

        if (!matches) return false;
      }

      return true;
    });
  }, [periodOperations, transactionFilter, searchTerm]);

  // Counts for transaction filter toggle buttons within current period
  const filterCounts = useMemo(() => {
    return {
      all: periodOperations.length,
      invoices: periodOperations.filter(op => op.type === 'invoice').length,
      payments: periodOperations.filter(op => op.type === 'payment').length,
      expenses: periodOperations.filter(op => op.type === 'expense').length,
    };
  }, [periodOperations]);

  // Statistics for the chosen filter period (powers top dashboard cards)
  const periodStats = useMemo(() => {
    let sales = 0;
    let collections = 0;
    let expensesSum = 0;
    let invoiceCount = 0;
    let paymentCount = 0;
    let expenseCount = 0;

    periodOperations.forEach(op => {
      if (op.type === 'invoice') {
        sales += op.amount;
        invoiceCount++;
      } else if (op.type === 'payment') {
        collections += op.amount;
        paymentCount++;
      } else if (op.type === 'expense') {
        expensesSum += op.amount;
        expenseCount++;
      }
    });

    const netCollections = collections - expensesSum;
    const netChange = sales - collections;
    const collectionRate = sales > 0 ? Math.round((collections / sales) * 100) : 0;

    return {
      sales,
      collections,
      expensesSum,
      netCollections,
      invoiceCount,
      paymentCount,
      expenseCount,
      count: periodOperations.length,
      netChange,
      collectionRate,
    };
  }, [periodOperations]);

  // Totals for filtered operations (powers the mini summary banner inside the recent operations card)
  const recentTotals = useMemo(() => {
    let sales = 0;
    let collections = 0;
    let expensesSum = 0;

    filteredOperations.forEach(op => {
      if (op.type === 'invoice') {
        sales += op.amount;
      } else if (op.type === 'payment') {
        collections += op.amount;
      } else if (op.type === 'expense') {
        expensesSum += op.amount;
      }
    });

    return { sales, collections, expensesSum };
  }, [filteredOperations]);

  // Handle operation deletion
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.type === 'invoice') {
        await removeInvoice(itemToDelete.id);
        showToast('تم حذف الفاتورة وتحديث حساب التاجر بنجاح');
      } else if (itemToDelete.type === 'payment') {
        await removePayment(itemToDelete.id);
        showToast('تم حذف سند التحصيل وتحديث الحسابات بنجاح');
      } else if (itemToDelete.type === 'expense') {
        await removeExpense(itemToDelete.id);
        showToast('تم حذف المصروف واسترجاع المبلغ لصافي التحصيل');
      } else if (itemToDelete.type === 'order') {
        await removeWorkOrder(itemToDelete.id);
        showToast('تم حذف طلب الشغل بنجاح');
      }
    } catch {
      showToast('حدث خطأ أثناء الحذف');
    } finally {
      setItemToDelete(null);
      setSelectedOperation(null);
    }
  };

  // Open operation details modal
  const handleOpenOperationDetail = (op: typeof allCombinedOperations[0]) => {
    if (op.type === 'invoice') {
      const inv = invoices.find(i => i.id === op.id);
      setSelectedOperation({ type: 'invoice', id: op.id, rawInvoice: inv });
    } else if (op.type === 'payment') {
      const pay = payments.find(p => p.id === op.id);
      setSelectedOperation({ type: 'payment', id: op.id, rawPayment: pay });
    } else if (op.type === 'expense') {
      const exp = expenses.find(e => e.id === op.id);
      setSelectedOperation({ type: 'expense', id: op.id, rawExpense: exp });
    } else if (op.type === 'order') {
      const ord = orders.find(o => o.id === op.id);
      setSelectedOperation({ type: 'order', id: op.id, rawOrder: ord });
    }
  };

  return (
    <div className="space-y-3 pb-8">
      
      {/* Primary Mobile Action Buttons (Invoices=Blue, Payments=Emerald, Withdrawals/Expenses=Amber, Cash Deposit=Teal) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
        <button
          onClick={onOpenNewInvoice}
          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold shadow-2xs shadow-blue-500/20 transition-all text-center"
        >
          <Receipt className="w-5 h-5 mb-1 text-blue-100" />
          <span className="text-[11px] sm:text-xs leading-tight">فاتورة بيع</span>
          <span className="text-[9px] text-blue-200 mt-0.5">بيع بضاعة</span>
        </button>

        <button
          onClick={onOpenNewPayment}
          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold shadow-2xs shadow-emerald-500/20 transition-all text-center"
        >
          <HandCoins className="w-5 h-5 mb-1 text-emerald-100" />
          <span className="text-[11px] sm:text-xs leading-tight">دفعة تاجر</span>
          <span className="text-[9px] text-emerald-200 mt-0.5">تحصيل وتسديد</span>
        </button>

        <button
          onClick={() => {
            setEditingExpense(null);
            setIsExpenseModalOpen(true);
          }}
          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold shadow-2xs shadow-amber-500/20 transition-all text-center"
        >
          <ArrowDownCircle className="w-5 h-5 mb-1 text-amber-100" />
          <span className="text-[11px] sm:text-xs leading-tight">مسحوبات</span>
          <span className="text-[9px] text-amber-200 mt-0.5">مصاريف وصيانة</span>
        </button>

        <button
          onClick={() => {
            setDepositAmount('');
            setDepositNotes('');
            setIsDepositModalOpen(true);
          }}
          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold shadow-2xs shadow-teal-500/20 transition-all text-center"
        >
          <Wallet className="w-5 h-5 mb-1 text-teal-100" />
          <span className="text-[11px] sm:text-xs leading-tight">إيداع نقدي</span>
          <span className="text-[9px] text-teal-200 mt-0.5">إيراد وسيولة</span>
        </button>
      </div>

      {/* Work Orders Preparation Quick Access Card */}
      <div 
        onClick={() => onOpenNewOrder ? onOpenNewOrder() : setActiveTab('orders')}
        className="bg-gradient-to-r from-indigo-900 to-indigo-950 dark:from-indigo-950 dark:to-slate-900 text-white rounded-2xl p-3 shadow-xs border border-indigo-800/80 cursor-pointer active:scale-99 transition-all flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-800/90 text-indigo-200 flex items-center justify-center shrink-0 border border-indigo-700">
            <Truck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold text-sm text-white">تحضير وتسليم طلبات الشغل</h3>
              {pendingOrdersCount > 0 ? (
                <span className="px-2 py-0.2 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black animate-pulse font-mono-num">
                  {pendingOrdersCount} قيد التحضير
                </span>
              ) : (
                <span className="px-2 py-0.2 rounded-full bg-indigo-800 text-indigo-200 text-[10px]">
                  جاهز
                </span>
              )}
            </div>
            <p className="text-[11px] text-indigo-200 truncate mt-0.5">
              سجل طلبيات التجار وسلمها مع إضافة الدين أو السداد فوري
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-indigo-300 font-bold shrink-0">
          <span>فتح</span>
          <ChevronLeft className="w-4 h-4" />
        </div>
      </div>

      {/* --- DATE FILTER BAR FOR FINANCIAL STATS (يوم / أسبوع / شهر / كل الوقت) --- */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-2.5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>تصفية إحصائيات الحسابات:</span>
          </span>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono-num font-bold">
            {periodFilter === 'today' && 'اليوم'}
            {periodFilter === 'week' && 'آخر 7 أيام'}
            {periodFilter === 'month' && `شهر ${currentMonthSummary.monthName}`}
            {periodFilter === 'all' && 'كل الوقت'}
          </span>
        </div>

        {/* 4-Period Buttons Strip */}
        <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
          <button
            onClick={() => setPeriodFilter('today')}
            className={`py-1.5 rounded-lg font-bold transition-all text-center ${
              periodFilter === 'today' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            اليوم
          </button>
          <button
            onClick={() => setPeriodFilter('week')}
            className={`py-1.5 rounded-lg font-bold transition-all text-center ${
              periodFilter === 'week' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            أسبوع
          </button>
          <button
            onClick={() => setPeriodFilter('month')}
            className={`py-1.5 rounded-lg font-bold transition-all text-center ${
              periodFilter === 'month' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            شهر
          </button>
          <button
            onClick={() => setPeriodFilter('all')}
            className={`py-1.5 rounded-lg font-bold transition-all text-center ${
              periodFilter === 'all' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            كل الوقت
          </button>
        </div>
      </div>

      {/* --- ALL FINANCIAL KPI CARDS WITH OPERATION COUNTS ON EVERY CARD --- */}
      <div className="grid grid-cols-2 gap-2">
        
        {/* Card 1: Sales in selected period (Blue for Invoices / Sales) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/20 shadow-2xs">
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 text-xs mb-1 font-bold">
            <span>
              {periodFilter === 'today' && 'مبيعات اليوم'}
              {periodFilter === 'week' && 'مبيعات الأسبوع'}
              {periodFilter === 'month' && 'مبيعات الشهر'}
              {periodFilter === 'all' && 'إجمالي المبيعات'}
            </span>
            <Receipt className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-blue-700 dark:text-blue-300 font-mono-num">
            {formatCurrency(
              periodFilter === 'month' ? currentMonthSummary.newSales : periodStats.sales, 
              currency
            )}
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 font-bold font-mono-num flex items-center gap-1">
            <span>{periodFilter === 'month' ? currentMonthSummary.invoicesCount : periodStats.invoiceCount}</span>
            <span>فاتورة بيع مسجلة</span>
          </div>
        </div>

        {/* Card 2: Collections in selected period (Emerald Green for Cash In / Payments) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs mb-1 font-bold">
            <span>
              {periodFilter === 'today' && 'تحصيل اليوم'}
              {periodFilter === 'week' && 'تحصيل الأسبوع'}
              {periodFilter === 'month' && 'تحصيل الشهر'}
              {periodFilter === 'all' && 'إجمالي التحصيل'}
            </span>
            <HandCoins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono-num">
            +{formatCurrency(
              periodFilter === 'month' ? currentMonthSummary.newCollections : periodStats.collections, 
              currency
            )}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-bold font-mono-num flex items-center gap-1">
            <span>{periodFilter === 'month' ? currentMonthSummary.paymentsCount : periodStats.paymentCount}</span>
            <span>دفعة تحصيل مستلمة</span>
          </div>
        </div>

        {/* Card 3: Expenses / Withdrawals in selected period (Amber for Withdrawals / Expenses) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/20 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-xs mb-1 font-bold">
            <span>
              {periodFilter === 'today' && 'مسحوبات اليوم'}
              {periodFilter === 'week' && 'مسحوبات الأسبوع'}
              {periodFilter === 'month' && 'مسحوبات الشهر'}
              {periodFilter === 'all' && 'إجمالي المسحوبات'}
            </span>
            <ArrowDownCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 font-mono-num">
            -{formatCurrency(
              periodFilter === 'month' ? currentMonthSummary.newExpenses : periodStats.expensesSum, 
              currency
            )}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-bold font-mono-num flex items-center gap-1">
            <span>{periodFilter === 'month' ? currentMonthSummary.expensesCount : periodStats.expenseCount}</span>
            <span>عملية سحب ومصروف</span>
          </div>
        </div>

        {/* Card 4: Net Collection (Collections minus Withdrawals) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-teal-200/80 dark:border-teal-900/40 bg-teal-50/20 dark:bg-teal-950/10 shadow-2xs">
          <div className="flex items-center justify-between text-teal-700 dark:text-teal-300 text-xs mb-1 font-semibold">
            <span>صافي التحصيل الفعلي</span>
            <Coins className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-teal-700 dark:text-teal-400 font-mono-num">
            {formatCurrency(
              periodFilter === 'month' ? currentMonthSummary.netCollections : periodStats.netCollections, 
              currency
            )}
          </div>
          <div className="text-[10px] text-teal-700 dark:text-teal-400 mt-0.5 font-bold font-mono-num flex items-center gap-1">
            <span>{(periodFilter === 'month' ? (currentMonthSummary.paymentsCount + currentMonthSummary.expensesCount) : (periodStats.paymentCount + periodStats.expenseCount))}</span>
            <span>حركة نقدية (وارد ومنصرف)</span>
          </div>
        </div>

        {/* Card 5: Contextual Info (Carried forward debt / Net period movement) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          {periodFilter === 'month' ? (
            <>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1 font-semibold">
                <span>ديون سابقة مرحلة</span>
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-base sm:text-lg font-black text-amber-700 dark:text-amber-400 font-mono-num">
                {formatCurrency(currentMonthSummary.carriedForwardDebt, currency)}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold font-mono-num flex items-center gap-1">
                <span>{Object.values(merchantBalances).filter(b => b.carriedDebt > 0).length}</span>
                <span>تاجر مرحل عليه دين</span>
              </div>
            </>
          ) : periodFilter === 'all' ? (
            <>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1 font-semibold">
                <span>نسبة التحصيل الإجمالية</span>
                <Percent className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="text-base sm:text-lg font-black text-indigo-700 dark:text-indigo-400 font-mono-num">
                {periodStats.collectionRate}%
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold font-mono-num flex items-center gap-1">
                <span>{periodStats.invoiceCount + periodStats.paymentCount}</span>
                <span>عملية بيع وتحصيل</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1 font-semibold">
                <span>
                  {periodFilter === 'today' ? 'صافي حركة اليوم' : 'صافي حركة الأسبوع'}
                </span>
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className={`text-base sm:text-lg font-black font-mono-num ${
                periodStats.netChange >= 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-teal-700 dark:text-teal-400'
              }`}>
                {formatCurrency(Math.abs(periodStats.netChange), currency)}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-bold font-mono-num flex items-center gap-1">
                <span>{periodStats.invoiceCount + periodStats.paymentCount}</span>
                <span>حركة مسجلة</span>
              </div>
            </>
          )}
        </div>

        {/* Card 6: Current Total Debts across all merchants */}
        <div 
          onClick={() => setActiveTab('debts')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/20 shadow-2xs cursor-pointer hover:border-rose-400 transition-all active:scale-98"
        >
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 text-xs mb-1 font-bold">
            <span>إجمالي الديون</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 font-mono-num">
            {formatCurrency(totalCurrentDebt, currency)}
          </div>
          <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 font-bold font-mono-num flex items-center gap-1">
            <span>{sortedDebtors.length}</span>
            <span>تاجر عليه دين مطلوب حالياً</span>
          </div>
        </div>

      </div>

      {/* 2 Quick Creation Buttons (Add Merchant, Add Product) */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onOpenNewMerchant}
          className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-800 dark:bg-slate-800 hover:bg-slate-900 dark:hover:bg-slate-700 text-white font-bold text-xs shadow-xs transition-colors"
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span>+ إضافة تاجر جديد</span>
        </button>

        <button
          onClick={onOpenNewProduct}
          className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-800 dark:bg-slate-800 hover:bg-slate-900 dark:hover:bg-slate-700 text-white font-bold text-xs shadow-xs transition-colors"
        >
          <Package className="w-4 h-4 text-teal-400" />
          <span>+ إضافة منتج وسعر</span>
        </button>
      </div>

      {/* --- RECENT OPERATIONS WITH DIRECT DELETE & EDIT ACTIONS (INVOICES, PAYMENTS, EXPENSES) --- */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
              آخر العمليات المسجلة
            </h3>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded-full">
              {periodFilter === 'today' ? 'اليوم' : periodFilter === 'week' ? 'الأسبوع' : periodFilter === 'month' ? 'الشهر' : 'الكل'}
            </span>
          </div>

          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono-num font-bold">
            {filteredOperations.length} حركة
          </span>
        </div>

        {/* Search & Transaction Filter UI */}
        <div className="space-y-2 pt-0.5">
          {/* Search Input with Search Icon */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث باسم التاجر أو رقم الفاتورة أو السند..."
              className="w-full pr-9 pl-8 py-2 text-xs bg-slate-50 dark:bg-slate-850/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Toggle Buttons: (الكل، مبيعات، تحصيلات، مسحوبات) */}
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
            <button
              type="button"
              onClick={() => setTransactionFilter('all')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                transactionFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/70'
              }`}
            >
              <span>الكل</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-num ${
                transactionFilter === 'all'
                  ? 'bg-indigo-700/90 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {filterCounts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTransactionFilter('invoices')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                transactionFilter === 'invoices'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/70'
              }`}
            >
              <span>مبيعات</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-num ${
                transactionFilter === 'invoices'
                  ? 'bg-blue-700/90 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {filterCounts.invoices}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTransactionFilter('payments')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                transactionFilter === 'payments'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/70'
              }`}
            >
              <span>تحصيلات</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-num ${
                transactionFilter === 'payments'
                  ? 'bg-emerald-700/90 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {filterCounts.payments}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTransactionFilter('expenses')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                transactionFilter === 'expenses'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/70'
              }`}
            >
              <span>مسحوبات</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-num ${
                transactionFilter === 'expenses'
                  ? 'bg-amber-700/90 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {filterCounts.expenses}
              </span>
            </button>
          </div>
        </div>

        {/* Totals Banner for Filtered Operations (Distinct Expressive Colors) */}
        <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-xs font-mono-num text-center">
          <div className="bg-blue-50/70 dark:bg-blue-950/40 p-1.5 rounded-lg border border-blue-200/60 dark:border-blue-900/40">
            <span className="text-[9px] text-blue-700 dark:text-blue-300 block font-sans font-bold">المبيعات</span>
            <span className="font-black text-blue-700 dark:text-blue-300 text-[11px]">
              {formatCurrency(recentTotals.sales, currency)}
            </span>
          </div>
          <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-1.5 rounded-lg border border-emerald-200/60 dark:border-emerald-900/40">
            <span className="text-[9px] text-emerald-700 dark:text-emerald-300 block font-sans font-bold">التحصيلات</span>
            <span className="font-black text-emerald-600 dark:text-emerald-400 text-[11px]">
              +{formatCurrency(recentTotals.collections, currency)}
            </span>
          </div>
          <div className="bg-amber-50/70 dark:bg-amber-950/40 p-1.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
            <span className="text-[9px] text-amber-700 dark:text-amber-300 block font-sans font-bold">المسحوبات</span>
            <span className="font-black text-amber-600 dark:text-amber-400 text-[11px]">
              -{formatCurrency(recentTotals.expensesSum, currency)}
            </span>
          </div>
        </div>

        {/* List of operations with expressive colors, clean 2-row layout, and print for all types */}
        <div className="space-y-2">
          {filteredOperations.slice(0, searchTerm.trim() || transactionFilter !== 'all' ? 50 : 25).map((op) => {
            const isInv = op.type === 'invoice';
            const isPay = op.type === 'payment';
            const isExp = op.type === 'expense';
            const isOrd = op.type === 'order';
            const invRaw = isInv ? (op.raw as Invoice) : undefined;
            const payRaw = isPay ? (op.raw as Payment) : undefined;
            const expRaw = isExp ? (op.raw as Expense) : undefined;
            const ordRaw = isOrd ? (op.raw as WorkOrder) : undefined;

            // Expressive color configuration
            const colorConfig = isInv
              ? invRaw?.orderId
                ? {
                    border: 'border-indigo-200/90 dark:border-indigo-800/60 hover:border-indigo-300 dark:hover:border-indigo-700',
                    bg: 'bg-indigo-50/40 dark:bg-indigo-950/20',
                    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/70 dark:text-indigo-200',
                    iconBox: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300',
                    amount: 'text-indigo-700 dark:text-indigo-300',
                    typeLabel: 'تسليم طلب شغل',
                  }
                : {
                    border: 'border-blue-200/90 dark:border-blue-800/60 hover:border-blue-300 dark:hover:border-blue-700',
                    bg: 'bg-blue-50/40 dark:bg-blue-950/20',
                    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-200',
                    iconBox: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300',
                    amount: 'text-blue-700 dark:text-blue-300',
                    typeLabel: 'فاتورة بيع',
                  }
              : isPay
              ? {
                  border: 'border-emerald-200/90 dark:border-emerald-800/60 hover:border-emerald-300 dark:hover:border-emerald-700',
                  bg: 'bg-emerald-50/40 dark:bg-emerald-950/20',
                  badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200',
                  iconBox: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
                  amount: 'text-emerald-600 dark:text-emerald-400',
                  typeLabel: 'تحصيل دفعة',
                }
              : isExp
              ? {
                  border: 'border-amber-200/90 dark:border-amber-800/60 hover:border-amber-300 dark:hover:border-amber-700',
                  bg: 'bg-amber-50/40 dark:bg-amber-950/20',
                  badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-200',
                  iconBox: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300',
                  amount: 'text-amber-600 dark:text-amber-400',
                  typeLabel: 'مسحوبات / مصروف',
                }
              : {
                  border: 'border-purple-200/90 dark:border-purple-800/60 hover:border-purple-300 dark:hover:border-purple-700',
                  bg: 'bg-purple-50/40 dark:bg-purple-950/20',
                  badge:
                    ordRaw?.status === 'delivered'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200'
                      : ordRaw?.status === 'partially_delivered'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-200'
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-900/70 dark:text-purple-200',
                  iconBox: 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300',
                  amount: 'text-purple-700 dark:text-purple-300',
                  typeLabel:
                    ordRaw?.status === 'delivered'
                      ? 'طلب شغل (تم تسليمه)'
                      : ordRaw?.status === 'partially_delivered'
                      ? 'طلب شغل (تسليم جزئي)'
                      : 'طلب شغل (قيد التحضير)',
                };

            return (
              <div 
                key={op.type + '_' + op.id} 
                onClick={() => handleOpenOperationDetail(op)}
                className={`p-2.5 sm:p-3 rounded-2xl border cursor-pointer hover:shadow-xs transition-all active:scale-[0.99] ${colorConfig.bg} ${colorConfig.border}`}
              >
                {/* Row 1: Main Operation Info (Right: Type + Merchant + Subtitle, Left: Amount) */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${colorConfig.iconBox}`}>
                      {isInv ? (
                        invRaw?.orderId ? <Truck className="w-4 h-4" /> : <Receipt className="w-4 h-4" />
                      ) : isPay ? (
                        <HandCoins className="w-4 h-4" />
                      ) : isExp ? (
                        <ArrowDownCircle className="w-4 h-4" />
                      ) : (
                        <Truck className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${colorConfig.badge}`}>
                          {colorConfig.typeLabel}
                        </span>
                        {op.merchantId ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectMerchant(op.merchantId!);
                            }}
                            className="font-bold text-slate-900 dark:text-white truncate text-xs sm:text-sm text-right hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline cursor-pointer"
                            title="فتح صفحة وحساب التاجر"
                          >
                            {op.title}
                          </button>
                        ) : (
                          <span className="font-bold text-slate-900 dark:text-white truncate text-xs sm:text-sm">
                            {op.title}
                          </span>
                        )}
                      </div>

                      {/* Document Reference / Subtitle */}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num truncate mt-0.5">
                        {op.subTitle}
                      </p>
                    </div>
                  </div>

                  {/* Amount Block */}
                  <div className="text-left font-mono-num shrink-0">
                    <span className={`text-xs sm:text-sm font-black block ${colorConfig.amount}`}>
                      {isInv 
                        ? formatCurrency(op.amount, currency) 
                        : isPay
                        ? `+${formatCurrency(op.amount, currency)}`
                        : isExp
                        ? `-${formatCurrency(op.amount, currency)}`
                        : formatCurrency(op.amount, currency)
                      }
                    </span>
                    {isInv && op.remainingAmount > 0 && (
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block">
                        متبقي دين: {formatCurrency(op.remainingAmount, currency)}
                      </span>
                    )}
                    {isOrd && (
                      <span className={`text-[10px] font-bold block ${
                        ordRaw?.status === 'delivered' ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'
                      }`}>
                        {ordRaw?.status === 'delivered' ? 'تم التسليم بالكامل' : `مسلم: ${formatCurrency(ordRaw?.deliveredTotalAmount || 0, currency)}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Subtle Divider */}
                <div className="my-2 border-t border-slate-200/70 dark:border-slate-800/70" />

                {/* Row 2: Date & Time Metadata + Quick Action Buttons */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  {/* Clean Date & Time badges without wrapping bullets */}
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono-num flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      <span>{formatDateArabic(op.date)}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      <span>{getTimeAgoArabic(op.createdAt || op.date)}</span>
                    </span>
                  </div>

                  {/* Actions Group: Print for ALL operations, Edit/Manage, Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Quick Print Button - Available for ALL operations */}
                    <button
                      type="button"
                      title="عرض وطباعة المستند"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isInv && invRaw && onPrintInvoice) {
                          onPrintInvoice(invRaw);
                        } else if (isPay && payRaw && onPrintPayment) {
                          onPrintPayment(payRaw);
                        } else if (isOrd && ordRaw) {
                          const linked = invoices.find(i => i.orderId === ordRaw.id || (i.notes && i.notes.includes(ordRaw.orderNumber)));
                          if (linked && onPrintInvoice) {
                            onPrintInvoice(linked);
                          } else if (onPrintOrder) {
                            onPrintOrder(ordRaw);
                          }
                        } else if (isExp && expRaw && onPrintExpense) {
                          onPrintExpense(expRaw);
                        }
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-white/95 dark:bg-slate-800/95 hover:bg-white dark:hover:bg-slate-700 border border-slate-200/90 dark:border-slate-700 shadow-2xs hover:shadow-xs active:scale-95 transition-all"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-[10px]">طباعة</span>
                    </button>

                    {/* Edit / Deliver Button */}
                    <button
                      type="button"
                      title={isOrd ? "تسليم وإدارة طلب الشغل" : "تعديل العملية"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isInv && invRaw && onEditInvoice) {
                          onEditInvoice(invRaw);
                        } else if (isPay && payRaw && onEditPayment) {
                          onEditPayment(payRaw);
                        } else if (isExp && expRaw) {
                          setEditingExpense(expRaw);
                          setIsExpenseModalOpen(true);
                        } else if (isOrd) {
                          setActiveTab('orders');
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 bg-white/95 dark:bg-slate-800/95 hover:bg-white dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200/90 dark:border-slate-700 shadow-2xs active:scale-95 transition-all"
                    >
                      {isOrd ? <Truck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> : <Edit3 className="w-3.5 h-3.5" />}
                    </button>

                    {/* Direct Delete Button */}
                    <button
                      type="button"
                      title="حذف العملية"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isInv) {
                          setItemToDelete({
                            type: 'invoice',
                            id: op.id,
                            title: 'حذف فاتورة بيع',
                            message: `هل أنت متأكد من حذف فاتورة رقم #${invRaw?.invoiceNumber || ''} للتاجر "${op.title}" بقيمة ${formatCurrency(op.amount, currency)}؟ سيتم حذفها وإلغاء تأثيرها المالي من حساب التاجر.`,
                          });
                        } else if (isPay) {
                          setItemToDelete({
                            type: 'payment',
                            id: op.id,
                            title: 'حذف سند تحصيل دفعة',
                            message: `هل أنت متأكد من حذف سند التحصيل رقم #${payRaw?.receiptNumber || ''} للتاجر "${op.title}" بمبلغ ${formatCurrency(op.amount, currency)}؟ سيتم إرجاع المبلغ دين على التاجر.`,
                          });
                        } else if (isExp) {
                          setItemToDelete({
                            type: 'expense',
                            id: op.id,
                            title: 'حذف مصروف / مسحوبات',
                            message: `هل أنت متأكد من حذف المصروف "${op.title}" بمبلغ ${formatCurrency(op.amount, currency)}؟ سيتم استرجاع المبلغ لصافي التحصيل.`,
                          });
                        } else if (isOrd) {
                          setItemToDelete({
                            type: 'order',
                            id: op.id,
                            title: 'حذف طلب شغل',
                            message: `هل أنت متأكد من حذف طلب الشغل #${ordRaw?.orderNumber || ''} للتاجر "${op.title}"؟`,
                          });
                        }
                      }}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredOperations.length === 0 && (
            <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 space-y-1.5">
              <p>
                {searchTerm || transactionFilter !== 'all'
                  ? 'لا توجد عمليات مطابقة لمعايير البحث أو الفلترة المحددة'
                  : `لا توجد عمليات مسجلة في هذه الفترة (${periodFilter === 'today' ? 'اليوم' : periodFilter === 'week' ? 'هذا الأسبوع' : periodFilter === 'month' ? 'هذا الشهر' : 'كل الوقت'})`}
              </p>
              {(searchTerm || transactionFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setTransactionFilter('all');
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-xs inline-block"
                >
                  إعادة ضبط البحث والفلتر
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL: OPERATION DETAIL & QUICK ACTIONS --- */}
      {selectedOperation && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-3 animate-in slide-in-from-bottom duration-200">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  selectedOperation.type === 'invoice' 
                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400' 
                    : selectedOperation.type === 'payment'
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400'
                    : selectedOperation.type === 'expense'
                    ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400'
                    : 'bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-400'
                }`}>
                  {selectedOperation.type === 'invoice' ? (
                    selectedOperation.rawInvoice?.orderId ? <Truck className="w-4 h-4" /> : <Receipt className="w-4 h-4" />
                  ) : selectedOperation.type === 'payment' ? (
                    <HandCoins className="w-4 h-4" />
                  ) : selectedOperation.type === 'expense' ? (
                    <ArrowDownCircle className="w-4 h-4" />
                  ) : (
                    <Truck className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    {selectedOperation.type === 'invoice' 
                      ? (selectedOperation.rawInvoice?.orderId ? `فاتورة تسليم طلب #${selectedOperation.rawInvoice?.invoiceNumber}` : `فاتورة بيع #${selectedOperation.rawInvoice?.invoiceNumber}`)
                      : selectedOperation.type === 'payment'
                      ? `سند تحصيل دفعة #${selectedOperation.rawPayment?.receiptNumber || ''}`
                      : selectedOperation.type === 'expense'
                      ? `مسحوبات / مصروف`
                      : `طلب شغل #${selectedOperation.rawOrder?.orderNumber}`}
                  </h4>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono-num">
                    {formatDateArabic(selectedOperation.rawInvoice?.date || selectedOperation.rawPayment?.date || selectedOperation.rawExpense?.date || selectedOperation.rawOrder?.date || '')}
                    {(selectedOperation.rawInvoice?.createdAt || selectedOperation.rawPayment?.createdAt || selectedOperation.rawExpense?.createdAt || selectedOperation.rawOrder?.createdAt) && (
                      <> • {formatTimeAgoArabic(selectedOperation.rawInvoice?.createdAt || selectedOperation.rawPayment?.createdAt || selectedOperation.rawExpense?.createdAt || selectedOperation.rawOrder?.createdAt)}</>
                    )}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedOperation(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details Body */}
            {selectedOperation.type === 'invoice' && selectedOperation.rawInvoice && (
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800 items-center">
                  <span className="text-slate-500 dark:text-slate-400">اسم التاجر:</span>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectMerchant(selectedOperation.rawInvoice!.merchantId);
                      setSelectedOperation(null);
                    }}
                    className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                    title="فتح صفحة التاجر"
                  >
                    <span>{selectedOperation.rawInvoice.merchantName}</span>
                    <span className="text-[10px] text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded-md font-bold">
                      عرض الحساب ↗
                    </span>
                  </button>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800 font-mono-num">
                  <span className="text-slate-500 dark:text-slate-400">إجمالي الفاتورة:</span>
                  <span className="font-bold text-blue-700 dark:text-blue-300 text-sm">
                    {formatCurrency(selectedOperation.rawInvoice.total, currency)}
                  </span>
                </div>
                {selectedOperation.rawInvoice.discount > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800 font-mono-num text-amber-700 dark:text-amber-400">
                    <span>الخصم الممنوح:</span>
                    <span>-{formatCurrency(selectedOperation.rawInvoice.discount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800 font-mono-num">
                  <span className="text-slate-500 dark:text-slate-400">المدفوع نقداً:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(selectedOperation.rawInvoice.paidAmount, currency)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800 font-mono-num">
                  <span className="text-slate-500 dark:text-slate-400">المتبقي دين:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {formatCurrency(selectedOperation.rawInvoice.remainingAmount, currency)}
                  </span>
                </div>

                {/* Items */}
                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block mb-1">الأصناف المسجلة ({selectedOperation.rawInvoice.items.length}):</span>
                  <div className="max-h-28 overflow-y-auto space-y-1 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
                    {selectedOperation.rawInvoice.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-[11px] font-mono-num">
                        <span className="text-slate-800 dark:text-slate-200">{it.productName} × {it.quantity}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(it.total, currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedOperation.rawInvoice.notes && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
                    ملاحظات: {selectedOperation.rawInvoice.notes}
                  </div>
                )}
              </div>
            )}

            {selectedOperation.type === 'payment' && selectedOperation.rawPayment && (
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800 items-center">
                  <span className="text-slate-500 dark:text-slate-400">اسم التاجر:</span>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectMerchant(selectedOperation.rawPayment!.merchantId);
                      setSelectedOperation(null);
                    }}
                    className="font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                    title="فتح صفحة التاجر"
                  >
                    <span>{selectedOperation.rawPayment.merchantName}</span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded-md font-bold">
                      عرض الحساب ↗
                    </span>
                  </button>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800 font-mono-num">
                  <span className="text-slate-500 dark:text-slate-400">المبلغ المستلم:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    +{formatCurrency(selectedOperation.rawPayment.amount, currency)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">طريقة الدفع:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedOperation.rawPayment.paymentMethod}</span>
                </div>
                {selectedOperation.rawPayment.notes && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
                    ملاحظات: {selectedOperation.rawPayment.notes}
                  </div>
                )}
              </div>
            )}

            {selectedOperation.type === 'expense' && selectedOperation.rawExpense && (
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">البيان / السبب:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedOperation.rawExpense.title}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">التصنيف:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedOperation.rawExpense.category}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800 font-mono-num">
                  <span className="text-slate-500 dark:text-slate-400">المبلغ المسحوب:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                    -{formatCurrency(selectedOperation.rawExpense.amount, currency)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">طريقة السحب/الدفع:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedOperation.rawExpense.paymentMethod}</span>
                </div>
                {selectedOperation.rawExpense.notes && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
                    ملاحظات: {selectedOperation.rawExpense.notes}
                  </div>
                )}
              </div>
            )}

            {selectedOperation.type === 'order' && selectedOperation.rawOrder && (
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800 items-center">
                  <span className="text-slate-500 dark:text-slate-400">اسم التاجر:</span>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectMerchant(selectedOperation.rawOrder!.merchantId);
                      setSelectedOperation(null);
                    }}
                    className="font-bold text-slate-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 hover:underline cursor-pointer flex items-center gap-1"
                    title="فتح صفحة التاجر"
                  >
                    <span>{selectedOperation.rawOrder.merchantName}</span>
                    <span className="text-[10px] text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded-md font-bold">
                      عرض الحساب ↗
                    </span>
                  </button>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800 items-center">
                  <span className="text-slate-500 dark:text-slate-400">حالة الطلب:</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    selectedOperation.rawOrder.status === 'delivered'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : selectedOperation.rawOrder.status === 'partially_delivered'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                  }`}>
                    {selectedOperation.rawOrder.status === 'delivered' ? 'تم التسليم بالكامل' : selectedOperation.rawOrder.status === 'partially_delivered' ? 'تسليم جزئي' : 'قيد التحضير'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800 font-mono-num">
                  <span className="text-slate-500 dark:text-slate-400">القيمة التقديرية:</span>
                  <span className="font-bold text-purple-700 dark:text-purple-300 text-sm">
                    {formatCurrency(selectedOperation.rawOrder.totalEstimatedAmount, currency)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800 font-mono-num">
                  <span className="text-slate-500 dark:text-slate-400">المبلغ المسلم:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(selectedOperation.rawOrder.deliveredTotalAmount || 0, currency)}
                  </span>
                </div>

                {/* Items */}
                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block mb-1">
                    الأصناف المطلوبة ({selectedOperation.rawOrder.items.length}):
                  </span>
                  <div className="max-h-28 overflow-y-auto space-y-1 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
                    {selectedOperation.rawOrder.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-[11px] font-mono-num">
                        <span className="text-slate-800 dark:text-slate-200">
                          {it.productName} × {it.quantityOrdered} (مسلم: {it.quantityDelivered})
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatCurrency(it.unitPrice * it.quantityOrdered, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedOperation.rawOrder.notes && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl">
                    ملاحظات: {selectedOperation.rawOrder.notes}
                  </div>
                )}
              </div>
            )}

            {/* Actions Grid */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (selectedOperation.type === 'invoice' && selectedOperation.rawInvoice && onPrintInvoice) {
                    onPrintInvoice(selectedOperation.rawInvoice);
                  } else if (selectedOperation.type === 'payment' && selectedOperation.rawPayment && onPrintPayment) {
                    onPrintPayment(selectedOperation.rawPayment);
                  } else if (selectedOperation.type === 'order' && selectedOperation.rawOrder) {
                    const ord = selectedOperation.rawOrder;
                    const linked = invoices.find(i => i.orderId === ord.id || (i.notes && i.notes.includes(ord.orderNumber)));
                    if (linked && onPrintInvoice) {
                      onPrintInvoice(linked);
                    } else if (onPrintOrder) {
                      onPrintOrder(ord);
                    }
                  } else if (selectedOperation.type === 'expense' && selectedOperation.rawExpense && onPrintExpense) {
                    onPrintExpense(selectedOperation.rawExpense);
                  }
                  setSelectedOperation(null);
                }}
                className="py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center gap-1 active:scale-98 transition-all"
              >
                <Printer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>طباعة</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (selectedOperation.type === 'invoice' && selectedOperation.rawInvoice && onEditInvoice) {
                    onEditInvoice(selectedOperation.rawInvoice);
                  } else if (selectedOperation.type === 'payment' && selectedOperation.rawPayment && onEditPayment) {
                    onEditPayment(selectedOperation.rawPayment);
                  } else if (selectedOperation.type === 'expense' && selectedOperation.rawExpense) {
                    setEditingExpense(selectedOperation.rawExpense);
                    setIsExpenseModalOpen(true);
                  } else if (selectedOperation.type === 'order') {
                    setActiveTab('orders');
                  }
                  setSelectedOperation(null);
                }}
                className="py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>تعديل</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (selectedOperation.type === 'invoice' && selectedOperation.rawInvoice) {
                    setItemToDelete({
                      type: 'invoice',
                      id: selectedOperation.rawInvoice.id,
                      title: 'حذف فاتورة بيع',
                      message: `هل أنت متأكد من حذف فاتورة رقم #${selectedOperation.rawInvoice.invoiceNumber} للتاجر "${selectedOperation.rawInvoice.merchantName}"؟`,
                    });
                  } else if (selectedOperation.type === 'payment' && selectedOperation.rawPayment) {
                    setItemToDelete({
                      type: 'payment',
                      id: selectedOperation.rawPayment.id,
                      title: 'حذف سند تحصيل',
                      message: `هل أنت متأكد من حذف سند التحصيل رقم #${selectedOperation.rawPayment.receiptNumber} بمبلغ ${formatCurrency(selectedOperation.rawPayment.amount, currency)}؟`,
                    });
                  } else if (selectedOperation.type === 'expense' && selectedOperation.rawExpense) {
                    setItemToDelete({
                      type: 'expense',
                      id: selectedOperation.rawExpense.id,
                      title: 'حذف مصروف / مسحوبات',
                      message: `هل أنت متأكد من حذف المصروف "${selectedOperation.rawExpense.title}" بمبلغ ${formatCurrency(selectedOperation.rawExpense.amount, currency)}؟`,
                    });
                  } else if (selectedOperation.type === 'order' && selectedOperation.rawOrder) {
                    setItemToDelete({
                      type: 'order',
                      id: selectedOperation.rawOrder.id,
                      title: 'حذف طلب شغل',
                      message: `هل أنت متأكد من حذف طلب الشغل #${selectedOperation.rawOrder.orderNumber} للتاجر "${selectedOperation.rawOrder.merchantName}"؟`,
                    });
                  }
                }}
                className="py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-bold flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting Operations */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        title={itemToDelete?.title || ''}
        message={itemToDelete?.message || ''}
        confirmText="نعم، احذف العملية"
        cancelText="إلغاء"
        onConfirm={handleConfirmDelete}
        onClose={() => setItemToDelete(null)}
      />

      {/* Modal for Creating or Editing Expenses / Withdrawals */}
      {isExpenseModalOpen && (
        <ExpenseModal
          initialExpense={editingExpense}
          onClose={() => {
            setIsExpenseModalOpen(false);
            setEditingExpense(null);
          }}
        />
      )}

      {/* Modal for General Cash Deposit */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3 shrink-0">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <span>إيداع نقدي / إيراد عام</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsDepositModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveDeposit} className="flex-1 overflow-y-auto overscroll-contain space-y-3.5 text-xs sm:text-sm pr-0.5">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  مبلغ الإيداع ({currency}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 text-base font-bold text-left placeholder:text-slate-400"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات (اختياري)
                </label>
                <textarea
                  rows={3}
                  placeholder="مثال: إيراد يومي، تمويل خارجي، سيولة نقدية..."
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 text-xs placeholder:text-slate-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 pb-8 sm:pb-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 mb-2 sm:mb-0 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDepositModalOpen(false)}
                  className="py-3 sm:py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs active:scale-95 transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="py-3 sm:py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Wallet className="w-4 h-4" />
                  <span>حفظ الإيداع</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
