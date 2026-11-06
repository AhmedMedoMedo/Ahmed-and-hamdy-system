import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Invoice, Payment } from '../types';
import { formatCurrency, formatDateArabic } from '../utils/formatters';
import { toPng } from 'html-to-image';
import { 
  Printer, 
  Share2, 
  X, 
  Camera, 
  Download, 
  User, 
  Phone, 
  Loader2,
  Send,
  Sparkles
} from 'lucide-react';

interface PrintModalProps {
  invoice?: Invoice | null;
  payment?: Payment | null;
  currency?: string;
  onClose: () => void;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  invoice,
  payment,
  onClose,
}) => {
  const { merchantBalances, storeName, currency, merchants, showToast } = useApp();

  // Screenshot & Sharing States
  const [isCapturing, setIsCapturing] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [capturedImageDataUrl, setCapturedImageDataUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>(
    invoice?.merchantId || payment?.merchantId || (merchants[0]?.id || '')
  );
  const [customPhone, setCustomPhone] = useState<string>(() => {
    const targetId = invoice?.merchantId || payment?.merchantId;
    const m = merchants.find(item => item.id === targetId);
    return m?.phone || '';
  });

  if (!invoice && !payment) return null;

  // Format date and time in authentic Egyptian commercial style
  const getFormattedDateTime = (dateStr: string) => {
    try {
      const now = new Date();
      const hours = now.getHours();
      const mins = now.getMinutes().toString().padStart(2, '0');
      const period = hours >= 12 ? 'م' : 'ص';
      const formattedHours = (hours % 12 || 12).toString().padStart(2, '0');
      const timeStr = `في ${formattedHours}:${mins} ${period}`;
      return `${formatDateArabic(dateStr)} ${timeStr}`;
    } catch {
      return formatDateArabic(dateStr);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Balance calculations matching Egyptian accounting practice
  let invoicePrevDebt = 0;
  let invoiceNewTotalDebt = 0;
  let invoicePaymentStatusText = '';

  if (invoice) {
    const mBal = merchantBalances[invoice.merchantId];
    const currentDebt = mBal ? Math.max(0, mBal.currentDebt) : invoice.remainingAmount;
    invoicePrevDebt = Math.max(0, currentDebt - invoice.remainingAmount);
    invoiceNewTotalDebt = invoicePrevDebt + invoice.remainingAmount;

    if (invoice.remainingAmount <= 0) {
      invoicePaymentStatusText = 'خالصة ومسددة بالكامل';
    } else if (invoice.paidAmount > 0) {
      invoicePaymentStatusText = `مسدد منها ${formatCurrency(invoice.paidAmount, currency)} (متبقي دين)`;
    } else {
      invoicePaymentStatusText = 'غير مدفوعة (على الحساب)';
    }
  }

  let paymentPrevDebt = 0;
  let paymentNewDebt = 0;

  if (payment) {
    const mBal = merchantBalances[payment.merchantId];
    paymentNewDebt = mBal ? Math.max(0, mBal.currentDebt) : 0;
    paymentPrevDebt = paymentNewDebt + payment.amount;
  }

  // Generate Egyptian text summary
  const getEgyptianMessageText = () => {
    if (invoice) {
      return `*${storeName || 'Ahmed And Hamdy'}*
*بيان بيع بضاعة — فاتورة رقم: #${invoice.invoiceNumber}*
----------------------------------------
👤 *التاجر/العميل:* ${invoice.merchantName}
📅 *تاريخ الفاتورة:* ${formatDateArabic(invoice.date)}
📦 *الأصناف المباعة:*
${invoice.items.map(it => `• ${it.productName} (${it.quantity} قطعة) × ${formatCurrency(it.unitPrice, currency)} = ${formatCurrency(it.total, currency)}`).join('\n')}
----------------------------------------
💰 *المجموع الفرعي:* ${formatCurrency(invoice.subtotal, currency)}
${invoice.discount > 0 ? `🏷️ *الخصم الممنوح:* -${formatCurrency(invoice.discount, currency)}\n` : ''}💵 *الإجمالي الصافي:* ${formatCurrency(invoice.total, currency)}
${invoice.paidAmount > 0 ? `✅ *المسدد كاش فوري:* ${formatCurrency(invoice.paidAmount, currency)}\n` : ''}⏳ *الباقي من الفاتورة:* ${formatCurrency(invoice.remainingAmount, currency)}
----------------------------------------
📊 *ملخص حساب التاجر:*
• الحساب القديم: ${formatCurrency(invoicePrevDebt, currency)}
• إجمالي الحساب المطلوب دلوقتي: *${formatCurrency(invoiceNewTotalDebt, currency)}*
${invoiceNewTotalDebt > 0 ? `👉 *المطلوب سداده:* ${formatCurrency(invoiceNewTotalDebt, currency)}` : '🎉 *حسابك خالص ومسدد بالكامل*'}

شكراً لتعاملكم الراقي معنا.. تسلم وربنا يباركلك في رزقك 🙏`;
    } else if (payment) {
      return `*${storeName || 'Ahmed And Hamdy'}*
*سند استلام دفعة نقدية — إيصال رقم: #${payment.receiptNumber || 'بدون رقم'}*
----------------------------------------
👤 *استلمنا من التاجر:* ${payment.merchantName}
💵 *مبلغ الدفعة المقبوض:* *${formatCurrency(payment.amount, currency)}*
💳 *طريقة الدفع:* ${payment.paymentMethod}
📅 *التاريخ:* ${formatDateArabic(payment.date)}
${payment.notes ? `📝 *البيان:* ${payment.notes}\n` : ''}----------------------------------------
📊 *تحديث حساب التاجر:*
• الرصيد قبل استلام الدفعة: ${formatCurrency(paymentPrevDebt, currency)}
• الرصيد الحالي بعد خصم الدفعة: *${formatCurrency(paymentNewDebt, currency)}*
${paymentNewDebt > 0 ? `👉 *الباقي عليك للحساب:* ${formatCurrency(paymentNewDebt, currency)}` : '🎉 *حسابك خالص ومسدد بالكامل بدون أي ديون*'}

تم قيد المبلغ في كشف حسابك.. تسلم وربنا يزيدك ويوسع رزقك 🙏`;
    }
    return '';
  };

  // Convert Egyptian phone number to standard international WhatsApp format
  const formatEgyptianPhoneForWhatsApp = (rawPhone: string) => {
    let p = rawPhone.replace(/[^0-9]/g, '');
    if (!p) return '';
    if (p.startsWith('01') && p.length === 11) {
      return '20' + p.substring(1);
    }
    if (p.startsWith('20') && p.length === 12) {
      return p;
    }
    if (p.startsWith('0020')) {
      return p.substring(2);
    }
    return p;
  };

  // Helper to convert base64 dataUrl to Blob without extra render pass
  const dataUrlToBlob = (dataUrl: string): Blob => {
    const parts = dataUrl.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  };

  // 1. Capture screen from invoice element using html-to-image (Supports OKLCH colors natively)
  const handleCaptureAndOpenShare = async () => {
    const el = document.getElementById('printable-voucher');
    if (!el) return;

    setIsCapturing(true);
    try {
      // Use html-to-image with skipFonts: true to avoid cross-origin SecurityError when reading external Google Fonts stylesheets
      const dataUrl = await toPng(el, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        skipFonts: true,
        fontEmbedCSS: '',
      });

      setCapturedImageDataUrl(dataUrl);
      const blob = dataUrlToBlob(dataUrl);
      setCapturedBlob(blob);

      // Initialize recipient selection
      const initialId = invoice?.merchantId || payment?.merchantId || (merchants[0]?.id || '');
      setSelectedMerchantId(initialId);
      const m = merchants.find(item => item.id === initialId);
      setCustomPhone(m?.phone || '');

      setIsShareModalOpen(true);
    } catch (err) {
      console.error('Failed to capture screenshot', err);
      showToast('تعذر التقاط سكرين الفاتورة، يرجى المحاولة مرة ثانية');
    } finally {
      setIsCapturing(false);
    }
  };

  // When merchant selection changes in the share modal
  const handleRecipientChange = (merchantId: string) => {
    setSelectedMerchantId(merchantId);
    const m = merchants.find(item => item.id === merchantId);
    if (m && m.phone) {
      setCustomPhone(m.phone);
    } else {
      setCustomPhone('');
    }
  };

  // 2. Direct Web Share API (native WhatsApp image share on mobile - Photo Only without text)
  const handleNativeShareImage = async () => {
    if (!capturedBlob) return;
    const docNumber = invoice ? invoice.invoiceNumber : (payment?.receiptNumber || '0742');
    const fileName = `فاتورة-${docNumber}.png`;
    const file = new File([capturedBlob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `فاتورة ${invoice?.merchantName || payment?.merchantName || ''}`,
        });
        showToast('تمت مشاركة صورة الفاتورة بنجاح عبر الواتساب');
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Error sharing file', err);
          handleFallbackWhatsAppChat();
        }
      }
    } else {
      // Fallback for browsers that don't support file sharing via navigator.share
      handleFallbackWhatsAppChat();
    }
  };

  // 3. Fallback: Copy image to clipboard, download PNG, and launch WhatsApp chat without text
  const handleFallbackWhatsAppChat = () => {
    const cleanPhone = formatEgyptianPhoneForWhatsApp(customPhone);

    // Try to copy image to clipboard
    if (capturedBlob && navigator.clipboard && 'write' in navigator.clipboard && window.ClipboardItem) {
      try {
        navigator.clipboard.write([
          new ClipboardItem({ 'image/png': capturedBlob })
        ]).catch(() => {});
      } catch {
        // Ignore clipboard error
      }
    }

    // Trigger image download to device gallery
    handleDownloadImage();

    // Open WhatsApp directly without any text parameters
    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}`
      : `https://wa.me/`;

    const a = document.createElement('a');
    a.href = waUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast('تم حفظ صورة الفاتورة في جهازك وفتح محادثة الواتساب مع التاجر 📸');
  };

  // 4. Download Image directly
  const handleDownloadImage = () => {
    if (!capturedImageDataUrl) return;
    const docNumber = invoice ? invoice.invoiceNumber : (payment?.receiptNumber || '0742');
    const link = document.createElement('a');
    link.href = capturedImageDataUrl;
    link.download = `فاتورة_${docNumber}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs print:p-0 print:bg-white print:static">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-3 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[96vh] flex flex-col justify-between overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none print:w-full print:p-0">
        
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 mb-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة مستند A4</span>
            </button>

            {/* User Requested: Screenshot and WhatsApp share with Person Selection */}
            <button
              onClick={handleCaptureAndOpenShare}
              disabled={isCapturing}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-50"
            >
              {isCapturing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري تصوير الفاتورة...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>مشاركة سكرين واتساب</span>
                </>
              )}
            </button>
          </div>

          <button 
            onClick={onClose} 
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Voucher Sheet — Pure White Print Spooler Replica */}
        <div 
          id="printable-voucher" 
          className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white text-black font-sans print:overflow-visible print:p-0 border border-slate-200 rounded-2xl shadow-inner print:border-none print:shadow-none"
          dir="rtl"
        >
          
          {/* ==================== 1. SALES INVOICE VIEW ==================== */}
          {invoice && (
            <div className="space-y-3.5 max-w-xl mx-auto">
              
              {/* Header: Company Title (Right) + Invoice # / Date Box (Left) */}
              <div className="flex items-start justify-between gap-4">
                
                {/* Right: Company Name & System */}
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight leading-tight">
                    {storeName || 'Ahmed And Hamdy'}
                  </h1>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                    النظام المحاسبي الداخلي — بيان حركة بيع
                  </p>
                </div>

                {/* Left: Box with Invoice Number & Execution Date */}
                <div className="border border-slate-300 rounded-md text-[11px] font-mono-num divide-y divide-slate-200 min-w-[190px] text-right">
                  <div className="p-1.5 flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">رقم الفاتورة:</span>
                    <span className="font-black text-black">#{invoice.invoiceNumber}</span>
                  </div>
                  <div className="p-1.5 flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">تاريخ الحركة:</span>
                    <span className="font-bold text-black text-[10px]">
                      {getFormattedDateTime(invoice.date)}
                    </span>
                  </div>
                </div>

              </div>

              {/* Solid Horizontal Divider Line */}
              <div className="border-b-2 border-black my-2"></div>

              {/* Sub-Header: Clean Badge "فاتورة بيع" */}
              <div className="flex items-center justify-between text-xs">
                <span className="border border-slate-800 px-3 py-0.5 rounded text-[11px] font-bold text-black">
                  فاتورة بيع
                </span>
                <span className="text-[10px] text-slate-500 font-mono-num">
                  {invoice.items.length} أصناف مباعة
                </span>
              </div>

              {/* USER REQUESTED: Two-Box Grid with "حالة الدفع" replacing "المخزن المصدر" */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                
                {/* Right Box: Invoice To (Merchant) */}
                <div className="border border-slate-300 rounded-md p-2 flex flex-col justify-between min-h-[64px]">
                  <span className="text-[10px] text-slate-500">الفاتورة إلى:</span>
                  <div className="text-sm sm:text-base font-black text-black truncate my-0.5">
                    {invoice.merchantName}
                  </div>
                  <span className="text-[10px] text-slate-500">التاجر / العميل</span>
                </div>

                {/* Left Box: Payment Status (Replaces Warehouse as explicitly requested) */}
                <div className="border border-slate-300 rounded-md p-2 flex flex-col justify-between min-h-[64px]">
                  <span className="text-[10px] text-slate-500">حالة الدفع:</span>
                  <div className={`text-xs sm:text-sm font-black truncate my-0.5 ${
                    invoice.remainingAmount <= 0 
                      ? 'text-emerald-700' 
                      : invoice.paidAmount > 0 
                      ? 'text-teal-700' 
                      : 'text-rose-700'
                  }`}>
                    {invoicePaymentStatusText}
                  </div>
                  <span className="text-[10px] text-slate-500 truncate">
                    {invoice.remainingAmount <= 0 
                      ? 'مسددة بالكامل كاش فوري' 
                      : invoice.paidAmount > 0 
                      ? `مسدد ${formatCurrency(invoice.paidAmount, currency)} • باقي ${formatCurrency(invoice.remainingAmount, currency)}` 
                      : 'متبقية بالكامل دين على الحساب'}
                  </span>
                </div>

              </div>

              {/* Table of Sold Items (Matching Screenshot) */}
              <div className="border border-slate-300 rounded-md overflow-hidden">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-300 text-[11px] font-bold text-black">
                      <th className="py-1.5 px-2 border-l border-slate-200">الصنف</th>
                      <th className="py-1.5 px-2 text-center border-l border-slate-200 w-24">الكمية</th>
                      <th className="py-1.5 px-2 text-center border-l border-slate-200 w-24">سعر الوحدة</th>
                      <th className="py-1.5 px-2 text-left w-28">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono-num text-xs">
                    {invoice.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2 font-sans font-bold text-black border-l border-slate-200">
                          {it.productName}
                        </td>
                        <td className="py-1.5 px-2 text-center border-l border-slate-200">
                          {it.quantity} قطعة
                        </td>
                        <td className="py-1.5 px-2 text-center border-l border-slate-200">
                          {formatCurrency(it.unitPrice, currency)}
                        </td>
                        <td className="py-1.5 px-2 text-left font-black text-black">
                          {formatCurrency(it.total, currency)}
                        </td>
                      </tr>
                    ))}

                    {/* Subtotal */}
                    <tr className="bg-slate-50/70 border-t border-slate-300 text-xs">
                      <td colSpan={3} className="py-1 px-2 font-bold text-slate-700 text-right border-l border-slate-200">
                        المجموع الفرعي
                      </td>
                      <td className="py-1 px-2 text-left font-bold text-black font-mono-num">
                        {formatCurrency(invoice.subtotal, currency)}
                      </td>
                    </tr>

                    {/* Discount (if applicable) */}
                    {invoice.discount > 0 && (
                      <tr className="bg-amber-50/30 text-xs">
                        <td colSpan={3} className="py-1 px-2 font-bold text-amber-900 text-right border-l border-slate-200">
                          الخصم الممنوح
                        </td>
                        <td className="py-1 px-2 text-left font-bold text-amber-900 font-mono-num">
                          -{formatCurrency(invoice.discount, currency)}
                        </td>
                      </tr>
                    )}

                    {/* Grand Total */}
                    <tr className="bg-slate-100 border-t-2 border-slate-300 text-xs">
                      <td colSpan={3} className="py-1.5 px-2 font-black text-black text-right border-l border-slate-200">
                        الإجمالي الصافي
                      </td>
                      <td className="py-1.5 px-2 text-left font-black text-black font-mono-num text-sm">
                        {formatCurrency(invoice.total, currency)}
                      </td>
                    </tr>

                    {/* If Paid upfront */}
                    {invoice.paidAmount > 0 && (
                      <tr className="bg-teal-50/40 text-xs">
                        <td colSpan={3} className="py-1 px-2 font-bold text-teal-800 text-right border-l border-slate-200">
                          المدفوع كاش فوري
                        </td>
                        <td className="py-1 px-2 text-left font-bold text-teal-800 font-mono-num">
                          {formatCurrency(invoice.paidAmount, currency)}
                        </td>
                      </tr>
                    )}

                    {/* If Remaining Debt */}
                    {invoice.remainingAmount > 0 && (
                      <tr className="bg-rose-50/40 text-xs">
                        <td colSpan={3} className="py-1 px-2 font-black text-rose-700 text-right border-l border-slate-200">
                          الباقي دين على الحساب
                        </td>
                        <td className="py-1 px-2 text-left font-black text-rose-700 font-mono-num">
                          {formatCurrency(invoice.remainingAmount, currency)}
                        </td>
                      </tr>
                    )}

                  </tbody>
                </table>
              </div>

              {/* Merchant Account Summary Card (Exact Match to Screenshot) */}
              <div className="border border-slate-300 rounded-md overflow-hidden text-xs">
                {/* Header */}
                <div className="bg-slate-100 px-3 py-1 border-b border-slate-300 font-bold text-black flex justify-between items-center text-[11px]">
                  <span>ملخص حساب التاجر</span>
                  <span className="text-[10px] text-slate-500 font-normal">{invoice.merchantName}</span>
                </div>

                {/* 2 Equal Columns: Previous Debt vs New Total Debt */}
                <div className="grid grid-cols-2 divide-x divide-x-reverse divide-slate-300 p-2 font-mono-num text-center">
                  <div className="px-2">
                    <span className="text-[10px] text-slate-500 font-sans block mb-1">حساب التاجر السابق</span>
                    <span className="font-bold text-black text-sm">
                      {formatCurrency(invoicePrevDebt, currency)}
                    </span>
                  </div>

                  <div className="px-2">
                    <span className="text-[10px] text-slate-500 font-sans block mb-1">حساب التاجر الإجمالي</span>
                    <span className="font-black text-black text-sm">
                      {formatCurrency(invoiceNewTotalDebt, currency)}
                    </span>
                  </div>
                </div>

                {/* Sub-footer inside box: Status of account after operation */}
                <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-200 text-center text-[11px] font-bold text-black">
                  <span>وضع الحساب بعد العملية: </span>
                  {invoiceNewTotalDebt > 0 ? (
                    <span className="font-black text-rose-700 font-mono-num">
                      على التاجر تسديد {formatCurrency(invoiceNewTotalDebt, currency)}
                    </span>
                  ) : (
                    <span className="font-black text-emerald-700">
                      حساب التاجر خالص ومسدد تماماً ولا يوجد عليه دين
                    </span>
                  )}
                </div>
              </div>

              {/* Notes */}
              {invoice.notes && (
                <div className="p-2 border border-dashed border-slate-300 rounded-md text-[10px] text-slate-600">
                  <span className="font-bold">ملاحظات الفاتورة: </span>
                  <span>{invoice.notes}</span>
                </div>
              )}

              {/* Printable Footer with Signature & Timestamp */}
              <div className="pt-4 border-t border-dashed border-slate-300 flex items-center justify-between text-[10px] text-slate-500">
                <div>التوقيع والختم: .......................................</div>
                <div className="font-mono-num">
                  تمت معاينة المستند: {getFormattedDateTime(invoice.date)}
                </div>
              </div>

              <div className="text-[9px] text-slate-400 font-mono-num text-right">
                {invoice.invoiceNumber}
              </div>

            </div>
          )}

          {/* ==================== 2. PAYMENT / VOUCHER VIEW ==================== */}
          {payment && (
            <div className="space-y-4 max-w-xl mx-auto">
              
              {/* Header: Company Title (Right) + Movement # / Date Box (Left) */}
              <div className="flex items-start justify-between gap-4">
                
                {/* Right: Company Name & System */}
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight leading-tight">
                    {storeName || 'Ahmed And Hamdy'}
                  </h1>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                    النظام المحاسبي الداخلي — حركة مالية
                  </p>
                </div>

                {/* Left: Box with Movement Number & Execution Date */}
                <div className="border border-slate-300 rounded-md text-[11px] font-mono-num divide-y divide-slate-200 min-w-[190px] text-right">
                  <div className="p-1.5 flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">رقم الحركة:</span>
                    <span className="font-black text-black">#{payment.receiptNumber || '0742'}</span>
                  </div>
                  <div className="p-1.5 flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">تاريخ ووقت التنفيذ:</span>
                    <span className="font-bold text-black text-[10px]">
                      {getFormattedDateTime(payment.date)}
                    </span>
                  </div>
                </div>

              </div>

              {/* Solid Horizontal Divider Line */}
              <div className="border-b-2 border-black my-2"></div>

              {/* Sub-Header: Badge "حركة مالية" */}
              <div>
                <span className="border border-slate-800 px-3 py-0.5 rounded text-[11px] font-bold text-black">
                  حركة مالية
                </span>
              </div>

              {/* Merchant Name Box */}
              <div className="border-b border-slate-200 pb-2">
                <span className="text-[10px] text-slate-500 block mb-0.5">اسم التاجر</span>
                <div className="text-base sm:text-lg font-black text-black">
                  {payment.merchantName}
                </div>
              </div>

              {/* Movement Details Banner (Matching Screenshot) */}
              <div className="border-b border-slate-200 pb-3 space-y-1">
                <span className="text-[11px] text-slate-700 font-bold block">دفعة من التاجر</span>
                <div className="text-xs sm:text-sm font-bold text-black">
                  دفعة بقيمة <span className="font-black font-mono-num">{formatCurrency(payment.amount, currency)}</span> — {payment.paymentMethod} {payment.notes ? `(${payment.notes})` : ''}
                </div>
              </div>

              {/* Account Balance Before and After Box (Exact Match to Screenshot) */}
              <div className="border border-slate-300 rounded-md overflow-hidden text-xs">
                <div className="grid grid-cols-2 divide-x divide-x-reverse divide-slate-300 p-2 font-mono-num text-center">
                  
                  {/* Right Column: Balance Before Movement */}
                  <div className="px-2">
                    <span className="text-[10px] text-slate-500 font-sans block mb-1">الرصيد قبل الحركة</span>
                    <span className="font-bold text-black text-sm">
                      {formatCurrency(paymentPrevDebt, currency)}
                    </span>
                  </div>

                  {/* Left Column: Balance After Movement */}
                  <div className="px-2">
                    <span className="text-[10px] text-slate-500 font-sans block mb-1">الرصيد بعد الحركة</span>
                    <span className="font-black text-black text-sm">
                      {formatCurrency(paymentNewDebt, currency)}
                    </span>
                  </div>

                </div>

                {/* Sub-footer inside box */}
                <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-200 text-center text-[11px] font-bold text-black">
                  <span>وضع الحساب بعد الحركة: </span>
                  {paymentNewDebt > 0 ? (
                    <span className="font-black text-rose-700 font-mono-num">
                      متبقي على التاجر {formatCurrency(paymentNewDebt, currency)}
                    </span>
                  ) : (
                    <span className="font-black text-emerald-700">
                      حساب التاجر مسدد وخالص بالكامل
                    </span>
                  )}
                </div>
              </div>

              {/* Tiny Sub-label & Signatures */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2">
                <div>دفعة من التاجر</div>
                <div className="font-mono-num">
                  تمت معاينة المستند: {getFormattedDateTime(payment.date)}
                </div>
              </div>

              {/* Footer signature line */}
              <div className="pt-6 mt-4 border-t border-dashed border-slate-300 flex justify-between text-[10px] text-slate-500">
                <div>توقيع المستلم: .......................................</div>
                <div>توقيع التاجر / المسدد: .......................................</div>
              </div>

              <div className="text-[9px] text-slate-400 font-mono-num text-right">
                {payment.receiptNumber || '0742'}
              </div>

            </div>
          )}

        </div>

        {/* Modal Bottom Close Button (Hidden when printing) */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center print:hidden shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {invoice ? `فاتورة #${invoice.invoiceNumber}` : `حركة #${payment?.receiptNumber || '0742'}`}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
          >
            إغلاق
          </button>
        </div>

      </div>

      {/* ========================================================= */}
      {/* USER REQUESTED: WHATSAPP SCREENSHOT & RECIPIENT PERSON MODAL */}
      {/* ========================================================= */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col justify-between overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    مشاركة سكرين الفاتورة عبر الواتساب
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    تم التقاط صورة طبق الأصل للفاتورة وجاهزة للإرسال
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3.5 text-xs">
              
              {/* Recipient Person Selection */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                    <User className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>تحديد الشخص / التاجر المستلم:</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {merchants.length} تاجر مسجل
                  </span>
                </div>

                {/* Merchant Selector */}
                <select
                  value={selectedMerchantId}
                  onChange={(e) => handleRecipientChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  {merchants.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.phone ? `(${m.phone})` : '— بدون هاتف مسجل'}
                    </option>
                  ))}
                </select>

                {/* WhatsApp Phone Number Input */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                    <span>رقم واتساب المستلم (مصر):</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      dir="ltr"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      placeholder="01xxxxxxxxx"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono-num text-right focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    يمكنك إبقاء الرقم فارغاً لاختيار أي محادثة أو جروب يدوياً داخل الواتساب.
                  </p>
                </div>
              </div>

              {/* Live Thumbnail Preview of the Screenshot */}
              {capturedImageDataUrl && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    معاينة السكرين المُلتقط للفاتورة:
                  </span>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 p-2 max-h-48 overflow-y-auto flex justify-center">
                    <img 
                      src={capturedImageDataUrl} 
                      alt="معاينة سكرين الفاتورة" 
                      className="w-full max-w-sm rounded shadow-xs object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Note: Screenshot Only */}
              <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                <Sparkles className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>يتم إرسال سكرين شوت الفاتورة مباشرة كصورة نقية وعالية الجودة بدون أي نصوص ورسائل.</span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                {/* 1. Direct Share via Web Share (Image only) */}
                <button
                  onClick={handleNativeShareImage}
                  className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98"
                >
                  <Send className="w-4 h-4" />
                  <span>مشاركة سكرين الفاتورة عبر الواتساب (صورة فقط) 📱</span>
                </button>

                {/* 2. Direct Chat with copy & download */}
                <button
                  onClick={handleFallbackWhatsAppChat}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 border border-emerald-200 dark:border-emerald-800 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  <span>فتح محادثة واتساب التاجر ولصق الصورة 💬</span>
                </button>

                {/* 3. Download Image button */}
                <button
                  onClick={handleDownloadImage}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>حفظ صورة الفاتورة في المعرض / الأستوديو 📥</span>
                </button>
              </div>

            </div>

            {/* Bottom Close */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
