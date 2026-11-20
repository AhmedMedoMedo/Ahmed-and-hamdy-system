import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { Payment, PaymentMethod } from '../types';
import { 
  formatCurrency, 
  formatDateArabic, 
  getTimeAgoArabic,
  getTodayDateString, 
  generateReceiptNumber,
  getMonthKeyFromDate,
  formatMonthName 
} from '../utils/formatters';
import { ConfirmModal } from './ConfirmModal';
import { 
  HandCoins, 
  Search, 
  Plus, 
  Calendar, 
  Printer, 
  Edit3, 
  Trash2, 
  X, 
  Banknote,
  ArrowDownLeft,
  AlertCircle,
  Clock,
  Percent
} from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';

interface PaymentsViewProps {
  initialOpenCreate?: boolean;
  initialMerchantId?: string | null;
  initialEditingPayment?: Payment | null;
  onClearInitialCreate?: () => void;
  onPrintPayment?: (payment: Payment) => void;
  onSelectMerchant?: (merchantId: string) => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  initialOpenCreate = false,
  initialMerchantId = null,
  initialEditingPayment = null,
  onClearInitialCreate,
  onPrintPayment,
  onSelectMerchant,
}) => {
  const { 
    payments, 
    merchants, 
    merchantBalances, 
    selectedMonth, 
    currency, 
    savePayment, 
    saveExpense,
    removePayment,
    showToast 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonthMode, setFilterMonthMode] = useState<'current' | 'all'>('current');
  const [isFormOpen, setIsFormOpen] = useState(initialOpenCreate);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  // Form State
  const [merchantId, setMerchantId] = useState(initialMerchantId || '');
  const [amount, setAmount] = useState<string>('');
  const [discount, setDiscount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('كاش');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [excludeFromStats, setExcludeFromStats] = useState(false);
  const [isDirectExpense, setIsDirectExpense] = useState(false);
  const [expenseReason, setExpenseReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showAllMerchants, setShowAllMerchants] = useState(false);

  // Safe numeric calculations for cash & allowed discount
  const cashAmount = Math.max(0, Number(amount) || 0);
  const discountAmount = Math.max(0, Number(discount) || 0);
  const totalDeductedFromMerchant = cashAmount + discountAmount;

  // Delete modal state
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  // Selected merchant's current debt
  const selectedMerchantDebt = useMemo(() => {
    if (!merchantId) return 0;
    return merchantBalances[merchantId]?.currentDebt || 0;
  }, [merchantId, merchantBalances]);

  useEffect(() => {
    if (initialEditingPayment) {
      handleOpenForm(initialEditingPayment);
    } else if (initialOpenCreate) {
      handleOpenForm(undefined, initialMerchantId || undefined);
    }
  }, [initialOpenCreate, initialMerchantId, initialEditingPayment]);

  const sortedDebtorMerchants = useMemo(() => {
    return merchants
      .filter((m) => (merchantBalances[m.id]?.currentDebt || 0) > 0)
      .sort((a, b) => (merchantBalances[b.id]?.currentDebt || 0) - (merchantBalances[a.id]?.currentDebt || 0));
  }, [merchants, merchantBalances]);

  const merchantSelectOptions = useMemo(() => {
    const sourceList = showAllMerchants
      ? [...merchants].sort(
          (a, b) => (merchantBalances[b.id]?.currentDebt || 0) - (merchantBalances[a.id]?.currentDebt || 0)
        )
      : sortedDebtorMerchants;

    return sourceList.map((m) => {
      const debt = merchantBalances[m.id]?.currentDebt || 0;
      return {
        id: m.id,
        label: m.name,
        subLabel: m.phone ? `هاتف: ${m.phone}` : undefined,
        badge: debt > 0 ? `دين: ${formatCurrency(debt, currency)}` : 'خالص',
        badgeColor:
          debt > 0
            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400',
      };
    });
  }, [merchants, sortedDebtorMerchants, merchantBalances, showAllMerchants, currency]);

  const selectedMerchantFallback = useMemo(() => {
    if (!merchantId) return undefined;
    const m = merchants.find((item) => item.id === merchantId);
    if (!m) return undefined;
    const debt = merchantBalances[m.id]?.currentDebt || 0;
    return {
      id: m.id,
      label: m.name,
      subLabel: m.phone ? `هاتف: ${m.phone}` : undefined,
      badge: debt > 0 ? `دين: ${formatCurrency(debt, currency)}` : 'خالص',
      badgeColor:
        debt > 0
          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400',
    };
  }, [merchantId, merchants, merchantBalances, currency]);

  const handleOpenForm = (existing?: Payment, preselectedMerchantId?: string) => {
    setFormError(null);
    setDiscount('');
    setShowAllMerchants(false);
    if (existing) {
      setEditingPayment(existing);
      setMerchantId(existing.merchantId);
      setAmount(String(existing.amount));
      setPaymentDate(existing.date);
      setPaymentMethod(existing.paymentMethod);
      setReceiptNumber(existing.receiptNumber || '');
      setNotes(existing.notes || '');
      setExcludeFromStats(Boolean(existing.excludeFromStats));
      setIsDirectExpense(false);
      setExpenseReason('');
    } else {
      setEditingPayment(null);
      const chosenMerchant = preselectedMerchantId || (sortedDebtorMerchants[0]?.id || '');
      setMerchantId(chosenMerchant);
      setAmount('');
      setPaymentDate(getTodayDateString());
      setPaymentMethod('كاش');
      setReceiptNumber(generateReceiptNumber(payments.length));
      setNotes('');
      setExcludeFromStats(false);
      setIsDirectExpense(false);
      setExpenseReason('');
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingPayment(null);
    setDiscount('');
    setShowAllMerchants(false);
    setIsDirectExpense(false);
    setExpenseReason('');
    setFormError(null);
    if (onClearInitialCreate) onClearInitialCreate();
  };

  const handleFillFullDebt = () => {
    if (selectedMerchantDebt > 0) {
      setAmount(String(selectedMerchantDebt));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!merchantId) {
      setFormError('يرجى اختيار التاجر أولاً');
      return;
    }

    if (cashAmount <= 0 && discountAmount <= 0) {
      setFormError('يرجى إدخال المبلغ المستلم أو قيمة الخصم المسموح به');
      return;
    }

    if (cashAmount > 0 && isDirectExpense && expenseReason.trim() === '') {
      setFormError('يرجى كتابة سبب السحب أو اسم المورد للترحيل المباشر للمسحوبات');
      return;
    }

    const m = merchants.find(item => item.id === merchantId);
    const mName = m ? m.name : 'تاجر غير محدد';
    const monthKey = getMonthKeyFromDate(paymentDate);
    const finalReceiptNumber = receiptNumber.trim() || `سند-${Date.now().toString().slice(-4)}`;
    const trimmedNotes = notes.trim();

    try {
      // 1) الدفعة النقدية الفعلية (تُضاف للخزينة والإحصائيات ما لم يتم استبعادها، وتُرحل للمسحوبات إذا تم تفعيل الخيار)
      if (cashAmount > 0) {
        const cashNotes = discountAmount > 0
          ? (trimmedNotes
              ? `${trimmedNotes} (مع خصم مسموح به بقيمة ${discountAmount} ${currency})`
              : `مع خصم مسموح به بقيمة ${discountAmount} ${currency}`)
          : trimmedNotes;

        await savePayment({
          ...(editingPayment ? { id: editingPayment.id } : {}),
          merchantId,
          merchantName: mName,
          amount: cashAmount,
          date: paymentDate,
          monthKey,
          paymentMethod,
          receiptNumber: finalReceiptNumber,
          notes: cashNotes,
          excludeFromStats,
          ...(editingPayment?.isDiscount ? { isDiscount: true } : {}),
        });

        if (isDirectExpense && expenseReason.trim() !== '') {
          const trimmedReason = expenseReason.trim();
          await saveExpense({
            title: `صرف مباشر من دفعة التاجر (${mName}): ${trimmedReason}`,
            category: 'مصاريف عامة وتوريد',
            amount: cashAmount,
            date: paymentDate,
            monthKey,
            paymentMethod,
            notes: `ترحيل مباشر من سند قبض #${finalReceiptNumber} للتاجر ${mName}`,
          });
        }
      }

      // 2) حركة الخصم المسموح به (تُخصم من دين التاجر فقط ولا تدخل الخزينة أو إحصائيات التحصيل)
      if (discountAmount > 0) {
        const discountReceipt = cashAmount > 0
          ? `${finalReceiptNumber}-خصم`
          : `خصم-${Date.now().toString().slice(-4)}`;

        await savePayment({
          merchantId,
          merchantName: mName,
          amount: discountAmount,
          date: paymentDate,
          monthKey,
          paymentMethod,
          receiptNumber: discountReceipt,
          notes: trimmedNotes ? `خصم مسموح به للتاجر - ${trimmedNotes}` : 'خصم مسموح به للتاجر',
          excludeFromStats: true,
          isDiscount: true,
        });
      }

      if (cashAmount > 0 && discountAmount > 0) {
        showToast(
          isDirectExpense && expenseReason.trim() !== ''
            ? 'تم استلام الدفعة وترحيلها للمسحوبات مع تسجيل الخصم المسموح به'
            : 'تم استلام الدفعة وتسجيل الخصم المسموح به وتحديث حساب التاجر'
        );
      } else if (discountAmount > 0) {
        showToast('تم تسجيل الخصم المسموح به وتخفيض دين التاجر دون التأثير على الخزينة');
      } else {
        showToast(
          isDirectExpense && expenseReason.trim() !== ''
            ? 'تم استلام الدفعة وترحيلها مباشرة للمسحوبات بنجاح'
            : editingPayment
            ? 'تم تعديل سند القبض'
            : 'تم استلام الدفعة وتخفيض دين التاجر'
        );
      }
    } catch (err: any) {
      console.warn("Payment offline catch:", err);
      showToast('تم حفظ العملية محلياً (أوفلاين) وستتم المزامنة عند عودة الإنترنت');
    } finally {
      handleCloseForm();
    }
  };

  // Safe delete
  const handleConfirmDelete = async () => {
    if (!paymentToDelete) return;
    await removePayment(paymentToDelete.id);
    showToast('تم حذف سند الدفعة وإعادة المبلغ كدين مستحق على التاجر');
    setPaymentToDelete(null);
  };

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return payments
      .filter(p => {
        if (filterMonthMode === 'current') {
          const m = p.monthKey || getMonthKeyFromDate(p.date);
          if (m !== selectedMonth) return false;
        }
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
          p.merchantName.toLowerCase().includes(q) ||
          (p.receiptNumber && p.receiptNumber.toLowerCase().includes(q)) ||
          p.paymentMethod.toLowerCase().includes(q) ||
          (p.notes && p.notes.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [payments, selectedMonth, filterMonthMode, searchTerm]);

  return (
    <div className="space-y-3.5 pb-24">
      
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <HandCoins className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <span>سندات قبض دفعات التجار</span>
            <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono-num font-bold">
              {filteredPayments.length}
            </span>
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {filterMonthMode === 'current'
              ? `تحصيلات شهر ${formatMonthName(selectedMonth)}`
              : 'جميع الدفعات المستلمة'}
          </p>
        </div>

        <button
          onClick={() => handleOpenForm()}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>استلام دفعة</span>
        </button>
      </div>

      {/* Search & Month Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث باسم التاجر، رقم السند أو طريقة الدفع..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-teal-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-xl text-xs">
          <button
            onClick={() => setFilterMonthMode('current')}
            className={`py-1.5 rounded-lg font-bold transition-all ${
              filterMonthMode === 'current' 
                ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-2xs' 
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            شهر {formatMonthName(selectedMonth)}
          </button>
          <button
            onClick={() => setFilterMonthMode('all')}
            className={`py-1.5 rounded-lg font-bold transition-all ${
              filterMonthMode === 'all' 
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs' 
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            كل الشهور ({payments.length})
          </button>
        </div>
      </div>

      {/* Payments List */}
      <div className="space-y-2.5">
        {filteredPayments.map((p) => (
          <div
            key={p.id}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-3.5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  p.isDiscount
                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                    : 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300'
                }`}>
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectMerchant) onSelectMerchant(p.merchantId);
                      }}
                      className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm text-wrap break-words whitespace-normal hover:text-teal-600 dark:hover:text-teal-400 hover:underline cursor-pointer text-right block"
                      title="فتح صفحة التاجر"
                    >
                      {p.merchantName}
                    </button>
                    {p.isDiscount && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 font-bold">
                        خصم مسموح به
                      </span>
                    )}
                  </div>
                  <div className="flex items-center flex-wrap gap-1.5 text-[11px] text-slate-400 dark:text-slate-400 mt-0.5">
                    <span className="flex items-center gap-0.5">
                      <Calendar className="w-3 h-3" />
                      {formatDateArabic(p.date)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      {getTimeAgoArabic(p.createdAt || p.date)}
                    </span>
                    <span>•</span>
                    <span className="text-teal-700 dark:text-teal-400 font-bold">{p.paymentMethod}</span>
                  </div>
                  {p.notes && <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 text-wrap break-words whitespace-normal">{p.notes}</p>}
                </div>
              </div>

              <div className="text-left shrink-0 pl-1 font-mono-num">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  {p.isDiscount ? 'خصم مسموح به' : 'المبلغ المستلم'}
                </div>
                <div className={`text-base font-black ${
                  p.isDiscount
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {p.isDiscount ? '-' : '+'}{formatCurrency(p.amount, currency)}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono-num">
                #{p.receiptNumber}
              </span>

              <div className="flex items-center gap-1">
                {onPrintPayment && (
                  <button
                    onClick={() => onPrintPayment(p)}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <Printer className="w-3 h-3" />
                    <span>سند</span>
                  </button>
                )}

                <button
                  onClick={() => handleOpenForm(p)}
                  title="تعديل السند"
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setPaymentToDelete(p)}
                  title="حذف سند الدفعة"
                  className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 dark:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredPayments.length === 0 && (
          <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
            <HandCoins className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">لا توجد دفعات محصلة مسجلة</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">سجل استلام دفعات التجار لتسديد ديونهم وزيادة إيراداتك.</p>
          </div>
        )}
      </div>

      {/* Receive Payment Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 mb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <HandCoins className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <span>{editingPayment ? 'تعديل سند استلام دفعة' : 'استلام دفعة نقدية جديدة'}</span>
              </h3>
              <button onClick={handleCloseForm} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-2 mb-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs sm:text-sm">
              {/* Merchant selector with Instant 1-Letter Search */}
              <div>
                <SearchableSelect
                  label="التاجر المستلم منه الدفعة"
                  required
                  options={merchantSelectOptions}
                  selectedOptionFallback={selectedMerchantFallback}
                  value={merchantId}
                  onChange={setMerchantId}
                  placeholder="ابحث عن تاجر بالاسم أو الهاتف من أول حرف..."
                  searchPlaceholder="اكتب أول حرف للبحث الفوري عن التاجر..."
                  accentColor="teal"
                  emptyMessage={
                    !showAllMerchants && sortedDebtorMerchants.length === 0
                      ? 'لا يوجد تجار عليهم ديون حالياً'
                      : 'لا توجد نتائج مطابقة'
                  }
                  emptyAction={
                    !showAllMerchants ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAllMerchants(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/70 text-[11px] font-bold hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer"
                      >
                        عرض جميع التجار ({merchants.length})
                      </button>
                    ) : undefined
                  }
                  dropdownHeader={
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAllMerchants((prev) => !prev);
                        }}
                        className={`w-full py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-colors text-center cursor-pointer border ${
                          showAllMerchants
                            ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/40 hover:bg-teal-500/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
                        }`}
                      >
                        {showAllMerchants
                          ? `يتم عرض الكل (${merchants.length}) • إظهار المدينين فقط`
                          : `المدينون فقط (${sortedDebtorMerchants.length}) • عرض الكل (للعربون)`}
                      </button>
                    </div>
                  }
                />

                {merchantId && selectedMerchantDebt > 0 && (
                  <div className="mt-1.5 p-2 bg-rose-50/70 dark:bg-rose-950/40 rounded-xl border border-rose-100 dark:border-rose-900/60 flex items-center justify-between text-xs">
                    <span className="text-rose-800 dark:text-rose-300 font-bold">الدين المستحق على التاجر:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num font-black text-rose-600 dark:text-rose-400">
                        {formatCurrency(selectedMerchantDebt, currency)}
                      </span>
                      <button
                        type="button"
                        onClick={handleFillFullDebt}
                        className="text-[11px] bg-teal-600 hover:bg-teal-700 text-white px-2 py-0.5 rounded-lg font-bold"
                      >
                        سداد كامل الدين
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 mb-1.5">
                  <Banknote className="w-4 h-4 shrink-0" />
                  <span>المبلغ المستلم</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-14 pr-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 text-emerald-700 dark:text-emerald-300 placeholder:text-emerald-600/45 dark:placeholder:text-emerald-300/40 font-mono-num text-right font-bold text-lg transition-all"
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-xs font-bold text-emerald-600/80 dark:text-emerald-400/80">
                    {currency}
                  </span>
                </div>
              </div>

              {/* Allowed Discount */}
              <div>
                <label className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5 mb-1.5">
                  <Percent className="w-4 h-4 shrink-0" />
                  <span>خصم مسموح به للتاجر (اختياري)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full pl-14 pr-4 py-2.5 rounded-xl bg-amber-500/10 border border-dashed border-amber-500/50 focus:outline-none focus:border-solid focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 text-amber-700 dark:text-amber-300 placeholder:text-amber-600/45 dark:placeholder:text-amber-300/40 font-mono-num text-right font-bold text-lg transition-all"
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-xs font-bold text-amber-600/80 dark:text-amber-400/80">
                    {currency}
                  </span>
                </div>
              </div>

              {/* Live Accounting Summary when Discount > 0 */}
              {discountAmount > 0 && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400 font-semibold">المبلغ النقدي للخزينة:</span>
                    <span className="font-mono-num font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(cashAmount, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-700 dark:text-amber-400 font-semibold">قيمة الخصم المسموح به:</span>
                    <span className="font-mono-num font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(discountAmount, currency)}
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-slate-800 dark:text-slate-200 font-bold">إجمالي المخصوم من حساب التاجر:</span>
                    <span className="font-mono-num font-black text-teal-700 dark:text-teal-400">
                      {formatCurrency(totalDeductedFromMerchant, currency)}
                    </span>
                  </div>
                  {merchantId && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-semibold">حساب التاجر المتبقي بعد العملية:</span>
                      <span className={`font-mono-num font-black ${
                        selectedMerchantDebt - totalDeductedFromMerchant > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {formatCurrency(selectedMerchantDebt - totalDeductedFromMerchant, currency)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Date & Method */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">تاريخ الاستلام *</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 font-mono-num text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">طريقة الدفع</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 text-xs"
                  >
                    <option value="كاش">كاش / نقدي</option>
                    <option value="فودافون كاش / إنستاباي">فودافون كاش / إنستاباي</option>
                    <option value="تحويل بنكي">تحويل بنكي</option>
                    <option value="شيك">شيك بنكي</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظات أو رقم الحوالة</label>
                <input
                  type="text"
                  placeholder="ملاحظات أو تفاصيل الدفعة..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 text-xs"
                />
              </div>

              {/* Exclude from Stats Checkbox */}
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60">
                <input
                  type="checkbox"
                  id="pay-exclude-stats"
                  checked={excludeFromStats}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setExcludeFromStats(checked);
                    if (checked) setIsDirectExpense(false);
                  }}
                  className="mt-0.5 w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                />
                <label htmlFor="pay-exclude-stats" className="text-xs text-amber-900 dark:text-amber-200 font-medium cursor-pointer">
                  <span className="font-bold block">تسجيل في كشف حساب التاجر فقط</span>
                  <span className="text-[11px] text-amber-700 dark:text-amber-300">عدم الإضافة لإيرادات / إحصائيات اليوم (خصم من دين التاجر فقط دون زيادة خزينة اليوم).</span>
                </label>
              </div>

              {/* Direct Expense / Withdrawal Transfer Checkbox */}
              <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/60 space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="pay-direct-expense"
                    checked={isDirectExpense}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsDirectExpense(checked);
                      if (checked) setExcludeFromStats(false);
                      if (formError) setFormError(null);
                    }}
                    className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                  />
                  <label htmlFor="pay-direct-expense" className="text-xs text-rose-900 dark:text-rose-200 font-medium cursor-pointer">
                    <span className="font-bold block">تحويل الدفعة كمسحوبات مباشرة (دفع لمورد / مصروفات)</span>
                    <span className="text-[11px] text-rose-700 dark:text-rose-300">
                      تسجيل الدفعة في حساب التاجر وخصم نفس المبلغ تلقائياً كمسحوبات حتى لا تزيد عهدة الخزينة.
                    </span>
                  </label>
                </div>

                {isDirectExpense && (
                  <div>
                    <input
                      type="text"
                      required={isDirectExpense && cashAmount > 0}
                      placeholder="اكتب سبب السحب أو اسم المورد (مثلاً: سداد حساب خامات)..."
                      value={expenseReason}
                      onChange={(e) => {
                        setExpenseReason(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800/70 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 pb-8 sm:pb-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 mb-2 sm:mb-0">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="py-3 sm:py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs active:scale-95 transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={cashAmount <= 0 && discountAmount <= 0}
                  className="py-3 sm:py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md active:scale-95 transition-all"
                >
                  {editingPayment ? 'حفظ التعديل' : 'تأكيد استلام الدفعة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(paymentToDelete)}
        title={`حذف سند القبض #${paymentToDelete?.receiptNumber || ''}`}
        message="هل أنت متأكد من حذف هذا السند؟ سيتم إعادة المبلغ المحصل كدين مستحق على التاجر وتعديل رصيده."
        onConfirm={handleConfirmDelete}
        onClose={() => setPaymentToDelete(null)}
      />

    </div>
  );
};
