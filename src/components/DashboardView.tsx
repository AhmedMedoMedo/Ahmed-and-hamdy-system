import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { Invoice, Payment, Expense } from '../types';
import { 
  formatCurrency, 
  formatDateArabic,
  getTodayDateString,
  isDateToday,
  isDateWithinDays,
  isDateInCurrentMonth 
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
  Coins
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
}

type PeriodFilter = 'today' | 'week' | 'month' | 'all';

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
  onPrintPayment
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
    pendingOrdersCount,
    setActiveTab,
    removeInvoice,
    removePayment,
    removeExpense,
    showToast
  } = useApp();

  // Period filter applied to BOTH top statistics cards AND recent operations
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');

  // Expense modal state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Deletion confirm modal state
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'invoice' | 'payment' | 'expense';
    id: string;
    title: string;
    message: string;
  } | null>(null);

  // Selected operation detail modal state
  const [selectedOperation, setSelectedOperation] = useState<{
    type: 'invoice' | 'payment' | 'expense';
    id: string;
    rawInvoice?: Invoice;
    rawPayment?: Payment;
    rawExpense?: Expense;
  } | null>(null);

  // Top debtors (Merchants with positive debt)
  const sortedDebtors = Object.values(merchantBalances)
    .filter(b => b.currentDebt > 0)
    .sort((a, b) => b.currentDebt - a.currentDebt);

  // Total current debt owed by all merchants
  const totalCurrentDebt = useMemo(() => {
    return Object.values(merchantBalances).reduce((sum, b) => sum + Math.max(0, b.currentDebt), 0);
  }, [merchantBalances]);

  // Combined Operations (Invoices + Payments + Expenses/Withdrawals)
  const allCombinedOperations = useMemo(() => {
    const invOps = invoices.map(inv => ({
      id: inv.id,
      merchantId: inv.merchantId,
      type: 'invoice' as const,
      date: inv.date,
      createdAt: inv.createdAt,
      title: inv.merchantName,
      subTitle: `فاتورة #${inv.invoiceNumber}`,
      amount: inv.total,
      remainingAmount: inv.remainingAmount,
      isPaid: inv.remainingAmount <= 0,
      notes: inv.notes,
      raw: inv,
    }));

    const payOps = payments.map(pay => ({
      id: pay.id,
      merchantId: pay.merchantId,
      type: 'payment' as const,
      date: pay.date,
      createdAt: pay.createdAt,
      title: pay.merchantName,
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
      type: 'expense' as const,
      date: exp.date,
      createdAt: exp.createdAt,
      title: exp.title,
      subTitle: `مسحوبات (${exp.category}) • ${exp.paymentMethod}`,
      amount: exp.amount,
      remainingAmount: 0,
      isPaid: true,
      notes: exp.notes,
      raw: exp,
    }));

    return [...invOps, ...payOps, ...expOps].sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [invoices, payments, expenses]);

  // Filtered Operations based on the period selector
  const filteredOperations = useMemo(() => {
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

  // Statistics for the chosen filter period
  const periodStats = useMemo(() => {
    let sales = 0;
    let collections = 0;
    let expensesSum = 0;
    let invoiceCount = 0;
    let paymentCount = 0;
    let expenseCount = 0;

    filteredOperations.forEach(op => {
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
      count: filteredOperations.length,
      netChange,
      collectionRate,
    };
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
    } else {
      const exp = expenses.find(e => e.id === op.id);
      setSelectedOperation({ type: 'expense', id: op.id, rawExpense: exp });
    }
  };

  return (
    <div className="space-y-3 pb-8">
      
      {/* Primary Mobile Action Buttons (3 Buttons: Invoices, Payments, Withdrawals/Expenses) */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={onOpenNewInvoice}
          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold shadow-2xs transition-all text-center"
        >
          <Receipt className="w-5 h-5 mb-1 text-emerald-100" />
          <span className="text-[11px] sm:text-xs leading-tight">فاتورة بيع</span>
          <span className="text-[9px] text-emerald-200 mt-0.5">بيع بضاعة</span>
        </button>

        <button
          onClick={onOpenNewPayment}
          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold shadow-2xs transition-all text-center"
        >
          <HandCoins className="w-5 h-5 mb-1 text-teal-100" />
          <span className="text-[11px] sm:text-xs leading-tight">دفعة تاجر</span>
          <span className="text-[9px] text-teal-200 mt-0.5">تحصيل وتسديد</span>
        </button>

        <button
          onClick={() => {
            setEditingExpense(null);
            setIsExpenseModalOpen(true);
          }}
          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold shadow-2xs transition-all text-center"
        >
          <ArrowDownCircle className="w-5 h-5 mb-1 text-rose-100" />
          <span className="text-[11px] sm:text-xs leading-tight">مسحوبات</span>
          <span className="text-[9px] text-rose-200 mt-0.5">مصاريف وصيانة</span>
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
        
        {/* Card 1: Sales in selected period */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1 font-semibold">
            <span>
              {periodFilter === 'today' && 'مبيعات اليوم'}
              {periodFilter === 'week' && 'مبيعات الأسبوع'}
              {periodFilter === 'month' && 'مبيعات الشهر'}
              {periodFilter === 'all' && 'إجمالي المبيعات'}
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono-num">
            {formatCurrency(
              periodFilter === 'month' ? currentMonthSummary.newSales : periodStats.sales, 
              currency
            )}
          </div>
          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-bold font-mono-num flex items-center gap-1">
            <span>{periodFilter === 'month' ? currentMonthSummary.invoicesCount : periodStats.invoiceCount}</span>
            <span>عملية بيع مسجلة</span>
          </div>
        </div>

        {/* Card 2: Collections in selected period */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1 font-semibold">
            <span>
              {periodFilter === 'today' && 'تحصيل اليوم'}
              {periodFilter === 'week' && 'تحصيل الأسبوع'}
              {periodFilter === 'month' && 'تحصيل الشهر'}
              {periodFilter === 'all' && 'إجمالي التحصيل'}
            </span>
            <HandCoins className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-teal-700 dark:text-teal-400 font-mono-num">
            +{formatCurrency(
              periodFilter === 'month' ? currentMonthSummary.newCollections : periodStats.collections, 
              currency
            )}
          </div>
          <div className="text-[10px] text-teal-700 dark:text-teal-400 mt-0.5 font-bold font-mono-num flex items-center gap-1">
            <span>{periodFilter === 'month' ? currentMonthSummary.paymentsCount : periodStats.paymentCount}</span>
            <span>عملية تحصيل مستلمة</span>
          </div>
        </div>

        {/* Card 3: Expenses / Withdrawals in selected period (User Requested) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10 shadow-2xs">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs mb-1 font-semibold">
            <span>
              {periodFilter === 'today' && 'مسحوبات اليوم'}
              {periodFilter === 'week' && 'مسحوبات الأسبوع'}
              {periodFilter === 'month' && 'مسحوبات الشهر'}
              {periodFilter === 'all' && 'إجمالي المسحوبات'}
            </span>
            <ArrowDownCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 font-mono-num">
            -{formatCurrency(
              periodFilter === 'month' ? currentMonthSummary.newExpenses : periodStats.expensesSum, 
              currency
            )}
          </div>
          <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 font-bold font-mono-num flex items-center gap-1">
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/20 shadow-2xs">
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

      {/* Outstanding Merchant Debts Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>ديون التجار المطلوب تحصيلها</span>
          </h3>
          <button
            onClick={() => setActiveTab('merchants')}
            className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold flex items-center gap-0.5"
          >
            كل التجار ({merchants.length})
            <ChevronLeft className="w-3 h-3" />
          </button>
        </div>

        {sortedDebtors.length === 0 ? (
          <div className="text-center py-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">لا توجد ديون مستحقة على التجار!</p>
            <p className="text-[11px] text-slate-400 mt-0.5">جميع الحسابات مسددة بالكامل.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedDebtors.slice(0, 4).map((debtor) => (
              <div
                key={debtor.merchantId}
                onClick={() => onSelectMerchant(debtor.merchantId)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer active:scale-99 transition-all"
              >
                <div className="min-w-0 pr-1">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs truncate">{debtor.merchantName}</h4>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    مسحوبات: {formatCurrency(debtor.totalInvoicedAllTime, currency)}
                  </div>
                </div>
                
                <div className="text-left shrink-0 pl-1 font-mono-num">
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold block">المتبقي دين</span>
                  <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                    {formatCurrency(debtor.currentDebt, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
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

        {/* Totals Banner for Filtered Operations */}
        <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-xs font-mono-num text-center">
          <div>
            <span className="text-[9px] text-slate-400 block font-sans">المبيعات</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 text-[11px]">
              {formatCurrency(periodStats.sales, currency)}
            </span>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 block font-sans">التحصيلات</span>
            <span className="font-bold text-teal-700 dark:text-teal-400 text-[11px]">
              +{formatCurrency(periodStats.collections, currency)}
            </span>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 block font-sans">المسحوبات</span>
            <span className="font-bold text-rose-600 dark:text-rose-400 text-[11px]">
              -{formatCurrency(periodStats.expensesSum, currency)}
            </span>
          </div>
        </div>

        {/* List of operations with Delete & Edit buttons */}
        <div className="space-y-1.5">
          {filteredOperations.slice(0, 15).map((op) => {
            const isInv = op.type === 'invoice';
            const isPay = op.type === 'payment';
            const isExp = op.type === 'expense';
            const invRaw = isInv ? (op.raw as Invoice) : undefined;
            const payRaw = isPay ? (op.raw as Payment) : undefined;
            const expRaw = isExp ? (op.raw as Expense) : undefined;

            return (
              <div 
                key={op.type + '_' + op.id} 
                onClick={() => handleOpenOperationDetail(op)}
                className={`flex items-center justify-between p-2 rounded-xl text-xs border cursor-pointer hover:shadow-2xs transition-all ${
                  isInv 
                    ? 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700' 
                    : isPay
                    ? 'bg-teal-50/40 dark:bg-teal-950/20 border-teal-100 dark:border-teal-900/40 hover:border-teal-200'
                    : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/40 hover:border-rose-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isInv 
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400' 
                      : isPay
                      ? 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400'
                  }`}>
                    {isInv ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : isPay ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowDownCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 pr-1">
                    {op.merchantId ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMerchant(op.merchantId!);
                        }}
                        className="font-bold text-slate-900 dark:text-white block truncate text-right hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline cursor-pointer"
                        title="فتح صفحة وحساب التاجر"
                      >
                        {op.title}
                      </button>
                    ) : (
                      <span className="font-bold text-slate-900 dark:text-white block truncate">{op.title}</span>
                    )}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-mono-num truncate">
                      {op.subTitle} • {formatDateArabic(op.date)}
                    </span>
                  </div>
                </div>

                {/* Amount + Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 pl-1">
                  <div className="text-left font-mono-num">
                    <span className={`font-bold block text-xs ${
                      isInv 
                        ? 'text-emerald-700 dark:text-emerald-400' 
                        : isPay
                        ? 'text-teal-700 dark:text-teal-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {isInv 
                        ? formatCurrency(op.amount, currency) 
                        : isPay
                        ? `+${formatCurrency(op.amount, currency)}`
                        : `-${formatCurrency(op.amount, currency)}`
                      }
                    </span>
                    {isInv && op.remainingAmount > 0 && (
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 block">
                        متبقي: {formatCurrency(op.remainingAmount, currency)}
                      </span>
                    )}
                  </div>

                  {/* Direct Action Buttons on Row */}
                  <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-700 pr-1 mr-1">
                    {/* Quick Print/Share (for invoices and payments) */}
                    {!isExp && (
                      <button
                        type="button"
                        title="عرض وطباعة"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isInv && invRaw && onPrintInvoice) {
                            onPrintInvoice(invRaw);
                          } else if (isPay && payRaw && onPrintPayment) {
                            onPrintPayment(payRaw);
                          }
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Edit Button */}
                    <button
                      type="button"
                      title="تعديل العملية"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isInv && invRaw && onEditInvoice) {
                          onEditInvoice(invRaw);
                        } else if (isPay && payRaw && onEditPayment) {
                          onEditPayment(payRaw);
                        } else if (isExp && expRaw) {
                          setEditingExpense(expRaw);
                          setIsExpenseModalOpen(true);
                        }
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
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
                        }
                      }}
                      className="p-1 rounded-lg text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredOperations.length === 0 && (
            <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              لا توجد عمليات مسجلة في هذه الفترة ({periodFilter === 'today' ? 'اليوم' : periodFilter === 'week' ? 'هذا الأسبوع' : periodFilter === 'month' ? 'هذا الشهر' : 'كل الوقت'})
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
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400' 
                    : selectedOperation.type === 'payment'
                    ? 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400'
                    : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400'
                }`}>
                  {selectedOperation.type === 'invoice' ? (
                    <FileText className="w-4 h-4" />
                  ) : selectedOperation.type === 'payment' ? (
                    <HandCoins className="w-4 h-4" />
                  ) : (
                    <ArrowDownCircle className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    {selectedOperation.type === 'invoice' 
                      ? `فاتورة بيع #${selectedOperation.rawInvoice?.invoiceNumber}` 
                      : selectedOperation.type === 'payment'
                      ? `سند تحصيل دفعة #${selectedOperation.rawPayment?.receiptNumber || ''}`
                      : `مسحوبات / مصروف`}
                  </h4>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {formatDateArabic(selectedOperation.rawInvoice?.date || selectedOperation.rawPayment?.date || selectedOperation.rawExpense?.date || '')}
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
                    className="font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                    title="فتح صفحة التاجر"
                  >
                    <span>{selectedOperation.rawInvoice.merchantName}</span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded-md font-bold">
                      عرض الحساب ↗
                    </span>
                  </button>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800 font-mono-num">
                  <span className="text-slate-500 dark:text-slate-400">إجمالي الفاتورة:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
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
                  <span className="font-bold text-teal-700 dark:text-teal-400">
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
                    className="font-bold text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 hover:underline cursor-pointer flex items-center gap-1"
                    title="فتح صفحة التاجر"
                  >
                    <span>{selectedOperation.rawPayment.merchantName}</span>
                    <span className="text-[10px] text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.2 rounded-md font-bold">
                      عرض الحساب ↗
                    </span>
                  </button>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800 font-mono-num">
                  <span className="text-slate-500 dark:text-slate-400">المبلغ المستلم:</span>
                  <span className="font-bold text-teal-700 dark:text-teal-400 text-sm">
                    {formatCurrency(selectedOperation.rawPayment.amount, currency)}
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
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                    {formatCurrency(selectedOperation.rawExpense.amount, currency)}
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

            {/* Actions Grid */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-1.5">
              {selectedOperation.type !== 'expense' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedOperation.type === 'invoice' && selectedOperation.rawInvoice && onPrintInvoice) {
                      onPrintInvoice(selectedOperation.rawInvoice);
                    } else if (selectedOperation.type === 'payment' && selectedOperation.rawPayment && onPrintPayment) {
                      onPrintPayment(selectedOperation.rawPayment);
                    }
                    setSelectedOperation(null);
                  }}
                  className="py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة</span>
                </button>
              ) : (
                <div />
              )}

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

    </div>
  );
};
