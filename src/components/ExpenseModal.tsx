import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Expense, ExpenseCategory, PaymentMethod } from '../types';
import { getTodayDateString } from '../utils/formatters';
import { 
  DollarSign, 
  X, 
  Calendar, 
  FileText, 
  Tag, 
  CreditCard, 
  Layers,
  ArrowDownCircle
} from 'lucide-react';

interface ExpenseModalProps {
  initialExpense?: Expense | null;
  onClose: () => void;
}

const CATEGORIES: { label: ExpenseCategory; icon: string }[] = [
  { label: 'مصاريف عامة وتوريد', icon: '📦' },
  { label: 'مرتبات وأجور', icon: '👥' },
  { label: 'صيانة وتصليح', icon: '🔧' },
  { label: 'نقل وتوصيل', icon: '🚚' },
  { label: 'إيجار وكهرباء', icon: '💡' },
  { label: 'مسحوبات شخصية', icon: '👤' },
  { label: 'أخرى', icon: '📝' },
];

const PAYMENT_METHODS: PaymentMethod[] = [
  'كاش',
  'فودافون كاش / إنستاباي',
  'تحويل بنكي',
  'شيك',
  'أخرى'
];

export const ExpenseModal: React.FC<ExpenseModalProps> = ({ initialExpense, onClose }) => {
  const { saveExpense, currency, showToast } = useApp();

  const [title, setTitle] = useState(initialExpense?.title || '');
  const [category, setCategory] = useState<ExpenseCategory>(initialExpense?.category || 'مصاريف عامة وتوريد');
  const [amount, setAmount] = useState<string>(initialExpense ? String(initialExpense.amount) : '');
  const [date, setDate] = useState(initialExpense?.date || getTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialExpense?.paymentMethod || 'كاش');
  const [notes, setNotes] = useState(initialExpense?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!title.trim()) {
      showToast('يرجى كتابة بيان أو سبب المسحوبات/المصروف');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }

    try {
      setIsSubmitting(true);
      await saveExpense({
        ...(initialExpense?.id ? { id: initialExpense.id } : {}),
        title: title.trim(),
        category,
        amount: numAmount,
        date,
        monthKey: date.substring(0, 7),
        paymentMethod,
        notes: notes.trim(),
      });
      showToast(initialExpense ? 'تم تعديل المصروف بنجاح' : 'تم تسجيل المصروف وخصمه من صافي التحصيل بنجاح');
    } catch (err) {
      console.warn("Expense saved locally in offline mode:", err);
      showToast(initialExpense ? 'تم تعديل المصروف محلياً' : 'تم تسجيل المصروف محلياً (أوفلاين) 📴');
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <ArrowDownCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {initialExpense ? 'تعديل مسحوبات / مصروف' : 'تسجيل مسحوبات أو مصروفات'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                يتم خصم المبلغ تلقائياً من صافي تحصيل الشهر
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs sm:text-sm">
          
          {/* Amount input */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-rose-500" />
              <span>المبلغ المسحوب ({currency}) *</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder=""
                autoFocus
                required
                className="w-full px-3 py-2.5 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 font-black text-lg text-center font-mono-num focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-rose-600 dark:text-rose-400">
                {currency}
              </span>
            </div>
          </div>

          {/* Title / Description */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>بيان / سبب السحب أو المصروف *</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder=""
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Category selection */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-500" />
              <span>تصنيف المصروف</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.label;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setCategory(cat.label)}
                    className={`p-2 rounded-xl text-[11px] font-bold text-right flex items-center gap-1.5 transition-all ${
                      isSelected 
                        ? 'bg-rose-600 text-white shadow-2xs' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Payment Method */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span>التاريخ</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono-num focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                <span>طريقة الدفع/السحب</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>{pm}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>ملاحظات إضافية (اختياري)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder=""
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Actions - Lifted above mobile navigation bar */}
          <div className="pt-3 pb-8 sm:pb-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 mb-2 sm:mb-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold active:scale-95 transition-all"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-2 py-3 sm:py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md active:scale-95 transition-all"
            >
              {isSubmitting ? 'جاري الحفظ...' : initialExpense ? 'حفظ التعديلات' : 'تسجيل وخصم من التحصيل'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
