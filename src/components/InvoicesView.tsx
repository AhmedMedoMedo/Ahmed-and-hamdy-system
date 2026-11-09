import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { Invoice, InvoiceItem, Product } from '../types';
import { 
  formatCurrency, 
  formatDateArabic, 
  getTimeAgoArabic,
  getTodayDateString, 
  generateInvoiceNumber,
  getMonthKeyFromDate,
  formatMonthName 
} from '../utils/formatters';
import { ConfirmModal } from './ConfirmModal';
import { SearchableSelect } from './SearchableSelect';
import { 
  FileText, 
  Search, 
  Plus, 
  Calendar, 
  Percent, 
  Printer, 
  Edit3, 
  Trash2, 
  X, 
  PlusCircle,
  Trash,
  Minus,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';

interface InvoicesViewProps {
  initialOpenCreate?: boolean;
  initialMerchantId?: string | null;
  initialProduct?: Product | null;
  initialEditingInvoice?: Invoice | null;
  onClearInitialCreate?: () => void;
  onPrintInvoice?: (invoice: Invoice) => void;
  onSelectMerchant?: (merchantId: string) => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  initialOpenCreate = false,
  initialMerchantId = null,
  initialProduct = null,
  initialEditingInvoice = null,
  onClearInitialCreate,
  onPrintInvoice,
  onSelectMerchant,
}) => {
  const { 
    invoices, 
    merchants, 
    products, 
    merchantBalances,
    selectedMonth, 
    currency, 
    saveInvoice, 
    removeInvoice,
    saveMerchant,
    showToast 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonthMode, setFilterMonthMode] = useState<'current' | 'all'>('current');
  const [isFormOpen, setIsFormOpen] = useState(initialOpenCreate || !!initialEditingInvoice);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(initialEditingInvoice || null);

  // Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [merchantId, setMerchantId] = useState(initialMerchantId || '');
  const [invoiceDate, setInvoiceDate] = useState(getTodayDateString());
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Quick Inline Merchant Add State
  const [isQuickAddMerchantOpen, setIsQuickAddMerchantOpen] = useState(false);
  const [quickMerchantName, setQuickMerchantName] = useState('');
  const [quickMerchantPhone, setQuickMerchantPhone] = useState('');

  // Delete modal state
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  // When initialOpenCreate or initialEditingInvoice changes from outside
  useEffect(() => {
    if (initialEditingInvoice) {
      handleOpenCreate(initialEditingInvoice);
    } else if (initialOpenCreate) {
      handleOpenCreate(undefined, initialMerchantId || undefined, initialProduct || undefined);
    }
  }, [initialOpenCreate, initialMerchantId, initialProduct, initialEditingInvoice]);

  // Open Create/Edit modal
  const handleOpenCreate = (existing?: Invoice, preselectedMerchantId?: string, preselectedProd?: Product) => {
    setFormError(null);
    if (existing) {
      setEditingInvoice(existing);
      setInvoiceNumber(existing.invoiceNumber);
      setMerchantId(existing.merchantId);
      setInvoiceDate(existing.date);
      setItems(existing.items.map(it => ({ ...it })));
      setDiscountType(existing.discountType || 'amount');
      setDiscountValue(existing.discountValue || 0);
      setPaidAmount(existing.paidAmount || 0);
      setNotes(existing.notes || '');
    } else {
      setEditingInvoice(null);
      setInvoiceNumber(generateInvoiceNumber(invoices.length));
      setMerchantId(preselectedMerchantId || (merchants[0]?.id || ''));
      setInvoiceDate(getTodayDateString());
      setDiscountType('amount');
      setDiscountValue(0);
      setPaidAmount(0);
      setNotes('');

      // If preselected product is passed or available products
      const prodToUse = preselectedProd || products[0];
      if (prodToUse) {
        setItems([{
          id: `item_${Date.now()}`,
          productId: prodToUse.id,
          productName: prodToUse.name,
          quantity: 0,
          unitPrice: prodToUse.price,
          total: 0,
        }]);
      } else {
        setItems([{
          id: `item_${Date.now()}`,
          productName: '',
          quantity: 0,
          unitPrice: 0,
          total: 0,
        }]);
      }
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingInvoice(null);
    setFormError(null);
    if (onClearInitialCreate) onClearInitialCreate();
  };

  // Item helpers
  const handleAddItem = () => {
    const firstProd = products[0];
    const newItem: InvoiceItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      productId: firstProd ? firstProd.id : undefined,
      productName: firstProd ? firstProd.name : '',
      quantity: 0,
      unitPrice: firstProd ? firstProd.price : 0,
      total: 0,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemProductChange = (idx: number, prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;
    const next = [...items];
    const currentQty = next[idx].quantity || 0;
    next[idx] = {
      ...next[idx],
      productId: prod.id,
      productName: prod.name,
      unitPrice: prod.price,
      total: prod.price * currentQty,
    };
    setItems(next);
  };

  const handleItemChange = (idx: number, field: keyof InvoiceItem, value: any) => {
    const next = [...items];
    const current = { ...next[idx], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      const q = field === 'quantity' 
        ? (value === '' ? 0 : Math.max(0, parseFloat(String(value)) || 0)) 
        : (current.quantity || 0);
      const p = field === 'unitPrice' 
        ? (value === '' ? 0 : Math.max(0, parseFloat(String(value)) || 0)) 
        : (current.unitPrice || 0);
      current.quantity = q;
      current.unitPrice = p;
      current.total = q * p;
    }
    next[idx] = current;
    setItems(next);
  };

  const adjustQty = (idx: number, delta: number) => {
    const next = [...items];
    const current = next[idx];
    const newQty = Math.max(0, (current.quantity || 0) + delta);
    current.quantity = newQty;
    current.total = newQty * (current.unitPrice || 0);
    setItems(next);
  };

  // Quick add merchant inline
  const handleQuickAddMerchant = async () => {
    if (!quickMerchantName.trim()) return;
    const newId = await saveMerchant({
      name: quickMerchantName.trim(),
      phone: quickMerchantPhone.trim(),
      address: '',
      notes: '',
    });
    setMerchantId(newId);
    setQuickMerchantName('');
    setQuickMerchantPhone('');
    setIsQuickAddMerchantOpen(false);
    showToast('تمت إضافة واختيار التاجر الجديد');
  };

  // Financial calculations
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.total || 0), 0);
  }, [items]);

  const calculatedDiscount = useMemo(() => {
    if (discountType === 'percentage') {
      return Math.round((subtotal * (discountValue / 100)) * 100) / 100;
    }
    return Math.min(discountValue, subtotal);
  }, [subtotal, discountType, discountValue]);

  const netTotal = useMemo(() => {
    return Math.max(0, subtotal - calculatedDiscount);
  }, [subtotal, calculatedDiscount]);

  const remainingAmount = useMemo(() => {
    return Math.max(0, netTotal - paidAmount);
  }, [netTotal, paidAmount]);

  // Submit invoice
  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!merchantId) {
      setFormError('يرجى اختيار التاجر أولاً');
      return;
    }
    if (items.length === 0 || items.some(it => !it.productName.trim() || it.quantity <= 0)) {
      setFormError('يرجى ملء بيانات المنتجات والكميات بشكل صحيح');
      return;
    }

    const m = merchants.find(item => item.id === merchantId);
    const mName = m ? m.name : 'تاجر غير محدد';
    const monthKey = getMonthKeyFromDate(invoiceDate);

    try {
      await saveInvoice({
        ...(editingInvoice ? { id: editingInvoice.id } : {}),
        invoiceNumber: invoiceNumber.trim() || `فاتورة-${Date.now().toString().slice(-4)}`,
        merchantId,
        merchantName: mName,
        date: invoiceDate,
        monthKey,
        items,
        subtotal,
        discountType,
        discountValue,
        discount: calculatedDiscount,
        total: netTotal,
        paidAmount,
        remainingAmount,
        notes: notes.trim(),
      }, true);

      showToast(editingInvoice ? 'تم تعديل الفاتورة بنجاح' : 'تم اعتماد الفاتورة وتحديث دين التاجر');
      handleCloseForm();
    } catch (err: any) {
      console.warn("Invoice offline catch:", err);
      showToast('تم حفظ العملية محلياً (أوفلاين) وستتم المزامنة عند عودة الإنترنت');
      handleCloseForm();
    }
  };

  // Delete Invoice action
  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return;
    await removeInvoice(invoiceToDelete.id);
    showToast(`تم حذف الفاتورة رقم "${invoiceToDelete.invoiceNumber}" وتعديل الحساب`);
    setInvoiceToDelete(null);
  };

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices
      .filter(inv => {
        if (filterMonthMode === 'current') {
          const m = inv.monthKey || getMonthKeyFromDate(inv.date);
          if (m !== selectedMonth) return false;
        }
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.merchantName.toLowerCase().includes(q) ||
          (inv.notes && inv.notes.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [invoices, selectedMonth, filterMonthMode, searchTerm]);

  return (
    <div className="space-y-3.5 pb-24">
      
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-1.5">
            <FileText className="w-5 h-5 text-emerald-600" />
            <span>فواتير البيع للعملاء</span>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono-num font-bold">
              {filteredInvoices.length}
            </span>
          </h2>
          <p className="text-[11px] text-slate-500">
            {filterMonthMode === 'current'
              ? `فواتير شهر ${formatMonthName(selectedMonth)}`
              : 'جميع الفواتير المسجلة'}
          </p>
        </div>

        <button
          onClick={() => handleOpenCreate()}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إصدار فاتورة</span>
        </button>
      </div>

      {/* Search & Month Filter Toggle */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث برقم الفاتورة أو اسم التاجر..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-white"
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
              filterMonthMode === 'current' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600'
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
            كل الشهور ({invoices.length})
          </button>
        </div>
      </div>

      {/* Invoices List */}
      <div className="space-y-2.5">
        {filteredInvoices.map((inv) => {
          const isFullyPaid = (inv.remainingAmount || 0) <= 0;
          const isUnpaidDebt = (inv.paidAmount || 0) <= 0;
          const isPartiallyPaid = (inv.paidAmount || 0) > 0 && (inv.remainingAmount || 0) > 0;

          // Compute merchant balance before and after this invoice
          const mBal = merchantBalances[inv.merchantId];
          const currentDebt = mBal ? Math.max(0, mBal.currentDebt) : (inv.remainingAmount || 0);
          const prevDebt = Math.max(0, currentDebt - (inv.remainingAmount || 0));
          const newDebt = prevDebt + (inv.remainingAmount || 0);

          return (
            <div
              key={inv.id}
              className={`rounded-2xl border p-3.5 shadow-2xs transition-all ${
                isFullyPaid
                  ? 'bg-emerald-50/20 dark:bg-emerald-950/15 border-emerald-200/70 dark:border-emerald-900/40 hover:border-emerald-300'
                  : isPartiallyPaid
                  ? 'bg-amber-50/20 dark:bg-amber-950/15 border-amber-200/70 dark:border-amber-900/40 hover:border-amber-300'
                  : 'bg-rose-50/20 dark:bg-rose-950/15 border-rose-200/70 dark:border-rose-900/40 hover:border-rose-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0 ${
                      isFullyPaid 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' 
                        : isPartiallyPaid
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                    }`}>
                      {isFullyPaid ? 'كاش (مسددة فوري)' : isPartiallyPaid ? 'سداد جزئي' : 'دين آجل (على الحساب)'}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectMerchant) onSelectMerchant(inv.merchantId);
                      }}
                      className="font-bold text-slate-900 dark:text-white text-sm hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline cursor-pointer text-right"
                      title="فتح صفحة التاجر"
                    >
                      {inv.merchantName}
                    </button>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 font-mono-num font-bold text-slate-600 dark:text-slate-400">
                      #{inv.invoiceNumber}
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span className="flex items-center gap-0.5">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {formatDateArabic(inv.date)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      {getTimeAgoArabic(inv.createdAt || inv.date)}
                    </span>
                    <span>•</span>
                    <span>{inv.items.length} أصناف</span>
                    {inv.orderId && (
                      <>
                        <span>•</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">تسليم طلب شغل</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-left shrink-0 pl-1 font-mono-num">
                  <div className="text-sm font-black text-slate-900 dark:text-white">
                    {formatCurrency(inv.total, currency)}
                  </div>
                  {inv.remainingAmount > 0 ? (
                    <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                      متبقي دين: {formatCurrency(inv.remainingAmount, currency)}
                    </div>
                  ) : (
                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      مسددة بالكامل
                    </div>
                  )}
                </div>
              </div>

              {/* Items summary */}
              <div className="py-2 flex items-center gap-1 flex-wrap text-[11px] text-slate-600 dark:text-slate-300 border-t border-slate-200/60 dark:border-slate-800 mt-2">
                {inv.items.map((it, idx) => (
                  <span key={idx} className="bg-white/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 px-1.5 py-0.5 rounded-md">
                    {it.productName} ({it.quantity}x)
                  </span>
                ))}
                {inv.discount > 0 && (
                  <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 px-1.5 py-0.5 rounded-md font-bold">
                    خصم {formatCurrency(inv.discount, currency)}
                  </span>
                )}
              </div>

              {/* Account Balance Before & After Invoice */}
              <div className="bg-white/90 dark:bg-slate-800/80 rounded-xl p-2 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-[11px] font-mono-num flex-wrap gap-1">
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <span>حساب التاجر قبل الفاتورة:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(prevDebt, currency)}</span>
                </div>
                <div className="flex items-center gap-1 font-bold">
                  <span className="text-slate-600 dark:text-slate-400">الحساب بعد الفاتورة:</span>
                  <span className={newDebt > 0 ? "text-rose-600 dark:text-rose-400 font-black" : "text-emerald-600 dark:text-emerald-400 font-black"}>
                    {formatCurrency(newDebt, currency)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2 mt-2">
                <span className="text-[10px] text-slate-400 truncate">
                  {inv.notes || `مسدد نقداً: ${formatCurrency(inv.paidAmount, currency)}`}
                </span>

                <div className="flex items-center gap-1 shrink-0">
                  {onPrintInvoice && (
                    <button
                      onClick={() => onPrintInvoice(inv)}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"
                    >
                      <Printer className="w-3 h-3" />
                      <span>طباعة</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenCreate(inv)}
                    title="تعديل الفاتورة"
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setInvoiceToDelete(inv)}
                    title="حذف الفاتورة"
                    className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredInvoices.length === 0 && (
          <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">لا توجد فواتير في هذا العرض</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">اضغط على زر "إصدار فاتورة" لتسجيل عملية بيع جديدة للتاجر.</p>
          </div>
        )}
      </div>

      {/* Create / Edit Invoice Modal (Bottom Sheet on Mobile) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 mb-2 shrink-0">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>{editingInvoice ? 'تعديل فاتورة البيع' : 'إصدار فاتورة بيع جديدة'}</span>
              </h3>
              <button onClick={handleCloseForm} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message if any */}
            {formError && (
              <div className="p-2 mb-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs flex items-center gap-1.5 font-bold shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmitInvoice} id="mobile-invoice-form" className="flex-1 overflow-y-auto space-y-3 text-xs sm:text-sm pr-1 overscroll-contain">
              
              {/* Merchant Selection with Instant 1-Letter Search */}
              <div>
                <SearchableSelect
                  label="التاجر / العميل"
                  required
                  options={merchants.map(m => ({
                    id: m.id,
                    label: m.name,
                    subLabel: m.phone ? `هاتف: ${m.phone}` : undefined,
                    badge: merchantBalances[m.id]?.currentDebt > 0 
                      ? `دين: ${formatCurrency(merchantBalances[m.id].currentDebt, currency)}` 
                      : undefined,
                    badgeColor: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400',
                  }))}
                  value={merchantId}
                  onChange={setMerchantId}
                  placeholder="ابحث بالاسم أو الهاتف من أول حرف..."
                  searchPlaceholder="اكتب أول حرف للبحث الفوري..."
                  onAddNew={() => setIsQuickAddMerchantOpen(true)}
                  addNewText="+ تاجر جديد سريع"
                  accentColor="emerald"
                />

                {/* Inline Quick Add Merchant */}
                {isQuickAddMerchantOpen && (
                  <div className="mt-2 p-3 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                    <span className="font-bold text-xs text-emerald-900 dark:text-emerald-200 block">إضافة تاجر جديد فوراً:</span>
                    <input
                      type="text"
                      placeholder="اسم التاجر الجديد"
                      value={quickMerchantName}
                      onChange={(e) => setQuickMerchantName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                    />
                    <input
                      type="tel"
                      dir="ltr"
                      placeholder="رقم الهاتف أو الواتساب"
                      value={quickMerchantPhone}
                      onChange={(e) => setQuickMerchantPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs text-right"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsQuickAddMerchantOpen(false)}
                        className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickAddMerchant}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                      >
                        حفظ واختيار
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Invoice Date */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">تاريخ الفاتورة *</label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono-num"
                />
              </div>

              {/* Items List */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">الأصناف والمنتجات المباعة:</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>إضافة صنف</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2"
                    >
                      {/* Product Selector with Instant 1-Letter Search / Custom Name */}
                      <div>
                        {products.length > 0 ? (
                          <div className="space-y-1">
                            <SearchableSelect
                              options={products.map(p => ({
                                id: p.id,
                                label: p.name,
                                subLabel: p.unit ? `الوحدة: ${p.unit}` : undefined,
                                badge: formatCurrency(p.price, currency),
                                badgeColor: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400',
                              }))}
                              value={item.productId || ''}
                              onChange={(prodId) => handleItemProductChange(idx, prodId)}
                              placeholder="-- ابحث عن صنف بالاسم من أول حرف --"
                              searchPlaceholder="اكتب أول حرف للبحث الفوري عن المنتج..."
                              accentColor="emerald"
                            />
                            <input
                              type="text"
                              placeholder="أو اكتب اسم مخصص للصنف"
                              value={item.productName}
                              onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                            />
                          </div>
                        ) : (
                          <input
                            type="text"
                            required
                            placeholder="اسم المنتج المباع للتاجر"
                            value={item.productName}
                            onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                          />
                        )}
                      </div>

                      {/* Quantity & Unit Price & Row Total with big touch buttons */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                        {/* Quantity with +/- */}
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => adjustQty(idx, -1)}
                            className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-14 text-center font-mono-num font-bold text-xs bg-transparent text-slate-900 dark:text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => adjustQty(idx, 1)}
                            className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Price Input */}
                        <div className="relative w-24">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="السعر"
                            value={item.unitPrice === 0 ? '' : item.unitPrice}
                            onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono-num text-center text-xs"
                          />
                        </div>

                        {/* Total Row */}
                        <div className="font-mono-num font-bold text-slate-900 dark:text-white text-xs">
                          {formatCurrency(item.total, currency)}
                        </div>

                        {/* Remove item */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={items.length <= 1}
                          className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-20"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discount Section */}
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 dark:text-amber-300 text-xs flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>خصم للتاجر (اختياري):</span>
                  </span>

                  <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-amber-200 dark:border-amber-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setDiscountType('amount')}
                      className={`px-2 py-0.5 rounded font-bold ${
                        discountType === 'amount' ? 'bg-amber-600 text-white' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      مبلغ ({currency})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percentage')}
                      className={`px-2 py-0.5 rounded font-bold ${
                        discountType === 'percentage' ? 'bg-amber-600 text-white' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      نسبة %
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="قيمة الخصم إن وجد"
                    value={discountValue === 0 ? '' : discountValue}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono-num text-xs focus:outline-none"
                  />
                  {calculatedDiscount > 0 && (
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300 shrink-0">
                      -{formatCurrency(calculatedDiscount, currency)}
                    </span>
                  )}
                </div>
              </div>

              {/* Payment Type Selection & Cash/Debt calculation */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    طريقة وحالة الدفع:
                  </label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    remainingAmount <= 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : paidAmount > 0
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}>
                    {remainingAmount <= 0 ? 'كاش (مسددة بالكامل)' : paidAmount > 0 ? 'سداد جزئي' : 'دين آجل بالكامل'}
                  </span>
                </div>

                {/* 3 Quick 1-Click Payment Selectors */}
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPaidAmount(netTotal)}
                    className={`py-1.5 px-2 rounded-lg font-bold border transition-all text-center ${
                      paidAmount >= netTotal && netTotal > 0
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                    }`}
                  >
                    كاش بالكامل
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaidAmount(0)}
                    className={`py-1.5 px-2 rounded-lg font-bold border transition-all text-center ${
                      paidAmount === 0
                        ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-300'
                    }`}
                  >
                    دين آجل بالكامل
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (paidAmount === 0 || paidAmount >= netTotal) {
                        setPaidAmount(Math.round(netTotal / 2));
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg font-bold border transition-all text-center ${
                      paidAmount > 0 && paidAmount < netTotal
                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-300'
                    }`}
                  >
                    سداد جزئي
                  </button>
                </div>

                {/* Paid Input */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600 dark:text-slate-400">المدفوع نقداً فوري:</span>
                    <span className="font-mono-num font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(paidAmount, currency)}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={netTotal}
                    placeholder="0"
                    value={paidAmount === 0 ? '' : paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono-num font-bold text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Live Account Preview Before and After */}
                {(() => {
                  const mBal = merchantBalances[merchantId];
                  const currentMerchantDebt = mBal ? Math.max(0, mBal.currentDebt) : 0;
                  const projectedDebt = currentMerchantDebt + remainingAmount;

                  return (
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 font-mono-num text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span className="font-sans">حساب التاجر السابق:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {formatCurrency(currentMerchantDebt, currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                        <span className="font-sans font-bold">المتبقي دين من الفاتورة:</span>
                        <span className="font-black">
                          +{formatCurrency(remainingAmount, currency)}
                        </span>
                      </div>
                      <div className="pt-1 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between font-bold">
                        <span className="font-sans text-slate-800 dark:text-slate-200">الحساب بعد الفاتورة:</span>
                        <span className={`font-black ${projectedDebt > 0 ? 'text-rose-600 dark:text-rose-400 text-sm' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {formatCurrency(projectedDebt, currency)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظات على الفاتورة</label>
                <input
                  type="text"
                  placeholder="أي ملاحظات إضافية..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

            </form>

            {/* Bottom Actions - Lifted above mobile navigation bar */}
            <div className="pt-3 pb-8 sm:pb-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-500 dark:text-slate-400">إجمالي الفاتورة الصافي:</span>
                <span className="font-mono-num font-black text-emerald-700 dark:text-emerald-400 text-base">
                  {formatCurrency(netTotal, currency)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2 sm:mb-0">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="py-3 sm:py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs active:scale-95 transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  form="mobile-invoice-form"
                  className="py-3 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
                >
                  {editingInvoice ? 'حفظ التعديل' : 'حفظ واعتماد الفاتورة'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(invoiceToDelete)}
        title={`حذف الفاتورة #${invoiceToDelete?.invoiceNumber}`}
        message="هل أنت متأكد من حذف هذه الفاتورة؟ سيتم خصم قيمتها من إجمالي دين التاجر وإعادة احتساب الرصيد تلقائياً."
        onConfirm={handleConfirmDelete}
        onClose={() => setInvoiceToDelete(null)}
      />

    </div>
  );
};
