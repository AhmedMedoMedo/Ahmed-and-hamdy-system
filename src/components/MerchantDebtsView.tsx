import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/formatters';
import { 
  AlertCircle, 
  Search, 
  Phone, 
  MessageCircle, 
  FileText, 
  HandCoins, 
  TrendingDown, 
  MapPin, 
  CheckCircle2, 
  ArrowUpDown,
  Send,
  X,
  Copy,
  Receipt
} from 'lucide-react';

interface MerchantDebtsViewProps {
  onSelectMerchant: (merchantId: string) => void;
  onOpenNewPayment: (merchantId: string) => void;
  onOpenNewInvoice: (merchantId: string) => void;
}

export const MerchantDebtsView: React.FC<MerchantDebtsViewProps> = ({
  onSelectMerchant,
  onOpenNewPayment,
  onOpenNewInvoice
}) => {
  const { 
    merchants, 
    merchantBalances, 
    currency, 
    storeName,
    totalAllTimeDebt,
    showToast
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'debt_desc' | 'debt_asc' | 'name'>('debt_desc');

  // WhatsApp claim modal state
  const [claimMerchant, setClaimMerchant] = useState<{ id: string; name: string; phone: string; debt: number } | null>(null);

  // Filter only merchants who have outstanding debt (> 0)
  const debtorMerchants = useMemo(() => {
    return merchants
      .map(m => {
        const balance = merchantBalances[m.id];
        const debt = balance?.currentDebt || 0;
        return {
          merchant: m,
          debt,
          totalInvoiced: balance?.totalInvoicedAllTime || 0,
          totalPaid: balance?.totalPaidAllTime || 0,
        };
      })
      .filter(item => item.debt > 0)
      .filter(item => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
          item.merchant.name.toLowerCase().includes(q) ||
          item.merchant.phone.toLowerCase().includes(q) ||
          item.merchant.address.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'debt_desc') return b.debt - a.debt;
        if (sortBy === 'debt_asc') return a.debt - b.debt;
        return a.merchant.name.localeCompare(b.merchant.name, 'ar');
      });
  }, [merchants, merchantBalances, searchTerm, sortBy]);

  // Total debt of filtered merchants
  const filteredTotalDebt = useMemo(() => {
    return debtorMerchants.reduce((sum, item) => sum + item.debt, 0);
  }, [debtorMerchants]);

  const handleOpenClaimModal = (m: { id: string; name: string; phone: string; debt: number }) => {
    setClaimMerchant(m);
  };

  const getWhatsAppMessage = (name: string, debt: number) => {
    return `السلام عليكم ورحمة الله وبركاته يا ${name}،\nتحياتنا لحضرتك من إدارة (${storeName || 'أحمد وحمدي'}).\n\nنود تذكير سيادتكم بمتبقي الحساب المستحق طرفكم وقدره:\n*${formatCurrency(debt, currency)}*\n\nشاكرين لحضرتكم دوام التعاون وسرعة السداد.`;
  };

  const handleSendWhatsApp = () => {
    if (!claimMerchant) return;
    const msg = getWhatsAppMessage(claimMerchant.name, claimMerchant.debt);
    const cleanPhone = claimMerchant.phone.replace(/[^0-9]/g, '');
    let intlPhone = cleanPhone;
    if (intlPhone.startsWith('01')) {
      intlPhone = '2' + intlPhone;
    }
    const url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setClaimMerchant(null);
  };

  const handleCopyMessage = () => {
    if (!claimMerchant) return;
    const msg = getWhatsAppMessage(claimMerchant.name, claimMerchant.debt);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(msg);
      showToast('تم نسخ نص رسالة المطالبة 📋');
    }
  };

  return (
    <div className="space-y-3 pb-8">
      
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-amber-700 text-white p-4 rounded-3xl shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 backdrop-blur-xs">
              <AlertCircle className="w-5 h-5 text-rose-100" />
            </div>
            <div>
              <h2 className="text-base font-black leading-tight">
                ديون التجار المطلوب تحصيلها
              </h2>
              <p className="text-[11px] text-rose-100/90 font-medium">
                متابعة المبالغ المستحقة طرف التجار والعملاء للتحصيل الفوري
              </p>
            </div>
          </div>
          
          <span className="text-xs bg-white/20 px-2.5 py-1 rounded-xl font-bold font-mono-num">
            {debtorMerchants.length} تاجر مدين
          </span>
        </div>

        {/* Total Debt Counter Banner */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-rose-200 block font-bold">إجمالي المبالغ المطلوبة بالسوق:</span>
            <span className="text-xl sm:text-2xl font-black font-mono-num tracking-tight">
              {formatCurrency(totalAllTimeDebt, currency)}
            </span>
          </div>

          <div className="text-left text-[11px]">
            <span className="text-rose-200 block text-[10px]">معدل التحصيل</span>
            <span className="font-bold text-emerald-300">
              {debtorMerchants.length === 0 ? 'خالص 100%' : 'جاري التحصيل'}
            </span>
          </div>
        </div>
      </div>

      {/* Search and Sort Control Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث باسم التاجر أو رقم الهاتف..."
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-2 pr-9 pl-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => {
            setSortBy(prev => prev === 'debt_desc' ? 'debt_asc' : prev === 'debt_asc' ? 'name' : 'debt_desc');
          }}
          className="px-3 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 shrink-0"
          title="ترتيب"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          <span className="text-[11px]">
            {sortBy === 'debt_desc' ? 'الأعلى ديناً' : sortBy === 'debt_asc' ? 'الأقل ديناً' : 'أبجدياً'}
          </span>
        </button>
      </div>

      {/* Debtor Merchants List */}
      {debtorMerchants.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-white">
            {searchTerm ? 'لا توجد نتائج مطابقة لبحثك' : 'الحمد لله! لا توجد ديون مستحقة'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            {searchTerm 
              ? 'تأكد من كتابة اسم التاجر أو رقم الهاتف بشكل صحيح.'
              : 'جميع حسابات وفواتير التجار مسددة بالكامل ولا توجد أي مبالغ متأخرة.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {debtorMerchants.map(({ merchant, debt, totalInvoiced, totalPaid }) => (
            <div
              key={merchant.id}
              className="bg-white dark:bg-slate-800/90 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700/80 shadow-2xs space-y-2.5 transition-all hover:border-rose-300 dark:hover:border-rose-900/60"
            >
              {/* Header: Name + Debt Amount */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <button
                    onClick={() => onSelectMerchant(merchant.id)}
                    className="font-bold text-sm text-slate-900 dark:text-white hover:text-rose-600 dark:hover:text-rose-400 text-right truncate block"
                  >
                    {merchant.name}
                  </button>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                    {merchant.phone && (
                      <span className="flex items-center gap-1 font-mono-num" dir="ltr">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{merchant.phone}</span>
                      </span>
                    )}
                    {merchant.address && (
                      <span className="flex items-center gap-1 truncate max-w-[150px]">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{merchant.address}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Outstanding Debt Badge */}
                <div className="text-left shrink-0 bg-rose-50 dark:bg-rose-950/60 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60">
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block leading-none">
                    المتبقي دين
                  </span>
                  <span className="text-sm sm:text-base font-black text-rose-700 dark:text-rose-300 font-mono-num">
                    {formatCurrency(debt, currency)}
                  </span>
                </div>
              </div>

              {/* Invoiced vs Paid breakdown */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800 font-mono-num">
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block font-sans">إجمالي فواتير البيع:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {formatCurrency(totalInvoiced, currency)}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-slate-400 text-[10px] block font-sans">المسدد فعلياً:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(totalPaid, currency)}
                  </span>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                {/* 1. Add Payment / Collection */}
                <button
                  type="button"
                  onClick={() => onOpenNewPayment(merchant.id)}
                  className="py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-2xs transition-colors"
                >
                  <HandCoins className="w-3.5 h-3.5" />
                  <span>تحصيل</span>
                </button>

                {/* 2. Full Account Statement */}
                <button
                  type="button"
                  onClick={() => onSelectMerchant(merchant.id)}
                  className="py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>كشف حساب</span>
                </button>

                {/* 3. WhatsApp Debt Claim */}
                <button
                  type="button"
                  onClick={() => handleOpenClaimModal({ id: merchant.id, name: merchant.name, phone: merchant.phone, debt })}
                  className="py-1.5 px-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>واتساب</span>
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* WhatsApp Claim Confirmation Modal */}
      {claimMerchant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    إرسال مطالبة مالية عبر واتساب
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {claimMerchant.name}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setClaimMerchant(null)} 
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Preview */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
              {getWhatsAppMessage(claimMerchant.name, claimMerchant.debt)}
            </div>

            <div className="space-y-2">
              <button
                onClick={handleSendWhatsApp}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>فتح محادثة واتساب وإرسال المطالبة</span>
              </button>

              <button
                onClick={handleCopyMessage}
                className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ نص الرسالة فقط</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
