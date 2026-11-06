import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { Payment, PaymentMethod } from '../types';
import { 
  formatCurrency, 
  formatDateArabic, 
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
  CreditCard,
  Banknote,
  Smartphone,
  ArrowDownLeft,
  AlertCircle
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
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('كاش');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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

  const handleOpenForm = (existing?: Payment, preselectedMerchantId?: string) => {
    setFormError(null);
    if (existing) {
      setEditingPayment(existing);
      setMerchantId(existing.merchantId);
      setAmount(String(existing.amount));
      setPaymentDate(existing.date);
      setPaymentMethod(existing.paymentMethod);
      setReceiptNumber(existing.receiptNumber || '');
      setNotes(existing.notes || '');
    } else {
      setEditingPayment(null);
      const chosenMerchant = preselectedMerchantId || (merchants[0]?.id || '');
      setMerchantId(chosenMerchant);
      setAmount('');
      setPaymentDate(getTodayDateString());
      setPaymentMethod('كاش');
      setReceiptNumber(generateReceiptNumber(payments.length));
      setNotes('');
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingPayment(null);
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
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setFormError('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    const m = merchants.find(item => item.id === merchantId);
    const mName = m ? m.name : 'تاجر غير محدد';
    const monthKey = getMonthKeyFromDate(paymentDate);

    await savePayment({
      ...(editingPayment ? { id: editingPayment.id } : {}),
      merchantId,
      merchantName: mName,
      amount: parsedAmount,
      date: paymentDate,
      monthKey,
      paymentMethod,
      receiptNumber: receiptNumber.trim() || `سند-${Date.now().toString().slice(-4)}`,
      notes: notes.trim(),
    });

    showToast(editingPayment ? 'تم تعديل سند القبض' : 'تم استلام الدفعة وتخفيض دين التاجر');
    handleCloseForm();
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

  const getMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'كاش': return <Banknote className="w-3.5 h-3.5" />;
      case 'فودافون كاش / إنستاباي': return <Smartphone className="w-3.5 h-3.5" />;
      default: return <CreditCard className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-3.5 pb-24">
      
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-1.5">
            <HandCoins className="w-5 h-5 text-teal-600" />
            <span>سندات قبض دفعات التجار</span>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono-num font-bold">
              {filteredPayments.length}
            </span>
          </h2>
          <p className="text-[11px] text-slate-500">
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
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث باسم التاجر، رقم السند أو طريقة الدفع..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 bg-white"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 bg-slate-200/70 p-1 rounded-xl text-xs">
          <button
            onClick={() => setFilterMonthMode('current')}
            className={`py-1.5 rounded-lg font-bold transition-all ${
              filterMonthMode === 'current' ? 'bg-white text-teal-700 shadow-2xs' : 'text-slate-600'
            }`}
          >
            شهر {formatMonthName(selectedMonth)}
          </button>
          <button
            onClick={() => setFilterMonthMode('all')}
            className={`py-1.5 rounded-lg font-bold transition-all ${
              filterMonthMode === 'all' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600'
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
            className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs hover:border-slate-300 transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectMerchant) onSelectMerchant(p.merchantId);
                    }}
                    className="font-bold text-slate-900 text-sm truncate hover:text-teal-600 hover:underline cursor-pointer text-right block"
                    title="فتح صفحة التاجر"
                  >
                    {p.merchantName}
                  </button>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                    <span className="flex items-center gap-0.5">
                      <Calendar className="w-3 h-3" />
                      {formatDateArabic(p.date)}
                    </span>
                    <span>•</span>
                    <span className="text-teal-700 font-bold">{p.paymentMethod}</span>
                  </div>
                  {p.notes && <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{p.notes}</p>}
                </div>
              </div>

              <div className="text-left shrink-0 pl-1 font-mono-num">
                <div className="text-xs text-slate-500 font-semibold">المبلغ المستلم</div>
                <div className="text-base font-black text-teal-700">
                  +{formatCurrency(p.amount, currency)}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400 font-mono-num">
                #{p.receiptNumber}
              </span>

              <div className="flex items-center gap-1">
                {onPrintPayment && (
                  <button
                    onClick={() => onPrintPayment(p)}
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"
                  >
                    <Printer className="w-3 h-3" />
                    <span>سند</span>
                  </button>
                )}

                <button
                  onClick={() => handleOpenForm(p)}
                  title="تعديل السند"
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setPaymentToDelete(p)}
                  title="حذف سند الدفعة"
                  className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"
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
                  options={merchants.map((m) => {
                    const debt = merchantBalances[m.id]?.currentDebt || 0;
                    return {
                      id: m.id,
                      label: m.name,
                      subLabel: m.phone ? `هاتف: ${m.phone}` : undefined,
                      badge: debt > 0 ? `دين: ${formatCurrency(debt, currency)}` : 'خالص',
                      badgeColor: debt > 0 
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400' 
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400',
                    };
                  })}
                  value={merchantId}
                  onChange={setMerchantId}
                  placeholder="ابحث عن تاجر بالاسم أو الهاتف من أول حرف..."
                  searchPlaceholder="اكتب أول حرف للبحث الفوري عن التاجر..."
                  accentColor="teal"
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
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">المبلغ المستلم *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-400 focus:outline-none focus:border-teal-500 font-mono-num text-left font-bold text-base"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500">
                    {currency}
                  </span>
                </div>
              </div>

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

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs"
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
