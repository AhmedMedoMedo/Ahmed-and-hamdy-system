import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { Merchant, Invoice, Payment, MerchantStatementPrintData } from '../types';
import { formatCurrency, formatDateArabic, getTimeAgoArabic, getTodayDateString, getMonthKeyFromDate } from '../utils/formatters';
import { ConfirmModal } from './ConfirmModal';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  MapPin, 
  FileText, 
  HandCoins, 
  Edit3, 
  Trash2, 
  Share2, 
  Printer, 
  X,
  PlusCircle,
  Receipt,
  TrendingUp,
  Clock
} from 'lucide-react';

interface MerchantsViewProps {
  initialSelectedMerchantId?: string | null;
  onClearSelectedMerchant?: () => void;
  onOpenNewInvoiceWithMerchant?: (merchantId: string) => void;
  onOpenNewPaymentWithMerchant?: (merchantId: string) => void;
  onEditInvoice?: (invoice: Invoice) => void;
  onEditPayment?: (payment: Payment) => void;
  onPrintInvoice?: (invoice: Invoice) => void;
  onPrintPayment?: (payment: Payment) => void;
  onPrintMerchantStatement?: (statementData: MerchantStatementPrintData) => void;
}

export const MerchantsView: React.FC<MerchantsViewProps> = ({
  initialSelectedMerchantId,
  onClearSelectedMerchant,
  onOpenNewInvoiceWithMerchant,
  onOpenNewPaymentWithMerchant,
  onEditInvoice,
  onEditPayment,
  onPrintInvoice,
  onPrintPayment,
  onPrintMerchantStatement
}) => {
  const { 
    merchants, 
    merchantBalances, 
    invoices, 
    payments, 
    currency, 
    saveMerchant, 
    saveInvoice,
    removeMerchant,
    removeInvoice,
    removePayment,
    showToast
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'debt' | 'settled'>('all');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', notes: '' });

  // Increase Debt Modal states
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [selectedMerchantForDebt, setSelectedMerchantForDebt] = useState<Merchant | null>(null);
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNotes, setDebtNotes] = useState('');
  const [debtExcludeFromStats, setDebtExcludeFromStats] = useState(false);
  const [debtError, setDebtError] = useState<string | null>(null);
  const [isSubmittingDebt, setIsSubmittingDebt] = useState(false);

  // Detail / Statement state
  const [activeMerchantId, setActiveMerchantId] = useState<string | null>(initialSelectedMerchantId || null);
  const [statementTab, setStatementTab] = useState<'all' | 'invoices' | 'payments'>('all');

  // Deletion Modal state (replaces window.confirm completely)
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    type: 'merchant' | 'invoice' | 'payment';
    id: string;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'merchant',
    id: '',
    title: '',
    message: '',
  });

  // Filtered merchants
  const filteredMerchants = useMemo(() => {
    return merchants.filter(m => {
      const matchSearch = 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.phone.includes(searchTerm) ||
        (m.address && m.address.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const balance = merchantBalances[m.id]?.currentDebt || 0;
      if (filterType === 'debt') return matchSearch && balance > 0;
      if (filterType === 'settled') return matchSearch && balance <= 0;
      return matchSearch;
    });
  }, [merchants, searchTerm, filterType, merchantBalances]);

  // Handle open add/edit modal
  const handleOpenForm = (merchant?: Merchant) => {
    if (merchant) {
      setEditingMerchant(merchant);
      setFormData({
        name: merchant.name,
        phone: merchant.phone || '',
        address: merchant.address || '',
        notes: merchant.notes || '',
      });
    } else {
      setEditingMerchant(null);
      setFormData({ name: '', phone: '', address: '', notes: '' });
    }
    setIsFormOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      await saveMerchant({
        ...(editingMerchant ? { id: editingMerchant.id } : {}),
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        notes: formData.notes,
      });

      showToast(editingMerchant ? 'تم تعديل بيانات التاجر' : 'تمت إضافة التاجر بنجاح');
      setIsFormOpen(false);
      setEditingMerchant(null);
    } catch (err: any) {
      console.warn("Merchant saved locally in offline mode:", err);
      showToast('تم حفظ العملية محلياً (أوفلاين) وستتم المزامنة عند عودة الإنترنت');
      setIsFormOpen(false);
      setEditingMerchant(null);
    }
  };

  // Safe Deletion confirmation
  const triggerDeleteMerchant = (merchant: Merchant) => {
    setDeleteDialog({
      isOpen: true,
      type: 'merchant',
      id: merchant.id,
      title: `حذف التاجر "${merchant.name}"`,
      message: 'هل أنت متأكد من حذف هذا التاجر؟ لن تفقد الفواتير المحفوظة ولكن سيتم إزالته من قائمة التجار.',
    });
  };

  const triggerDeleteStatementItem = (tx: { id: string; type: 'invoice' | 'payment'; title: string }) => {
    setDeleteDialog({
      isOpen: true,
      type: tx.type,
      id: tx.id,
      title: `حذف ${tx.title}`,
      message: tx.type === 'invoice' 
        ? 'سيتم حذف الفاتورة وخصم قيمتها من إجمالي دين التاجر وإعادة احتساب الرصيد.' 
        : 'سيتم حذف سند القبض وإعادة المبلغ كدين مستحق على التاجر.',
    });
  };

  const handleConfirmDelete = async () => {
    if (deleteDialog.type === 'merchant') {
      await removeMerchant(deleteDialog.id);
      if (activeMerchantId === deleteDialog.id) {
        setActiveMerchantId(null);
        if (onClearSelectedMerchant) onClearSelectedMerchant();
      }
      showToast('تم حذف التاجر بنجاح');
    } else if (deleteDialog.type === 'invoice') {
      await removeInvoice(deleteDialog.id);
      showToast('تم حذف الفاتورة وإعادة ضبط الحساب');
    } else if (deleteDialog.type === 'payment') {
      await removePayment(deleteDialog.id);
      showToast('تم حذف سند الدفعة وتحديث الرصيد');
    }
    setDeleteDialog(prev => ({ ...prev, isOpen: false }));
  };

  const handleOpenDebtModal = (merchant: Merchant) => {
    setSelectedMerchantForDebt(merchant);
    setDebtAmount('');
    setDebtNotes('');
    setDebtError(null);
    setIsDebtModalOpen(true);
  };

  const handleSubmitDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchantForDebt) return;

    const amount = parseFloat(debtAmount);
    if (isNaN(amount) || amount <= 0) {
      setDebtError('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }

    setIsSubmittingDebt(true);
    setDebtError(null);

    try {
      const today = getTodayDateString();
      const monthKey = getMonthKeyFromDate(today);
      const invoiceNumber = `دين-${Date.now().toString().slice(-4)}`;

      await saveInvoice({
        invoiceNumber,
        merchantId: selectedMerchantForDebt.id,
        merchantName: selectedMerchantForDebt.name,
        date: today,
        monthKey,
        items: [
          {
            id: `item_${Date.now()}`,
            productName: 'تسجيل دين مباشر',
            quantity: 1,
            unitPrice: amount,
            total: amount,
          }
        ],
        subtotal: amount,
        discountType: 'amount',
        discountValue: 0,
        discount: 0,
        total: amount,
        paidAmount: 0,
        remainingAmount: amount,
        notes: debtNotes.trim() || 'تسجيل دين مباشر',
        excludeFromStats: debtExcludeFromStats,
      });

      showToast(`تمت زيادة دين بمبلغ ${formatCurrency(amount, currency)} على ${selectedMerchantForDebt.name}`);
    } catch (err: any) {
      console.warn("Debt increase saved locally in offline mode:", err);
      showToast('تم حفظ العملية محلياً (أوفلاين) وستتم المزامنة عند عودة الإنترنت');
    } finally {
      setIsDebtModalOpen(false);
      setSelectedMerchantForDebt(null);
      setDebtAmount('');
      setDebtNotes('');
      setDebtExcludeFromStats(false);
      setIsSubmittingDebt(false);
    }
  };

  // Active Merchant Statement Ledger calculations
  const activeMerchant = useMemo(() => {
    return merchants.find(m => m.id === activeMerchantId) || null;
  }, [merchants, activeMerchantId]);

  const activeMerchantInvoices = useMemo(() => {
    if (!activeMerchantId) return [];
    return invoices
      .filter(inv => inv.merchantId === activeMerchantId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [activeMerchantId, invoices]);

  const activeMerchantPayments = useMemo(() => {
    if (!activeMerchantId) return [];
    return payments
      .filter(pay => pay.merchantId === activeMerchantId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [activeMerchantId, payments]);

  const activeMerchantTransactions = useMemo(() => {
    if (!activeMerchantId) return [];

    const merchantInvs = invoices
      .filter(inv => inv.merchantId === activeMerchantId)
      .map(inv => ({
        id: inv.id,
        type: 'invoice' as const,
        date: inv.date,
        title: `فاتورة #${inv.invoiceNumber}`,
        debit: inv.total,
        credit: 0,
        notes: inv.notes || '',
        createdAt: inv.createdAt,
        rawInvoice: inv,
        excludeFromStats: Boolean(inv.excludeFromStats),
      }));

    const merchantPays = payments
      .filter(pay => pay.merchantId === activeMerchantId)
      .map(pay => ({
        id: pay.id,
        type: 'payment' as const,
        date: pay.date,
        title: `دفعة (${pay.paymentMethod})`,
        debit: 0,
        credit: pay.amount,
        notes: pay.notes || '',
        createdAt: pay.createdAt,
        rawPayment: pay,
        excludeFromStats: Boolean(pay.excludeFromStats),
      }));

    const combined = [...merchantInvs, ...merchantPays].sort((a, b) => {
      const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    let runningBalance = 0;
    const withRunningBalance = combined.map(tx => {
      runningBalance += (tx.debit - tx.credit);
      return {
        ...tx,
        balanceAfter: runningBalance
      };
    });

    return withRunningBalance.sort((a, b) => {
      const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [activeMerchantId, invoices, payments]);

  // Print full statement handler
  const handlePrintFullStatement = () => {
    if (!activeMerchant || !onPrintMerchantStatement) return;
    const b = merchantBalances[activeMerchant.id] || { totalInvoicedAllTime: 0, totalPaidAllTime: 0, currentDebt: 0 };
    onPrintMerchantStatement({
      merchant: activeMerchant,
      balances: b,
      invoices: activeMerchantInvoices,
      payments: activeMerchantPayments,
      transactions: activeMerchantTransactions,
      generatedAt: new Date().toISOString(),
    });
  };

  // Share statement via WhatsApp
  const handleShareWhatsApp = () => {
    if (!activeMerchant) return;
    const b = merchantBalances[activeMerchant.id] || { totalInvoicedAllTime: 0, totalPaidAllTime: 0, currentDebt: 0 };
    const text = `*كشف حساب التاجر: ${activeMerchant.name}*
------------------------------
إجمالي المسحوبات: ${formatCurrency(b.totalInvoicedAllTime, currency)}
إجمالي المسدد: ${formatCurrency(b.totalPaidAllTime, currency)}
*المتبقي دين: ${formatCurrency(b.currentDebt, currency)}*
------------------------------
تاريخ الاستخراج: ${formatDateArabic(getTodayDateString())}`;

    const encoded = encodeURIComponent(text);
    const phone = activeMerchant.phone.replace(/[^0-9]/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    
    // Copy to clipboard as well for convenience
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-3.5 pb-24">
      
      {/* Top Mobile Bar */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>سجل التجار والعملاء</span>
            <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded-full font-mono-num font-bold">
              {merchants.length}
            </span>
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">متابعة حسابات التجار والديون وكشوف الحساب</p>
        </div>

        <button
          onClick={() => handleOpenForm()}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة تاجر</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث باسم التاجر أو رقم الهاتف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status filter tabs */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-xl text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`py-1.5 rounded-lg font-bold transition-all ${
              filterType === 'all' 
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            الكل ({merchants.length})
          </button>
          <button
            onClick={() => setFilterType('debt')}
            className={`py-1.5 rounded-lg font-bold transition-all ${
              filterType === 'debt' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            عليهم ديون
          </button>
          <button
            onClick={() => setFilterType('settled')}
            className={`py-1.5 rounded-lg font-bold transition-all ${
              filterType === 'settled' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            خالص السداد
          </button>
        </div>
      </div>

      {/* Merchants List (Mobile Cards) */}
      <div className="space-y-2.5">
        {filteredMerchants.map((merchant) => {
          const balance = merchantBalances[merchant.id] || {
            totalInvoicedAllTime: 0,
            totalPaidAllTime: 0,
            currentDebt: 0,
          };
          const hasDebt = balance.currentDebt > 0;

          return (
            <div
              key={merchant.id}
              className={`bg-white dark:bg-slate-800 rounded-2xl border p-3.5 shadow-2xs transition-all ${
                hasDebt 
                  ? 'border-rose-100 dark:border-rose-900/50 hover:border-rose-200 dark:hover:border-rose-800' 
                  : 'border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">{merchant.name}</h3>
                  {merchant.phone && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5" dir="ltr">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{merchant.phone}</span>
                    </div>
                  )}
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                    hasDebt 
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60' 
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                  }`}
                >
                  {hasDebt ? 'عليه دين' : 'خالص'}
                </span>
              </div>

              {/* Financial Summary */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-2.5 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs my-2">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">المسحوبات</span>
                  <span className="font-bold font-mono-num text-slate-800 dark:text-slate-200">
                    {formatCurrency(balance.totalInvoicedAllTime, currency)}
                  </span>
                </div>
                <div className="border-r border-slate-200 dark:border-slate-700 pr-2.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">المسدد</span>
                  <span className="font-bold font-mono-num text-teal-700 dark:text-teal-400">
                    {formatCurrency(balance.totalPaidAllTime, currency)}
                  </span>
                </div>
                <div className="border-r border-slate-200 dark:border-slate-700 pr-2.5">
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block">المتبقي دين</span>
                  <span className={`font-black font-mono-num ${hasDebt ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatCurrency(balance.currentDebt, currency)}
                  </span>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-1.5 pt-3 mt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    setActiveMerchantId(merchant.id);
                    setStatementTab('all');
                  }}
                  className="flex-1 min-w-[70px] flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-[10px] sm:text-xs font-bold whitespace-nowrap shadow-2xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>كشف حساب</span>
                </button>

                <button
                  onClick={() => onOpenNewInvoiceWithMerchant && onOpenNewInvoiceWithMerchant(merchant.id)}
                  title="إصدار فاتورة بيع للتاجر"
                  className="flex-1 min-w-[70px] flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-[10px] sm:text-xs font-bold whitespace-nowrap shadow-2xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/60 dark:border-emerald-800/50 transition-colors"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>فاتورة</span>
                </button>

                <button
                  onClick={() => onOpenNewPaymentWithMerchant && onOpenNewPaymentWithMerchant(merchant.id)}
                  title="استلام دفعة نقدية"
                  className="flex-1 min-w-[70px] flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-[10px] sm:text-xs font-bold whitespace-nowrap shadow-2xs bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200/60 dark:border-teal-800/50 transition-colors"
                >
                  <HandCoins className="w-3.5 h-3.5" />
                  <span>دفعة</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenDebtModal(merchant)}
                  title="زيادة دين مباشر على التاجر"
                  className="flex-1 min-w-[70px] flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-[10px] sm:text-xs font-bold whitespace-nowrap shadow-2xs bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/60 dark:border-rose-800/50 active:scale-95 transition-all"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>زيادة دين</span>
                </button>

                <button
                  onClick={() => handleOpenForm(merchant)}
                  title="تعديل بيانات التاجر"
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => triggerDeleteMerchant(merchant)}
                  title="حذف التاجر"
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-500 dark:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredMerchants.length === 0 && (
          <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
            <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">لا يوجد تجار مطابقين</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">اضغط على زر "إضافة تاجر" للبدء في التسجيل.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Merchant Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>{editingMerchant ? 'تعديل بيانات التاجر' : 'إضافة تاجر جديد'}</span>
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اسم التاجر أو المحل *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: ألعاب النور"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف / الواتساب</label>
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="01xxxxxxxxx"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-right text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">العنوان أو المنطقة</label>
                <input
                  type="text"
                  placeholder="المدينة أو المنطقة..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظات (شروط، مواعيد دفع...)</label>
                <textarea
                  rows={2}
                  placeholder="أي ملاحظات تخص التاجر..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              <div className="pt-3 pb-8 sm:pb-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 mb-2 sm:mb-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="py-3 sm:py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs active:scale-95 transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="py-3 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
                >
                  {editingMerchant ? 'حفظ التعديلات' : 'إضافة التاجر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Merchant Statement Modal */}
      {activeMerchant && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-xl w-full p-4 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white max-h-[92vh] flex flex-col justify-between overflow-hidden">
            
            {/* Header */}
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 mb-2">
                <div className="min-w-0 pr-1">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">كشف حساب: {activeMerchant.name}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">حركة الفواتير والدفعات وسجل الحساب التراكمي</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* User Requested: Print Full Statement button */}
                  <button
                    onClick={handlePrintFullStatement}
                    className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
                    title="طباعة كشف الحساب بالكامل"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">طباعة الكشف</span>
                  </button>

                  <button
                    onClick={handleShareWhatsApp}
                    className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                    title="مشاركة عبر واتساب"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>واتساب</span>
                  </button>

                  <button
                    onClick={() => setActiveMerchantId(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Financial Balance Strip */}
              <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 mb-2 text-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">المسحوبات ({activeMerchantInvoices.length})</span>
                  <span className="font-bold font-mono-num text-slate-800 dark:text-slate-200">
                    {formatCurrency(merchantBalances[activeMerchant.id]?.totalInvoicedAllTime || 0, currency)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">المسدد ({activeMerchantPayments.length})</span>
                  <span className="font-bold font-mono-num text-teal-700 dark:text-teal-400">
                    {formatCurrency(merchantBalances[activeMerchant.id]?.totalPaidAllTime || 0, currency)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block">صافي الدين</span>
                  <span className="font-black font-mono-num text-rose-600 dark:text-rose-400">
                    {formatCurrency(merchantBalances[activeMerchant.id]?.currentDebt || 0, currency)}
                  </span>
                </div>
              </div>

              {/* Sub-Tabs: Independent Sales Operations vs Financial Operations vs All */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs mb-2">
                <button
                  onClick={() => setStatementTab('all')}
                  className={`py-1.5 rounded-lg font-bold text-center transition-all ${
                    statementTab === 'all'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  الكل ({activeMerchantTransactions.length})
                </button>
                <button
                  onClick={() => setStatementTab('invoices')}
                  className={`py-1.5 rounded-lg font-bold text-center transition-all ${
                    statementTab === 'invoices'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                  }`}
                >
                  عمليات البيع ({activeMerchantInvoices.length})
                </button>
                <button
                  onClick={() => setStatementTab('payments')}
                  className={`py-1.5 rounded-lg font-bold text-center transition-all ${
                    statementTab === 'payments'
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40'
                  }`}
                >
                  العمليات المالية ({activeMerchantPayments.length})
                </button>
              </div>
            </div>

            {/* Scrollable Tab Content */}
            <div className="flex-1 overflow-y-auto space-y-2 py-1 pr-1">
              
              {/* TAB 1: ALL TRANSACTIONS WITH RUNNING BALANCE */}
              {statementTab === 'all' && (
                activeMerchantTransactions.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400 dark:text-slate-500">
                    لا توجد حركات مسجلة لهذا التاجر بعد
                  </div>
                ) : (
                  activeMerchantTransactions.map((tx, idx) => {
                    const isInv = tx.type === 'invoice';
                    return (
                      <div
                        key={tx.id + idx}
                        className={`p-3 rounded-2xl border text-xs flex flex-col gap-2 transition-all ${
                          isInv 
                            ? 'bg-blue-50/40 dark:bg-blue-950/30 border-blue-200/80 dark:border-blue-800/60' 
                            : 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60'
                        }`}
                      >
                        {/* الصف الأول: شارة نوع العملية والبيان يميناً، والمبلغ بخط كبير وعريض يساراً */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              isInv 
                                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300' 
                                : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                            }`}>
                              {isInv ? 'فاتورة' : 'سند قبض'}
                            </span>
                            <span className={`font-bold truncate ${isInv ? 'text-blue-900 dark:text-blue-300' : 'text-emerald-900 dark:text-emerald-300'}`}>
                              {tx.title}
                            </span>
                            {Boolean(tx.excludeFromStats) && (
                              <span className="text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded font-bold shrink-0">
                                كشف فقط
                              </span>
                            )}
                          </div>

                          <div className={`font-mono-num font-black text-sm sm:text-base shrink-0 ${
                            isInv ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {isInv ? `+${formatCurrency(tx.debit, currency)}` : `-${formatCurrency(tx.credit, currency)}`}
                          </div>
                        </div>

                        {/* الصف الثاني: التاريخ والوقت المنقضي بخط صغير ولون رمادي */}
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          <span>{formatDateArabic(tx.date)}</span>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                            {getTimeAgoArabic(tx.createdAt || tx.date)}
                          </span>
                        </div>

                        {/* الصف الثالث: الملاحظات والبيان إن وُجد */}
                        {tx.notes && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800/80">
                            {tx.notes}
                          </div>
                        )}

                        {/* الصف الرابع (مفصول بخط علوي خفيف): الرصيد التراكمي يميناً، وأزرار الإجراءات يساراً */}
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-2">
                          <div className="text-[11px] flex items-center gap-1">
                            <span className="text-slate-400 dark:text-slate-500 font-medium">الرصيد بعد العملية:</span>
                            <span className="font-bold font-mono-num text-slate-800 dark:text-slate-200">
                              {formatCurrency(tx.balanceAfter, currency)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isInv && onEditInvoice && (
                              <button
                                onClick={() => {
                                  const rawInv = tx.rawInvoice || invoices.find(i => i.id === tx.id);
                                  if (rawInv) onEditInvoice(rawInv);
                                }}
                                title="تعديل الفاتورة"
                                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-all"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!isInv && onEditPayment && (
                              <button
                                onClick={() => {
                                  const rawPay = tx.rawPayment || payments.find(p => p.id === tx.id);
                                  if (rawPay) onEditPayment(rawPay);
                                }}
                                title="تعديل سند القبض"
                                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-all"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => {
                                if (isInv && tx.rawInvoice && onPrintInvoice) {
                                  onPrintInvoice(tx.rawInvoice);
                                } else if (!isInv && tx.rawPayment && onPrintPayment) {
                                  onPrintPayment(tx.rawPayment);
                                }
                              }}
                              title={isInv ? 'طباعة هذه الفاتورة' : 'طباعة هذا السند'}
                              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                            </button>

                            <button
                              onClick={() => triggerDeleteStatementItem(tx)}
                              title="حذف هذه المعاملة وتحديث الرصيد"
                              className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              )}

              {/* TAB 2: SALES INVOICES ONLY (INDEPENDENT DISPLAY) */}
              {statementTab === 'invoices' && (
                activeMerchantInvoices.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400 dark:text-slate-500">
                    لا توجد فواتير بيع مسجلة لهذا التاجر
                  </div>
                ) : (
                  activeMerchantInvoices.map((inv) => {
                    const isPaidFully = inv.remainingAmount <= 0;
                    return (
                      <div
                        key={inv.id}
                        className="p-3 rounded-2xl border border-blue-200/80 dark:border-blue-800/60 bg-blue-50/30 dark:bg-blue-950/20 text-xs space-y-2 transition-all hover:border-blue-300 dark:hover:border-blue-700"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-sm text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                              <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span>فاتورة بيع #{inv.invoiceNumber}</span>
                            </div>
                            <div className="flex items-center flex-wrap gap-1 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              <span>تاريخ الحركة: {formatDateArabic(inv.date)}</span>
                              <span>•</span>
                              <span className="flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                {getTimeAgoArabic(inv.createdAt || inv.date)}
                              </span>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isPaidFully 
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' 
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                          }`}>
                            {isPaidFully ? 'مسددة بالكامل' : `متبقي دين ${formatCurrency(inv.remainingAmount, currency)}`}
                          </span>
                        </div>

                        {/* Sold items snippet */}
                        {inv.items && inv.items.length > 0 && (
                          <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl p-2 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                            <span className="font-bold text-slate-500 dark:text-slate-400 text-[10px] block mb-0.5">الأصناف ({inv.items.length}):</span>
                            <div className="truncate">
                              {inv.items.map(it => `${it.productName} (${it.quantity})`).join(' • ')}
                            </div>
                          </div>
                        )}

                        {/* Financial summary row & Print button */}
                        <div className="flex items-center justify-between pt-1 border-t border-blue-100 dark:border-blue-900/40">
                          <div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">قيمة الفاتورة</span>
                            <span className="font-black text-sm font-mono-num text-blue-900 dark:text-blue-300">
                              {formatCurrency(inv.total, currency)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {onEditInvoice && (
                              <button
                                onClick={() => onEditInvoice(inv)}
                                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-all"
                                title="تعديل الفاتورة"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => onPrintInvoice && onPrintInvoice(inv)}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>طباعة الفاتورة</span>
                            </button>

                            <button
                              onClick={() => triggerDeleteStatementItem({ id: inv.id, type: 'invoice', title: `فاتورة #${inv.invoiceNumber}` })}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg"
                              title="حذف الفاتورة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              )}

              {/* TAB 3: FINANCIAL OPERATIONS ONLY (INDEPENDENT DISPLAY) */}
              {statementTab === 'payments' && (
                activeMerchantPayments.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400 dark:text-slate-500">
                    لا توجد سندات دفعات مسجلة لهذا التاجر
                  </div>
                ) : (
                  activeMerchantPayments.map((pay) => (
                    <div
                      key={pay.id}
                      className="p-3 rounded-2xl border border-teal-200/80 dark:border-teal-800/60 bg-teal-50/30 dark:bg-teal-950/20 text-xs space-y-2 transition-all hover:border-teal-300 dark:hover:border-teal-700"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm text-teal-900 dark:text-teal-300 flex items-center gap-1.5">
                            <HandCoins className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                            <span>سند قبض #{pay.receiptNumber || '0742'}</span>
                          </div>
                            <div className="flex items-center flex-wrap gap-1 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              <span>تاريخ التحصيل: {formatDateArabic(pay.date)}</span>
                              <span>•</span>
                              <span className="flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                {getTimeAgoArabic(pay.createdAt || pay.date)}
                              </span>
                            </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                          {pay.paymentMethod}
                        </span>
                      </div>

                      {pay.notes && (
                        <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl p-2 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                          <span className="font-bold text-slate-500 dark:text-slate-400 text-[10px] block mb-0.5">ملاحظات التحصيل:</span>
                          <div>{pay.notes}</div>
                        </div>
                      )}

                      {/* Financial summary row & Print button */}
                      <div className="flex items-center justify-between pt-1 border-t border-teal-100 dark:border-teal-900/40">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">المبلغ المقبوض</span>
                          <span className="font-black text-sm font-mono-num text-teal-700 dark:text-teal-300">
                            {formatCurrency(pay.amount, currency)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {onEditPayment && (
                            <button
                              onClick={() => onEditPayment(pay)}
                              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-all"
                              title="تعديل سند القبض"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onPrintPayment && onPrintPayment(pay)}
                            className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>طباعة السند</span>
                          </button>

                          <button
                            onClick={() => triggerDeleteStatementItem({ id: pay.id, type: 'payment', title: `سند قبض #${pay.receiptNumber || '0742'}` })}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg"
                            title="حذف سند التحصيل"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )
              )}

            </div>

            {/* Footer - Lifted above mobile navigation bar */}
            <div className="pt-3 pb-8 sm:pb-2 border-t border-slate-100 dark:border-slate-800 space-y-2 mb-2 sm:mb-0">
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    if (onOpenNewInvoiceWithMerchant) onOpenNewInvoiceWithMerchant(activeMerchant.id);
                    setActiveMerchantId(null);
                  }}
                  className="flex-1 py-2.5 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all"
                >
                  + فاتورة بيع جديدة
                </button>
                <button
                  onClick={() => {
                    if (onOpenNewPaymentWithMerchant) onOpenNewPaymentWithMerchant(activeMerchant.id);
                    setActiveMerchantId(null);
                  }}
                  className="flex-1 py-2.5 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all"
                >
                  + استلام دفعة كاش
                </button>
                <button
                  onClick={() => handleOpenDebtModal(activeMerchant)}
                  title="زيادة دين على التاجر"
                  className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-1 shrink-0"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>+ دين</span>
                </button>
              </div>

              {/* Full Statement Print Quick Button */}
              <button
                onClick={handlePrintFullStatement}
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700"
              >
                <Printer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>طباعة تقرير كشف الحساب بالكامل (A4 / صورة)</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Increase Debt Modal */}
      {isDebtModalOpen && selectedMerchantForDebt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3 shrink-0">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <span className="block leading-tight">زيادة دين على التاجر</span>
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{selectedMerchantForDebt.name}</span>
                </div>
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setIsDebtModalOpen(false);
                  setSelectedMerchantForDebt(null);
                }} 
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitDebt} className="flex-1 overflow-y-auto space-y-3.5 text-xs sm:text-sm pr-0.5">
              {/* Merchant Balance Info Banner */}
              <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-rose-900 dark:text-rose-200 font-medium">الرصيد الحالي المستحق:</span>
                  <span className="font-black text-sm text-rose-700 dark:text-rose-400">
                    {formatCurrency(merchantBalances[selectedMerchantForDebt.id]?.currentDebt || 0, currency)}
                  </span>
                </div>
                <p className="text-[11px] text-rose-600/90 dark:text-rose-300/80 mt-1">
                  المبلغ المدخل سيتم إضافته فوراً إلى إجمالي مديونية التاجر وسيظهر في كشف حسابه.
                </p>
              </div>

              {debtError && (
                <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-200 text-xs font-bold">
                  {debtError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  مبلغ زيادة الدين ({currency}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={debtAmount}
                  onChange={(e) => {
                    setDebtAmount(e.target.value);
                    if (debtError) setDebtError(null);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 text-base font-bold text-left placeholder:text-slate-400"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات أو سبب زيادة الدين (اختياري)
                </label>
                <textarea
                  rows={3}
                  placeholder="مثال: بضاعة قديمة، ترحيل رصيد، تسوية حساب، مصاريف نقل..."
                  value={debtNotes}
                  onChange={(e) => setDebtNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 text-xs placeholder:text-slate-400"
                />
              </div>

              {/* Exclude from Stats Checkbox */}
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60">
                <input
                  type="checkbox"
                  id="debt-exclude-stats"
                  checked={debtExcludeFromStats}
                  onChange={(e) => setDebtExcludeFromStats(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                />
                <label htmlFor="debt-exclude-stats" className="text-xs text-amber-900 dark:text-amber-200 font-medium cursor-pointer">
                  <span className="font-bold block">تسجيل في كشف حساب التاجر فقط</span>
                  <span className="text-[11px] text-amber-700 dark:text-amber-300">عدم الإضافة لإيرادات / إحصائيات مبيعات اليوم (ترحيل رصيد أو تسوية حساب).</span>
                </label>
              </div>

              {/* Action Buttons in footer */}
              <div className="pt-3 pb-8 sm:pb-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 mb-2 sm:mb-0 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsDebtModalOpen(false);
                    setSelectedMerchantForDebt(null);
                  }}
                  className="py-3 sm:py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs active:scale-95 transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDebt}
                  className="py-3 sm:py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>{isSubmittingDebt ? 'جاري الحفظ...' : 'تأكيد زيادة الدين'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteDialog.isOpen}
        title={deleteDialog.title}
        message={deleteDialog.message}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteDialog(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
};
