import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { Invoice, Payment, WorkOrder, Expense, MerchantStatementPrintData } from '../types';
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
  order?: WorkOrder | null;
  expense?: Expense | null;
  merchantStatement?: MerchantStatementPrintData | null;
  currency?: string;
  onClose: () => void;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  invoice,
  payment,
  order,
  expense,
  merchantStatement,
  onClose,
}) => {
  const { merchantBalances, storeName, currency, merchants, invoices, showToast } = useApp();

  // Resolve effective full sales invoice to print
  // If an invoice is passed directly, use it.
  // If a work order is passed, find its linked sales invoice, or synthesize a full sales invoice from it so the user ALWAYS gets the full commercial layout (Image 1) and never the simplified prep voucher (Image 2).
  const effectiveInvoice = useMemo<Invoice | null>(() => {
    if (invoice) return invoice;
    if (order) {
      const linked = invoices?.find(i => i.orderId === order.id || (i.notes && i.notes.includes(order.orderNumber)));
      if (linked) return linked;

      const itemsToUse = order.items.map(it => {
        const qty = it.quantityDelivered > 0 ? it.quantityDelivered : it.quantityOrdered;
        return {
          id: it.id,
          productId: it.productId,
          productName: it.productName,
          quantity: qty,
          unitPrice: it.unitPrice,
          total: qty * it.unitPrice,
        };
      });
      const totalVal = itemsToUse.reduce((sum, it) => sum + it.total, 0) || order.totalEstimatedAmount;

      return {
        id: `synth_${order.id}`,
        invoiceNumber: order.orderNumber.startsWith('طلب') ? order.orderNumber.replace('طلب', 'فاتورة') : order.orderNumber,
        merchantId: order.merchantId,
        merchantName: order.merchantName,
        date: order.date,
        monthKey: order.monthKey,
        items: itemsToUse,
        subtotal: totalVal,
        discountType: 'amount',
        discountValue: 0,
        discount: 0,
        total: totalVal,
        paidAmount: 0,
        remainingAmount: totalVal,
        notes: order.notes ? `طلب شغل #${order.orderNumber}: ${order.notes}` : `تسليم من طلب الشغل #${order.orderNumber}`,
        orderId: order.id,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };
    }
    return null;
  }, [invoice, order, invoices]);

  // Screenshot & Sharing States
  const [isCapturing, setIsCapturing] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [capturedImageDataUrl, setCapturedImageDataUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>(
    merchantStatement?.merchant.id || effectiveInvoice?.merchantId || payment?.merchantId || (merchants[0]?.id || '')
  );
  const [customPhone, setCustomPhone] = useState<string>(() => {
    const targetId = merchantStatement?.merchant.id || effectiveInvoice?.merchantId || payment?.merchantId;
    const m = merchants.find(item => item.id === targetId);
    return merchantStatement?.merchant.phone || m?.phone || '';
  });

  if (!effectiveInvoice && !payment && !expense && !merchantStatement) return null;

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
  let invoicePaymentBadgeClass = '';

  if (effectiveInvoice) {
    const mBal = merchantBalances[effectiveInvoice.merchantId];
    const currentDebt = mBal ? Math.max(0, mBal.currentDebt) : effectiveInvoice.remainingAmount;
    invoicePrevDebt = Math.max(0, currentDebt - effectiveInvoice.remainingAmount);
    invoiceNewTotalDebt = invoicePrevDebt + effectiveInvoice.remainingAmount;

    if (effectiveInvoice.remainingAmount <= 0) {
      invoicePaymentStatusText = 'كاش (مسددة بالكامل فوري)';
      invoicePaymentBadgeClass = 'text-emerald-700 bg-emerald-50 border-emerald-300';
    } else if (effectiveInvoice.paidAmount > 0) {
      invoicePaymentStatusText = `سداد جزئي (مدفوع ${formatCurrency(effectiveInvoice.paidAmount, currency)} والباقي دين)`;
      invoicePaymentBadgeClass = 'text-amber-800 bg-amber-50 border-amber-300';
    } else {
      invoicePaymentStatusText = 'دين آجل (على الحساب بالكامل)';
      invoicePaymentBadgeClass = 'text-rose-700 bg-rose-50 border-rose-300';
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
    if (effectiveInvoice) {
      return `*${storeName || 'Ahmed And Hamdy'}*
*بيان بيع بضاعة — فاتورة رقم: #${effectiveInvoice.invoiceNumber}*
----------------------------------------
👤 *التاجر/العميل:* ${effectiveInvoice.merchantName}
📅 *تاريخ الفاتورة:* ${formatDateArabic(effectiveInvoice.date)}
💳 *حالة الدفع:* *${invoicePaymentStatusText}*
📦 *الأصناف المباعة:*
${effectiveInvoice.items.map(it => `• ${it.productName} (${it.quantity} قطعة) × ${formatCurrency(it.unitPrice, currency)} = ${formatCurrency(it.total, currency)}`).join('\n')}
----------------------------------------
💰 *المجموع الفرعي:* ${formatCurrency(effectiveInvoice.subtotal, currency)}
${effectiveInvoice.discount > 0 ? `🏷️ *الخصم الممنوح:* -${formatCurrency(effectiveInvoice.discount, currency)}\n` : ''}💵 *إجمالي قيمة الفاتورة:* ${formatCurrency(effectiveInvoice.total, currency)}
${effectiveInvoice.paidAmount > 0 ? `✅ *المسدد كاش فوري:* ${formatCurrency(effectiveInvoice.paidAmount, currency)}\n` : ''}${effectiveInvoice.remainingAmount > 0 ? `⏳ *المتبقي دين من الفاتورة:* ${formatCurrency(effectiveInvoice.remainingAmount, currency)}\n` : ''}----------------------------------------
📊 *كشف حساب التاجر (قبل وبعد الفاتورة):*
• الحساب القديم قبل الفاتورة: ${formatCurrency(invoicePrevDebt, currency)}
• قيمة الفاتورة الحالية: ${formatCurrency(effectiveInvoice.total, currency)}
${effectiveInvoice.paidAmount > 0 ? `• المدفوع كاش: ${formatCurrency(effectiveInvoice.paidAmount, currency)}\n` : ''}• إجمالي الحساب المطلوب بعد الفاتورة: *${formatCurrency(invoiceNewTotalDebt, currency)}*
${invoiceNewTotalDebt > 0 ? `👉 *المطلوب سداده بعد الفاتورة:* ${formatCurrency(invoiceNewTotalDebt, currency)}` : '🎉 *حسابك خالص ومسدد بالكامل بدون أي ديون*'}

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
    } else if (merchantStatement) {
      const m = merchantStatement.merchant;
      const b = merchantStatement.balances;
      return `*${storeName || 'Ahmed And Hamdy'}*
*كشف حساب تاجر معتمد — ${m.name}*
----------------------------------------
👤 *التاجر:* ${m.name}
📱 *الهاتف:* ${m.phone || 'غير مسجل'}
📅 *تاريخ التقرير:* ${formatDateArabic(merchantStatement.generatedAt || new Date().toISOString())}
----------------------------------------
📊 *ملخص الحساب المالي:*
• إجمالي المسحوبات (فواتير): ${formatCurrency(b.totalInvoicedAllTime, currency)} (${merchantStatement.invoices.length} فاتورة)
• إجمالي المسدد (دفعات): ${formatCurrency(b.totalPaidAllTime, currency)} (${merchantStatement.payments.length} سند قبض)
• *صافي المديونية الحالية:* *${formatCurrency(b.currentDebt, currency)}*
----------------------------------------
📦 *سجل فواتير البيع:*
${merchantStatement.invoices.length === 0 ? '• لا توجد فواتير' : merchantStatement.invoices.slice(0, 10).map(inv => `• فاتورة #${inv.invoiceNumber} (${inv.date}): ${formatCurrency(inv.total, currency)}`).join('\n')}
${merchantStatement.invoices.length > 10 ? `... وغيرها (${merchantStatement.invoices.length} فاتورة إجمالاً)` : ''}
----------------------------------------
💵 *سجل الدفعات المستلمة:*
${merchantStatement.payments.length === 0 ? '• لا توجد دفعات' : merchantStatement.payments.slice(0, 10).map(p => `• دفعة #${p.receiptNumber || '0742'} (${p.date}): ${formatCurrency(p.amount, currency)} [${p.paymentMethod}]`).join('\n')}
${merchantStatement.payments.length > 10 ? `... وغيرها (${merchantStatement.payments.length} دفعة إجمالاً)` : ''}
----------------------------------------
${b.currentDebt > 0 ? `👉 *المتبقي المطلوب سداده:* ${formatCurrency(b.currentDebt, currency)}` : '🎉 *الحساب مسدد وخالص بالكامل*'}

شاكرين لسيادتكم دوام التعاون وسرعة السداد 🙏`;
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

  // 1. Capture screen from invoice element using html-to-image (Complete 100% Full Width & Height without ANY cutoffs)
  const handleCaptureAndOpenShare = async () => {
    const el = document.getElementById('printable-voucher');
    if (!el) return;

    setIsCapturing(true);
    let captureContainer: HTMLDivElement | null = null;
    try {
      // Standard commercial voucher width (560px) - ideal proportion for mobile & WhatsApp receipts
      const captureWidth = 560;

      // Create an offscreen staging container in the real DOM so styles & fonts compute at exactly 560px
      captureContainer = document.createElement('div');
      captureContainer.style.position = 'fixed';
      captureContainer.style.left = '-9999px';
      captureContainer.style.top = '0';
      captureContainer.style.width = `${captureWidth}px`;
      captureContainer.style.zIndex = '-9999';
      captureContainer.style.backgroundColor = '#ffffff';
      captureContainer.dir = 'rtl';

      // Clone the voucher element and force 100% full width and unconstrained height
      const clone = el.cloneNode(true) as HTMLElement;
      clone.id = 'printable-voucher-capture-clone';
      clone.style.width = `${captureWidth}px`;
      clone.style.maxWidth = `${captureWidth}px`;
      clone.style.minWidth = `${captureWidth}px`;
      clone.style.height = 'auto';
      clone.style.maxHeight = 'none';
      clone.style.overflow = 'visible';
      clone.style.margin = '0';
      clone.style.padding = '20px';
      clone.style.boxSizing = 'border-box';
      clone.style.backgroundColor = '#ffffff';
      clone.style.borderRadius = '0';
      clone.style.border = 'none';
      clone.style.boxShadow = 'none';

      captureContainer.appendChild(clone);
      document.body.appendChild(captureContainer);

      // Wait a tick for browser layout engine to calculate exact geometry at 560px
      await new Promise(resolve => setTimeout(resolve, 50));

      // Calculate exact rendered height of the clone at 560px width
      const measuredHeight = Math.ceil(Math.max(clone.scrollHeight, clone.offsetHeight)) + 6;

      // Capture the 560px clone DIRECTLY — ensures 100% full-width coverage and zero blank margins
      const dataUrl = await toPng(clone, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2.5,
        skipFonts: true,
        fontEmbedCSS: '',
        width: captureWidth,
        height: measuredHeight,
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
      if (captureContainer && captureContainer.parentNode) {
        captureContainer.parentNode.removeChild(captureContainer);
      }
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
    const docNumber = invoice ? invoice.invoiceNumber : payment ? (payment.receiptNumber || '0742') : order ? order.orderNumber : (expense ? `صرف-${expense.id.slice(-4)}` : '001');
    const fileName = `مستند-${docNumber}.png`;
    const file = new File([capturedBlob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `مستند ${invoice?.merchantName || payment?.merchantName || order?.merchantName || expense?.title || ''}`,
        });
        showToast('تمت مشاركة صورة المستند بنجاح عبر الواتساب');
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

    showToast('تم حفظ صورة المستند في جهازك وفتح محادثة الواتساب مع التاجر 📸');
  };

  // 4. Download Image directly
  const handleDownloadImage = () => {
    if (!capturedImageDataUrl) return;
    const docNumber = invoice ? invoice.invoiceNumber : payment ? (payment.receiptNumber || '0742') : order ? order.orderNumber : (expense ? `صرف-${expense.id.slice(-4)}` : '001');
    const link = document.createElement('a');
    link.href = capturedImageDataUrl;
    link.download = `مستند_${docNumber}.png`;
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

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-1.5 sm:p-4 print:overflow-visible print:p-0">
          {/* Printable Voucher Sheet — Pure White Print Spooler Replica (Unconstrained Full Height) */}
          <div 
            id="printable-voucher" 
            className="p-4 sm:p-6 bg-white text-black font-sans print:p-0 border border-slate-200 rounded-2xl shadow-xs print:border-none print:shadow-none w-full max-w-2xl mx-auto"
            dir="rtl"
          >
          
          {/* ==================== 1. SALES INVOICE VIEW ==================== */}
          {effectiveInvoice && (
            <div className="space-y-3.5 w-full">
              
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
                    <span className="font-black text-black">#{effectiveInvoice.invoiceNumber}</span>
                  </div>
                  <div className="p-1.5 flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">تاريخ الحركة:</span>
                    <span className="font-bold text-black text-[10px]">
                      {getFormattedDateTime(effectiveInvoice.date)}
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
                  {effectiveInvoice.items.length} أصناف مباعة
                </span>
              </div>

              {/* USER REQUESTED: Two-Box Grid with "حالة الدفع" replacing "المخزن المصدر" */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                
                {/* Right Box: Invoice To (Merchant) */}
                <div className="border border-slate-300 rounded-md p-2 flex flex-col justify-between min-h-[64px]">
                  <span className="text-[10px] text-slate-500">الفاتورة إلى:</span>
                  <div className="text-sm sm:text-base font-black text-black break-words my-0.5">
                    {effectiveInvoice.merchantName}
                  </div>
                  <span className="text-[10px] text-slate-500">التاجر / العميل</span>
                </div>

                {/* Left Box: Payment Status (Replaces Warehouse as explicitly requested) */}
                <div className="border border-slate-300 rounded-md p-2 flex flex-col justify-between min-h-[64px]">
                  <span className="text-[10px] text-slate-500">حالة الدفع:</span>
                  <div className={`text-xs sm:text-sm font-black break-words my-0.5 ${
                    effectiveInvoice.remainingAmount <= 0 
                      ? 'text-emerald-700' 
                      : effectiveInvoice.paidAmount > 0 
                      ? 'text-teal-700' 
                      : 'text-rose-700'
                  }`}>
                    {invoicePaymentStatusText}
                  </div>
                  <span className="text-[10px] text-slate-500 break-words leading-tight">
                    {effectiveInvoice.remainingAmount <= 0 
                      ? 'مسددة بالكامل كاش فوري' 
                      : effectiveInvoice.paidAmount > 0 
                      ? `مسدد ${formatCurrency(effectiveInvoice.paidAmount, currency)} • باقي ${formatCurrency(effectiveInvoice.remainingAmount, currency)}` 
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
                    {effectiveInvoice.items.map((it, idx) => (
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
                        {formatCurrency(effectiveInvoice.subtotal, currency)}
                      </td>
                    </tr>

                    {/* Discount (if applicable) */}
                    {effectiveInvoice.discount > 0 && (
                      <tr className="bg-amber-50/30 text-xs">
                        <td colSpan={3} className="py-1 px-2 font-bold text-amber-900 text-right border-l border-slate-200">
                          الخصم الممنوح
                        </td>
                        <td className="py-1 px-2 text-left font-bold text-amber-900 font-mono-num">
                          -{formatCurrency(effectiveInvoice.discount, currency)}
                        </td>
                      </tr>
                    )}

                    {/* Grand Total */}
                    <tr className="bg-slate-100 border-t-2 border-slate-300 text-xs">
                      <td colSpan={3} className="py-1.5 px-2 font-black text-black text-right border-l border-slate-200">
                        الإجمالي الصافي
                      </td>
                      <td className="py-1.5 px-2 text-left font-black text-black font-mono-num text-sm">
                        {formatCurrency(effectiveInvoice.total, currency)}
                      </td>
                    </tr>

                    {/* If Paid upfront */}
                    {effectiveInvoice.paidAmount > 0 && (
                      <tr className="bg-teal-50/40 text-xs">
                        <td colSpan={3} className="py-1 px-2 font-bold text-teal-800 text-right border-l border-slate-200">
                          المدفوع كاش فوري
                        </td>
                        <td className="py-1 px-2 text-left font-bold text-teal-800 font-mono-num">
                          {formatCurrency(effectiveInvoice.paidAmount, currency)}
                        </td>
                      </tr>
                    )}

                    {/* If Remaining Debt */}
                    {effectiveInvoice.remainingAmount > 0 && (
                      <tr className="bg-rose-50/40 text-xs">
                        <td colSpan={3} className="py-1 px-2 font-black text-rose-700 text-right border-l border-slate-200">
                          الباقي دين على الحساب
                        </td>
                        <td className="py-1 px-2 text-left font-black text-rose-700 font-mono-num">
                          {formatCurrency(effectiveInvoice.remainingAmount, currency)}
                        </td>
                      </tr>
                    )}

                  </tbody>
                </table>
              </div>

              {/* Merchant Account Summary Card: Before and After Balance */}
              <div className="border border-slate-300 rounded-md overflow-hidden text-xs">
                {/* Header */}
                <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 font-bold text-black flex justify-between items-center text-[11px]">
                  <span>ملخص حساب التاجر (قبل وبعد الفاتورة)</span>
                  <span className="text-[10px] text-slate-600 font-bold">{effectiveInvoice.merchantName}</span>
                </div>

                {/* 4 Informative Metrics: Previous Debt, Invoice Total, Cash Paid, Total Debt After */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-x-reverse divide-slate-300 p-2 font-mono-num text-center gap-y-2">
                  <div className="px-1.5">
                    <span className="text-[10px] text-slate-500 font-sans block mb-0.5">الحساب السابق</span>
                    <span className="font-bold text-slate-800 text-xs sm:text-sm">
                      {formatCurrency(invoicePrevDebt, currency)}
                    </span>
                  </div>

                  <div className="px-1.5">
                    <span className="text-[10px] text-slate-500 font-sans block mb-0.5">قيمة الفاتورة</span>
                    <span className="font-bold text-blue-800 text-xs sm:text-sm">
                      {formatCurrency(effectiveInvoice.total, currency)}
                    </span>
                  </div>

                  <div className="px-1.5">
                    <span className="text-[10px] text-slate-500 font-sans block mb-0.5">المسدد كاش فوري</span>
                    <span className="font-bold text-emerald-700 text-xs sm:text-sm">
                      {formatCurrency(effectiveInvoice.paidAmount, currency)}
                    </span>
                  </div>

                  <div className="px-1.5 bg-slate-50 rounded">
                    <span className="text-[10px] text-slate-700 font-sans font-bold block mb-0.5">الحساب بعد الفاتورة</span>
                    <span className="font-black text-black text-xs sm:text-sm">
                      {formatCurrency(invoiceNewTotalDebt, currency)}
                    </span>
                  </div>
                </div>

                {/* Sub-footer inside box: Status of account after operation */}
                <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-200 text-center text-[11px] font-bold text-black">
                  <span>وضع الحساب بعد الفاتورة ({invoicePaymentStatusText}): </span>
                  {invoiceNewTotalDebt > 0 ? (
                    <span className="font-black text-rose-700 font-mono-num">
                      على التاجر سداد {formatCurrency(invoiceNewTotalDebt, currency)}
                    </span>
                  ) : (
                    <span className="font-black text-emerald-700">
                      حساب التاجر خالص ومسدد تماماً ولا يوجد عليه أي دين
                    </span>
                  )}
                </div>
              </div>

              {/* Notes */}
              {effectiveInvoice.notes && (
                <div className="p-2 border border-dashed border-slate-300 rounded-md text-[10px] text-slate-600">
                  <span className="font-bold">ملاحظات الفاتورة: </span>
                  <span>{effectiveInvoice.notes}</span>
                </div>
              )}

              {/* Printable Footer with Signature & Timestamp */}
              <div className="pt-4 border-t border-dashed border-slate-300 flex items-center justify-between text-[10px] text-slate-500">
                <div>التوقيع والختم: .......................................</div>
                <div className="font-mono-num">
                  تمت معاينة المستند: {getFormattedDateTime(effectiveInvoice.date)}
                </div>
              </div>

              <div className="text-[9px] text-slate-400 font-mono-num text-right">
                {effectiveInvoice.invoiceNumber}
              </div>

            </div>
          )}

          {/* ==================== 2. PAYMENT / VOUCHER VIEW ==================== */}
          {payment && (
            <div className="space-y-4 w-full">
              
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



          {/* ==================== 4. EXPENSE VIEW ==================== */}
          {expense && (
            <div className="space-y-4 w-full">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight leading-tight">
                    {storeName || 'Ahmed And Hamdy'}
                  </h1>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                    النظام المحاسبي الداخلي — إذن صرف ومسحوبات
                  </p>
                </div>

                <div className="border border-slate-300 rounded-md text-[11px] font-mono-num divide-y divide-slate-200 min-w-[190px] text-right">
                  <div className="p-1.5 flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">رقم الإذن:</span>
                    <span className="font-black text-black">#صرف-{expense.id.slice(-4)}</span>
                  </div>
                  <div className="p-1.5 flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">تاريخ الصرف:</span>
                    <span className="font-bold text-black text-[10px]">
                      {getFormattedDateTime(expense.date)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-b-2 border-black my-2"></div>

              <div className="flex items-center justify-between text-xs">
                <span className="border border-amber-800 bg-amber-50 text-amber-900 px-3 py-0.5 rounded text-[11px] font-bold">
                  إذن صرف نقدية / مسحوبات
                </span>
                <span className="text-[10px] text-slate-500">
                  تصنيف: {expense.category}
                </span>
              </div>

              <div className="border border-slate-300 rounded-md p-4 bg-amber-50/20 text-center">
                <span className="text-xs text-slate-500 block mb-1">المبلغ المنصرف / المسحوب</span>
                <div className="text-2xl sm:text-3xl font-black text-amber-700 font-mono-num">
                  {formatCurrency(expense.amount, currency)}
                </div>
                <span className="text-xs font-bold text-slate-700 mt-2 block">
                  البيان: {expense.title} ({expense.category})
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  طريقة السحب: {expense.paymentMethod}
                </span>
              </div>

              {expense.notes && (
                <div className="p-2 border border-dashed border-slate-300 rounded-md text-[10px] text-slate-600">
                  <span className="font-bold">ملاحظات الصرف: </span>
                  <span>{expense.notes}</span>
                </div>
              )}

              <div className="pt-4 border-t border-dashed border-slate-300 flex items-center justify-between text-[10px] text-slate-500">
                <div>توقيع المستلم: .......................................</div>
                <div>توقيع أمين الصندوق: .......................................</div>
              </div>

              <div className="text-[9px] text-slate-400 font-mono-num text-right">
                #صرف-{expense.id.slice(-4)}
              </div>
            </div>
          )}

          {/* ==================== 5. MERCHANT ACCOUNT STATEMENT VIEW ==================== */}
          {merchantStatement && (
            <div className="space-y-4 w-full">
              {/* Header: Company Title (Right) + Statement Reference Box (Left) */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight leading-tight">
                    {storeName || 'Ahmed And Hamdy'}
                  </h1>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                    النظام المحاسبي الداخلي — كشف حساب تاجر تفصيلي
                  </p>
                </div>

                <div className="border border-slate-300 rounded-md text-[11px] font-mono-num divide-y divide-slate-200 min-w-[200px] text-right">
                  <div className="p-1.5 flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">كود المستند:</span>
                    <span className="font-black text-black">#كشف-{merchantStatement.merchant.id.slice(0, 6)}</span>
                  </div>
                  <div className="p-1.5 flex justify-between gap-2">
                    <span className="text-slate-500 font-sans">تاريخ التقرير:</span>
                    <span className="font-bold text-black text-[10px]">
                      {getFormattedDateTime(merchantStatement.generatedAt || new Date().toISOString())}
                    </span>
                  </div>
                </div>
              </div>

              {/* Solid Horizontal Divider Line */}
              <div className="border-b-2 border-black my-2"></div>

              {/* Merchant Details Card */}
              <div className="grid grid-cols-2 gap-3 border border-slate-300 rounded-md p-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5">كشف حساب العميل / التاجر:</span>
                  <div className="text-base font-black text-black">{merchantStatement.merchant.name}</div>
                  {merchantStatement.merchant.address && (
                    <div className="text-[11px] text-slate-600 mt-0.5">العنوان: {merchantStatement.merchant.address}</div>
                  )}
                </div>
                <div className="text-left font-mono-num">
                  <span className="text-[10px] text-slate-500 block mb-0.5 font-sans">بيانات الاتصال:</span>
                  <div className="font-bold text-black text-xs">{merchantStatement.merchant.phone || 'بدون هاتف'}</div>
                  <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                    حالة الحساب: {merchantStatement.balances.currentDebt > 0 ? 'عليه مديونية قائمة' : 'خالص السداد'}
                  </div>
                </div>
              </div>

              {/* Financial Balances Summary Bar */}
              <div className="grid grid-cols-3 border border-slate-300 rounded-md overflow-hidden text-center text-xs divide-x divide-x-reverse divide-slate-300">
                <div className="p-2 bg-slate-50/70">
                  <span className="text-[10px] text-slate-600 block mb-0.5 font-bold">إجمالي المسحوبات (فواتير)</span>
                  <span className="font-black font-mono-num text-slate-900 text-sm">
                    {formatCurrency(merchantStatement.balances.totalInvoicedAllTime, currency)}
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-0.5 font-mono-num">
                    ({merchantStatement.invoices.length} فاتورة بيع)
                  </span>
                </div>
                <div className="p-2 bg-slate-50/70">
                  <span className="text-[10px] text-teal-800 block mb-0.5 font-bold">إجمالي المسدد (دفعات)</span>
                  <span className="font-black font-mono-num text-teal-700 text-sm">
                    {formatCurrency(merchantStatement.balances.totalPaidAllTime, currency)}
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-0.5 font-mono-num">
                    ({merchantStatement.payments.length} سند قبض)
                  </span>
                </div>
                <div className="p-2 bg-rose-50/40">
                  <span className="text-[10px] text-rose-700 block mb-0.5 font-bold">صافي المديونية الحالية</span>
                  <span className={`font-black font-mono-num text-sm ${merchantStatement.balances.currentDebt > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {formatCurrency(merchantStatement.balances.currentDebt, currency)}
                  </span>
                  <span className="text-[9px] text-rose-600 block mt-0.5 font-bold">
                    {merchantStatement.balances.currentDebt > 0 ? 'مطلوب سداده' : 'خالص تماماً'}
                  </span>
                </div>
              </div>

              {/* SECTION 1: Independent Sales Invoices Table */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-black flex items-center gap-1.5">
                    <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded text-[10px] font-bold">قسم ١</span>
                    <span>سجل عمليات البيع والفواتير ({merchantStatement.invoices.length})</span>
                  </span>
                  <span className="font-mono-num text-[11px] text-slate-600 font-bold">
                    إجمالي الفواتير: {formatCurrency(merchantStatement.balances.totalInvoicedAllTime, currency)}
                  </span>
                </div>

                <div className="border border-slate-300 rounded-md overflow-hidden">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-bold text-black">
                        <th className="py-1 px-2 border-l border-slate-200">رقم الفاتورة</th>
                        <th className="py-1 px-2 border-l border-slate-200">التاريخ</th>
                        <th className="py-1 px-2 border-l border-slate-200">الأصناف / البيان</th>
                        <th className="py-1 px-2 border-l border-slate-200 text-center">المسدد فوري</th>
                        <th className="py-1 px-2 border-l border-slate-200 text-center">المتبقي دين</th>
                        <th className="py-1 px-2 text-left font-black">إجمالي الفاتورة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono-num text-[11px]">
                      {merchantStatement.invoices.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-3 text-center text-slate-400 font-sans">
                            لا توجد فواتير بيع مسجلة لهذا التاجر
                          </td>
                        </tr>
                      ) : (
                        merchantStatement.invoices.map((inv, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-1.5 px-2 font-bold text-black border-l border-slate-200">
                              #{inv.invoiceNumber}
                            </td>
                            <td className="py-1.5 px-2 border-l border-slate-200 text-slate-700">
                              {inv.date}
                            </td>
                            <td className="py-1.5 px-2 border-l border-slate-200 font-sans text-[10px] text-slate-700 max-w-[160px] truncate">
                              {inv.items.map(it => `${it.productName} (${it.quantity})`).join(', ') || inv.notes || '—'}
                            </td>
                            <td className="py-1.5 px-2 border-l border-slate-200 text-center text-teal-700">
                              {inv.paidAmount > 0 ? formatCurrency(inv.paidAmount, currency) : '0'}
                            </td>
                            <td className="py-1.5 px-2 border-l border-slate-200 text-center text-rose-700 font-bold">
                              {inv.remainingAmount > 0 ? formatCurrency(inv.remainingAmount, currency) : '0'}
                            </td>
                            <td className="py-1.5 px-2 text-left font-black text-black">
                              {formatCurrency(inv.total, currency)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 2: Independent Financial Collections Table */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-black flex items-center gap-1.5">
                    <span className="bg-teal-100 text-teal-900 px-2 py-0.5 rounded text-[10px] font-bold">قسم ٢</span>
                    <span>سجل العمليات المالية وسندات القبض ({merchantStatement.payments.length})</span>
                  </span>
                  <span className="font-mono-num text-[11px] text-teal-800 font-bold">
                    إجمالي المسدد: {formatCurrency(merchantStatement.balances.totalPaidAllTime, currency)}
                  </span>
                </div>

                <div className="border border-slate-300 rounded-md overflow-hidden">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-bold text-black">
                        <th className="py-1 px-2 border-l border-slate-200">رقم الحركة</th>
                        <th className="py-1 px-2 border-l border-slate-200">التاريخ</th>
                        <th className="py-1 px-2 border-l border-slate-200">طريقة الدفع</th>
                        <th className="py-1 px-2 border-l border-slate-200">البيان / ملاحظات</th>
                        <th className="py-1 px-2 text-left font-black">المبلغ المقبوض</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono-num text-[11px]">
                      {merchantStatement.payments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-3 text-center text-slate-400 font-sans">
                            لا توجد سندات دفعات مسجلة لهذا التاجر
                          </td>
                        </tr>
                      ) : (
                        merchantStatement.payments.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-1.5 px-2 font-bold text-black border-l border-slate-200">
                              #{p.receiptNumber || '0742'}
                            </td>
                            <td className="py-1.5 px-2 border-l border-slate-200 text-slate-700">
                              {p.date}
                            </td>
                            <td className="py-1.5 px-2 border-l border-slate-200 font-sans text-[10px] text-teal-800 font-bold">
                              {p.paymentMethod}
                            </td>
                            <td className="py-1.5 px-2 border-l border-slate-200 font-sans text-[10px] text-slate-600 max-w-[180px] truncate">
                              {p.notes || 'دفعة نقدية مسددة للحساب'}
                            </td>
                            <td className="py-1.5 px-2 text-left font-black text-teal-700">
                              {formatCurrency(p.amount, currency)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Status Banner */}
              <div className="bg-slate-100 p-2.5 rounded-md border border-slate-300 text-center text-xs font-bold">
                <span>الموقف المالي النهائي للحساب: </span>
                {merchantStatement.balances.currentDebt > 0 ? (
                  <span className="text-rose-700 font-black font-mono-num">
                    صافي مديونية قائمة على التاجر بمبلغ {formatCurrency(merchantStatement.balances.currentDebt, currency)}
                  </span>
                ) : (
                  <span className="text-emerald-700 font-black">
                    حساب التاجر مسدد وخالص بالكامل ولا توجد عليه أي مديونيات
                  </span>
                )}
              </div>

              {/* Signatures */}
              <div className="pt-6 mt-3 border-t border-dashed border-slate-300 flex justify-between text-[10px] text-slate-500">
                <div>توقيع التاجر / العميل: .......................................</div>
                <div>توقيع الحسابات / المعتمد: .......................................</div>
              </div>

              <div className="text-[9px] text-slate-400 font-mono-num text-right">
                #كشف-{merchantStatement.merchant.id.slice(0, 6)}
              </div>
            </div>
          )}

          </div>
        </div>

        {/* Modal Bottom Close Button (Hidden when printing) - Lifted above mobile navigation bar */}
        <div className="pt-2.5 pb-6 sm:pb-0 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center print:hidden shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
            {merchantStatement
              ? `كشف حساب: ${merchantStatement.merchant.name}`
              : invoice 
              ? `فاتورة #${invoice.invoiceNumber}` 
              : payment 
              ? `حركة #${payment.receiptNumber || '0742'}`
              : order 
              ? `طلب شغل #${order.orderNumber}`
              : `إذن صرف #${expense?.id.slice(-4)}`}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors active:scale-95"
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
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100/80 dark:bg-slate-950 p-2 max-h-60 overflow-y-auto flex justify-center">
                    <img 
                      src={capturedImageDataUrl} 
                      alt="معاينة سكرين الفاتورة" 
                      className="w-full max-w-sm rounded-lg shadow-xs object-contain"
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

            {/* Bottom Close - Lifted above mobile navigation bar */}
            <div className="pt-2 pb-6 sm:pb-0 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs active:scale-95 transition-all"
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
