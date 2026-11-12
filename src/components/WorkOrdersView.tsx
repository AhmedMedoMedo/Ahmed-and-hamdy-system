import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { WorkOrder, OrderItem, OrderStatus, Product } from '../types';
import { 
  formatCurrency, 
  formatDateArabic, 
  getTimeAgoArabic,
  getTodayDateString, 
  generateOrderNumber,
  getMonthKeyFromDate 
} from '../utils/formatters';
import { ConfirmModal } from './ConfirmModal';
import { 
  Truck, 
  Search, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Edit3, 
  Trash2, 
  X, 
  PlusCircle, 
  Trash, 
  Minus, 
  ArrowRight,
  PackageCheck,
  Check,
  DollarSign,
  Receipt
} from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';

interface WorkOrdersViewProps {
  onOpenOrderInvoice?: (invoiceId: string) => void;
  onPrintInvoice?: (invoice: any) => void;
  onPrintOrder?: (order: WorkOrder) => void;
  onSelectMerchant?: (merchantId: string) => void;
}

export const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({
  onOpenOrderInvoice,
  onPrintInvoice,
  onPrintOrder,
  onSelectMerchant,
}) => {
  const { 
    orders, 
    merchants, 
    products, 
    invoices,
    merchantBalances,
    currency, 
    saveWorkOrder, 
    removeWorkOrder, 
    deliverWorkOrder,
    saveMerchant,
    saveProduct,
    showToast 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'delivered' | 'all'>('active');

  // Create / Edit modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);

  // Form Fields
  const [merchantId, setMerchantId] = useState('');
  const [orderDate, setOrderDate] = useState(getTodayDateString());
  const [orderNumber, setOrderNumber] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Immediate delivery option upon creation
  const [creationAction, setCreationAction] = useState<'pending' | 'deliver_debt' | 'deliver_cash' | 'deliver_partial'>('pending');
  const [creationPaidAmount, setCreationPaidAmount] = useState<string>('');

  // Inline Quick Add Merchant
  const [isQuickAddMerchantOpen, setIsQuickAddMerchantOpen] = useState(false);
  const [quickMerchantName, setQuickMerchantName] = useState('');
  const [quickMerchantPhone, setQuickMerchantPhone] = useState('');

  // Inline Quick Add Product
  const [isQuickAddProductOpen, setIsQuickAddProductOpen] = useState(false);
  const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);
  const [quickProductName, setQuickProductName] = useState('');
  const [quickProductPrice, setQuickProductPrice] = useState('');

  // Delivery Modal State
  const [deliveryModalOrder, setDeliveryModalOrder] = useState<WorkOrder | null>(null);
  const [deliveryInputs, setDeliveryInputs] = useState<Record<string, number>>({});
  const [deliveryPaymentType, setDeliveryPaymentType] = useState<'debt' | 'paid_full' | 'paid_partial'>('debt');
  const [deliveryPaidAmount, setDeliveryPaidAmount] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  // Delete modal state
  const [orderToDelete, setOrderToDelete] = useState<WorkOrder | null>(null);

  // Open Create/Edit Order
  const handleOpenForm = (existing?: WorkOrder) => {
    setFormError(null);
    setCreationAction('pending');
    setCreationPaidAmount('');
    if (existing) {
      setEditingOrder(existing);
      setMerchantId(existing.merchantId);
      setOrderDate(existing.date);
      setOrderNumber(existing.orderNumber);
      setItems(existing.items.map(it => ({ ...it })));
      setNotes(existing.notes || '');
    } else {
      setEditingOrder(null);
      setMerchantId(merchants[0]?.id || '');
      setOrderDate(getTodayDateString());
      setOrderNumber(generateOrderNumber(orders.length));
      setNotes('');

      // Prepopulate first product if available, with empty quantity ready for typing
      const firstProd = products[0];
      if (firstProd) {
        setItems([{
          id: `ord_it_${Date.now()}`,
          productId: firstProd.id || '',
          productName: firstProd.name,
          unitPrice: firstProd.price,
          quantityOrdered: 0,
          quantityDelivered: 0,
          quantityRemaining: 0,
          unit: firstProd.unit || '',
        }]);
      } else {
        setItems([{
          id: `ord_it_${Date.now()}`,
          productId: '',
          productName: '',
          unitPrice: 0,
          quantityOrdered: 0,
          quantityDelivered: 0,
          quantityRemaining: 0,
          unit: '',
        }]);
      }
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingOrder(null);
    setFormError(null);
  };

  // Add Item to Order Form
  const handleAddItem = () => {
    const firstProd = products[0];
    const newItem: OrderItem = {
      id: `ord_it_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      productId: firstProd ? (firstProd.id || '') : '',
      productName: firstProd ? firstProd.name : '',
      unitPrice: firstProd ? firstProd.price : 0,
      quantityOrdered: 0,
      quantityDelivered: 0,
      quantityRemaining: 0,
      unit: firstProd ? (firstProd.unit || '') : '',
    };
    setItems([...items, newItem]);
    setTimeout(() => {
      const newIndex = items.length; 
      const element = document.getElementById(`item-card-${newIndex}`);
      if (element) {
        // رفع العنصر لأعلى الشاشة لإفساح مجال للقائمة والكيبورد
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        setTimeout(() => {
          const productSelectBtn = element.querySelector('button[role="combobox"], button.text-right, input[type="text"]');
          if (productSelectBtn) {
            (productSelectBtn as HTMLElement).focus();
            if (productSelectBtn.tagName.toLowerCase() === 'button') {
              (productSelectBtn as HTMLElement).click();
            }
          }
        }, 50);
      }
    }, 100);
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemProductChange = (idx: number, prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;
    const next = [...items];
    const qtyOrdered = next[idx].quantityOrdered || 0;
    next[idx] = {
      ...next[idx],
      productId: prod.id,
      productName: prod.name,
      unitPrice: prod.price,
      unit: prod.unit,
      quantityOrdered: qtyOrdered,
      quantityRemaining: Math.max(0, qtyOrdered - next[idx].quantityDelivered),
    };
    setItems(next);
    setTimeout(() => {
      const qtyInput = document.getElementById(`qty-input-${idx}`) as HTMLInputElement;
      if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
      }
    }, 50);
  };

  const handleItemChange = (idx: number, field: keyof OrderItem, value: any) => {
    const next = [...items];
    const current = { ...next[idx], [field]: value };
    if (field === 'quantityOrdered') {
      const parsed = parseFloat(String(value));
      const q = isNaN(parsed) || parsed < 0 ? 0 : parsed;
      current.quantityOrdered = q;
      current.quantityRemaining = Math.max(0, q - (current.quantityDelivered || 0));
    }
    if (field === 'unitPrice') {
      const p = parseFloat(String(value));
      current.unitPrice = isNaN(p) || p < 0 ? 0 : p;
    }
    next[idx] = current;
    setItems(next);
  };

  const adjustQty = (idx: number, delta: number) => {
    const next = [...items];
    const current = next[idx];
    const newQty = Math.max(0, (current.quantityOrdered || 0) + delta);
    current.quantityOrdered = newQty;
    current.quantityRemaining = Math.max(0, newQty - (current.quantityDelivered || 0));
    setItems(next);
  };

  // Quick Add Merchant
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
    showToast('تمت إضافة واختيار التاجر');
  };

  // Quick Add Product
  const handleQuickAddProduct = async (idx: number) => {
    if (!quickProductName.trim()) return;
    try {
      const newId = await saveProduct({
        name: quickProductName.trim(),
        price: parseFloat(quickProductPrice) || 0,
        unit: 'قطعة',
        stock: 0
      });
      handleItemProductChange(idx, newId);
      setQuickProductName('');
      setQuickProductPrice('');
      setIsQuickAddProductOpen(false);
      setActiveItemIdx(null);
      showToast('تم حفظ الصنف الجديد في المخزن بنجاح');
    } catch {
      showToast('خطأ في حفظ الصنف');
    }
  };

  // Submit Order Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!merchantId) {
      setFormError('يرجى اختيار التاجر أولاً');
      return;
    }
    if (items.length === 0 || items.some(it => !it.productName.trim() || it.quantityOrdered <= 0)) {
      setFormError('يرجى ملء جميع بنود المنتجات والكميات المطلوبة');
      return;
    }

    const m = merchants.find(item => item.id === merchantId);
    const mName = m ? m.name : 'تاجر غير محدد';
    const monthKey = getMonthKeyFromDate(orderDate);

    const totalEstimatedAmount = items.reduce((sum, it) => sum + (it.quantityOrdered * it.unitPrice), 0);
    const deliveredTotalAmount = editingOrder 
      ? editingOrder.deliveredTotalAmount 
      : items.reduce((sum, it) => sum + (it.quantityDelivered * it.unitPrice), 0);

    const allDelivered = items.every(it => it.quantityRemaining === 0);
    const someDelivered = items.some(it => it.quantityDelivered > 0);
    const initialStatus: OrderStatus = allDelivered 
      ? 'delivered' 
      : someDelivered 
      ? 'partially_delivered' 
      : 'pending';

    let invoiceToPrint: any = null;

    try {
      const savedOrder = await saveWorkOrder({
        ...(editingOrder ? { id: editingOrder.id } : {}),
        orderNumber: orderNumber.trim() || generateOrderNumber(orders.length),
        merchantId,
        merchantName: mName,
        date: orderDate,
        monthKey,
        items,
        status: initialStatus,
        totalEstimatedAmount,
        deliveredTotalAmount,
        notes: notes.trim(),
      });

      if (!editingOrder && creationAction !== 'pending') {
        const pType = creationAction === 'deliver_debt' ? 'debt' : creationAction === 'deliver_cash' ? 'paid_full' : 'paid_partial';
        const pAmount = creationAction === 'deliver_partial' ? (parseFloat(creationPaidAmount) || 0) : undefined;
        const deliveryPayload = items.map(it => ({
          itemId: it.id,
          quantityToDeliver: it.quantityOrdered,
        }));

        try {
          const { invoice } = await deliverWorkOrder(
            savedOrder.id,
            deliveryPayload,
            pType,
            pAmount,
            notes.trim() ? `تسجيل وتسليم مباشر: ${notes.trim()}` : undefined,
            savedOrder
          );
          invoiceToPrint = invoice;
          showToast(
            creationAction === 'deliver_debt'
              ? 'تم تسجيل طلب الشغل وقيد الدين على حساب التاجر وإصدار الفاتورة بنجاح!'
              : 'تم تسجيل طلب الشغل وتسليمه كاش وإصدار الفاتورة بنجاح!'
          );
        } catch (err: any) {
          console.warn("Auto-delivery in offline mode:", err);
          showToast('تم حفظ العملية محلياً (أوفلاين) وستتم المزامنة عند عودة الإنترنت');
          handleCloseForm();
        }
      } else {
        showToast(editingOrder ? 'تم تعديل طلب الشغل بنجاح' : 'تم تسجيل طلب الشغل وقيد التحضير');
      }
      handleCloseForm();
    } catch (err: any) {
      console.warn("Work order saved locally in offline mode:", err);
      showToast('تم حفظ العملية محلياً (أوفلاين) وستتم المزامنة عند عودة الإنترنت');
      handleCloseForm();
    } finally {
      handleCloseForm();
      if (invoiceToPrint && onPrintInvoice) {
        onPrintInvoice(invoiceToPrint);
      }
    }
  };

  // Delete Order
  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    await removeWorkOrder(orderToDelete.id);
    showToast(`تم حذف طلب الشغل #${orderToDelete.orderNumber}`);
    setOrderToDelete(null);
  };

  // Open Delivery Modal for an Order
  const handleOpenDelivery = (order: WorkOrder) => {
    setDeliveryModalOrder(order);
    setDeliveryError(null);
    setDeliveryPaymentType('debt');
    setDeliveryPaidAmount('');
    setDeliveryNotes('');

    // Pre-fill delivery inputs with the remaining quantity by default for fast 1-click delivery
    const initialInputs: Record<string, number> = {};
    order.items.forEach(it => {
      initialInputs[it.id] = it.quantityRemaining;
    });
    setDeliveryInputs(initialInputs);
  };

  // Compute total for what is currently set to be delivered
  const currentBatchTotal = useMemo(() => {
    if (!deliveryModalOrder) return 0;
    return deliveryModalOrder.items.reduce((sum, it) => {
      const deliveringQty = Math.max(0, Number(deliveryInputs[it.id]) || 0);
      return sum + (deliveringQty * it.unitPrice);
    }, 0);
  }, [deliveryModalOrder, deliveryInputs]);

  // Submit Delivery Batch
  const handleConfirmDelivery = async () => {
    if (!deliveryModalOrder) return;
    setDeliveryError(null);

    const deliveryPayload = deliveryModalOrder.items
      .map(it => ({
        itemId: it.id,
        quantityToDeliver: Number(deliveryInputs[it.id]) || 0,
      }))
      .filter(d => d.quantityToDeliver > 0);

    if (deliveryPayload.length === 0) {
      setDeliveryError('يرجى تحديد كمية للتسليم أكبر من الصفر على صنف واحد على الأقل');
      return;
    }

    let invoiceToPrint: any = null;

    try {
      const { newStatus, invoice } = await deliverWorkOrder(
        deliveryModalOrder.id,
        deliveryPayload,
        deliveryPaymentType,
        deliveryPaidAmount ? parseFloat(deliveryPaidAmount) : undefined,
        deliveryNotes,
        deliveryModalOrder
      );
      invoiceToPrint = invoice;

      showToast(
        newStatus === 'delivered'
          ? 'تم تسليم كامل الطلب وإصدار الفاتورة وتحديث الحسابات بنجاح!'
          : 'تم تسليم الجزء المحدد وإصدار فاتورة به، وبقي الباقي قيد التحضير!'
      );
      setDeliveryModalOrder(null);
    } catch (err: any) {
      console.warn("Delivery offline catch:", err);
      showToast('تم حفظ العملية محلياً (أوفلاين) وستتم المزامنة عند عودة الإنترنت');
      setDeliveryModalOrder(null);
    } finally {
      setDeliveryModalOrder(null);
      if (invoiceToPrint && onPrintInvoice) {
        onPrintInvoice(invoiceToPrint);
      }
    }
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders
      .filter(o => {
        if (statusFilter === 'active' && o.status === 'delivered') return false;
        if (statusFilter === 'delivered' && o.status !== 'delivered') return false;

        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
          o.merchantName.toLowerCase().includes(q) ||
          o.orderNumber.toLowerCase().includes(q) ||
          o.items.some(it => it.productName.toLowerCase().includes(q)) ||
          (o.notes && o.notes.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [orders, statusFilter, searchTerm]);

  return (
    <div className="space-y-3.5 pb-24">
      
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Truck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>تحضير وتسليم طلبات الشغل</span>
            <span className="text-xs bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-full font-mono-num font-bold">
              {filteredOrders.length}
            </span>
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            سجل طلبات التجار، سلم الطلب كاملاً أو جزئياً، مع إضافة دين أو سداد فوري تلقائياً
          </p>
        </div>

        <button
          onClick={() => handleOpenForm()}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>طلب شغل جديد</span>
        </button>
      </div>

      {/* Search & Status Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث برقم الطلب، اسم التاجر، أو الصنف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
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

        {/* Filter Tabs Bar with Full Dark Mode & High Contrast Badges */}
        <div className="grid grid-cols-3 gap-1 bg-slate-200/90 dark:bg-slate-800/90 border border-slate-300/60 dark:border-slate-700/60 p-1 rounded-xl text-xs shadow-2xs">
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`py-1.5 px-1 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
              statusFilter === 'active'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <span>قيد التحضير</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-num font-bold ${
              statusFilter === 'active'
                ? 'bg-indigo-700/90 text-indigo-100'
                : 'bg-slate-300/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              {orders.filter(o => o.status !== 'delivered').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('delivered')}
            className={`py-1.5 px-1 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
              statusFilter === 'delivered'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <span>تم تسليمها</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-num font-bold ${
              statusFilter === 'delivered'
                ? 'bg-emerald-700/90 text-emerald-100'
                : 'bg-slate-300/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              {orders.filter(o => o.status === 'delivered').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`py-1.5 px-1 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <span>كل الطلبات</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-num font-bold ${
              statusFilter === 'all'
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                : 'bg-slate-300/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              {orders.length}
            </span>
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-2.5">
        {filteredOrders.map((order) => {
          const isDelivered = order.status === 'delivered';
          const isPartial = order.status === 'partially_delivered';
          const isPending = order.status === 'pending';

          const totalRemainingQty = order.items.reduce((s, it) => s + it.quantityRemaining, 0);

          return (
            <div
              key={order.id}
              className={`rounded-2xl border p-3.5 shadow-2xs transition-all ${
                isDelivered
                  ? 'bg-white dark:bg-slate-800/95 border-emerald-200/80 dark:border-emerald-800/60'
                  : isPartial
                  ? 'bg-white dark:bg-slate-800/95 border-indigo-200/80 dark:border-indigo-800/60'
                  : 'bg-white dark:bg-slate-800/95 border-amber-200/80 dark:border-amber-800/60'
              }`}
            >
              {/* Top Row: Merchant Name + Order # + Status Badge */}
              <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-700/60">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectMerchant) onSelectMerchant(order.merchantId);
                      }}
                      className="font-bold text-slate-900 dark:text-white text-sm truncate hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer text-right"
                      title="فتح صفحة التاجر"
                    >
                      {order.merchantName}
                    </button>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 font-mono-num font-bold text-slate-600 dark:text-slate-300">
                      #{order.orderNumber}
                    </span>
                  </div>
                  <div className="flex items-center flex-wrap gap-2 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    <span className="flex items-center gap-0.5">
                      <Calendar className="w-3 h-3" />
                      {formatDateArabic(order.date)}
                    </span>
                    {order.createdAt && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                          <Clock className="w-3 h-3" />
                          {getTimeAgoArabic(order.createdAt)}
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span>{order.items.length} أصناف</span>
                  </div>
                </div>

                <div className="shrink-0 text-left">
                  {isDelivered ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 border border-emerald-200 dark:border-emerald-800/60">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>تم التسليم كاملاً</span>
                    </span>
                  ) : isPartial ? (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 text-[11px] font-bold flex items-center gap-1 border border-indigo-200 dark:border-indigo-800/60">
                      <Clock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      <span>تم تسليم جزء (متبقي)</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1 border border-amber-200 dark:border-amber-800/60">
                      <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span>قيد التحضير</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Items Breakdown with Remaining Counters */}
              <div className="space-y-1.5 my-2">
                {order.items.map((it, idx) => (
                  <div key={idx} className="p-2 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-1">
                      <span className="font-bold text-slate-900 dark:text-slate-100 block truncate">{it.productName}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono-num">
                        سعر الوحدة: {formatCurrency(it.unitPrice, currency)}
                      </span>
                    </div>

                    <div className="text-left font-mono-num text-xs shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400 text-[10px]">المطلوب: <b>{it.quantityOrdered}</b></span>
                        <span className="text-teal-700 dark:text-teal-400 text-[10px]">المسلّم: <b>{it.quantityDelivered}</b></span>
                        {it.quantityRemaining > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.2 rounded border border-rose-200 dark:border-rose-800">
                            متبقي: {it.quantityRemaining}
                          </span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">خالص</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Financials & Notes */}
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pt-1 pb-2 border-t border-slate-100 dark:border-slate-700/60 font-mono-num">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] block">قيمة ما تم تسليمه</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(order.deliveredTotalAmount || 0, currency)}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] block">إجمالي قيمة الطلب</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    {formatCurrency(order.totalEstimatedAmount, currency)}
                  </span>
                </div>
              </div>

              {order.notes && (
                <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-1.5 rounded-lg mb-2 border border-slate-100 dark:border-slate-800">
                  ملاحظات: {order.notes}
                </div>
              )}

              {/* Actions: Deliver Button + Edit + Delete */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-1.5">
                {!isDelivered ? (
                  <button
                    onClick={() => handleOpenDelivery(order)}
                    className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                  >
                    <PackageCheck className="w-4 h-4 text-indigo-200" />
                    <span>{isPartial ? 'تسليم الباقي أو جزء جديد' : 'تسليم الطلب للتاجر'}</span>
                  </button>
                ) : (
                  <div className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 text-xs font-bold text-center flex items-center justify-between gap-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>تم تسليم هذا الطلب بالكامل</span>
                    </span>
                    {onPrintInvoice && (
                      <button
                        type="button"
                        onClick={() => {
                          const inv = invoices.find(i => i.orderId === order.id || (i.notes && i.notes.includes(order.orderNumber)));
                          if (inv) onPrintInvoice(inv);
                          else showToast('لم يتم العثور على فاتورة مرتبطة بهذا الطلب');
                        }}
                        className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold inline-flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                        title="معاينة وطباعة أو مشاركة فاتورة التسليم"
                      >
                        <Receipt className="w-3 h-3" />
                        <span>فاتورة التسليم</span>
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={() => handleOpenForm(order)}
                  title="تعديل تفاصيل الطلب"
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setOrderToDelete(order)}
                  title="حذف طلب الشغل"
                  className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 dark:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
            <Truck className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
              {orders.length === 0 
                ? 'لا توجد طلبات شغل مسجلة حالياً'
                : 'لا توجد طلبات شغل تطابق التصنيف المحدد'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
              {orders.length === 0
                ? 'سجل طلبات التجار لتحضيرها مسبقاً وتسليمها بضغطة زر واحدة.'
                : 'يمكنك الانتقال إلى تصنيف "كل طلبات الشغل" لرؤية جميع الطلبات المسجلة والمسلمة.'}
            </p>
            {orders.length > 0 && statusFilter !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setSearchTerm('');
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
              >
                عرض كل طلبات الشغل ({orders.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create / Edit Work Order Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white flex flex-col max-h-[85vh] sm:max-h-[90vh] overflow-hidden">
            
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 mb-2 shrink-0">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{editingOrder ? 'تعديل طلب الشغل' : 'تسجيل طلب شغل جديد للتاجر'}</span>
              </h3>
              <button onClick={handleCloseForm} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-2 mb-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs flex items-center gap-1.5 font-bold shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} id="work-order-form" className="flex-1 overflow-y-auto overscroll-contain space-y-3 text-xs sm:text-sm pr-1 pb-48">
              
              {/* Merchant Selector with Instant 1-Letter Search */}
              <div>
                <SearchableSelect
                  label="التاجر طالب الشغل"
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
                  searchPlaceholder="اكتب أول حرف للبحث الفوري عن التاجر..."
                  onAddNew={() => setIsQuickAddMerchantOpen(true)}
                  addNewText="+ تاجر جديد سريع"
                  accentColor="indigo"
                />

                {/* Inline Quick Add Merchant */}
                {isQuickAddMerchantOpen && (
                  <div className="mt-2 p-3 bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2">
                    <span className="font-bold text-xs text-indigo-900 dark:text-indigo-200 block">إضافة تاجر جديد فوراً:</span>
                    <input
                      type="text"
                      placeholder="اسم التاجر الجديد"
                      value={quickMerchantName}
                      onChange={(e) => setQuickMerchantName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs placeholder:text-slate-400"
                    />
                    <input
                      type="tel"
                      dir="ltr"
                      placeholder="رقم الهاتف"
                      value={quickMerchantPhone}
                      onChange={(e) => setQuickMerchantPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs text-right placeholder:text-slate-400"
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
                        className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                      >
                        حفظ واختيار
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">تاريخ الطلب *</label>
                <input
                  type="date"
                  required
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-mono-num"
                />
              </div>

              {/* Order Items */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">الأصناف والكميات المطلوبة:</span>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      id={`item-card-${idx}`}
                      className={`p-2.5 rounded-xl border space-y-2 transition-colors ${
                        !item.quantityOrdered || item.quantityOrdered === 0
                          ? 'bg-indigo-50/80 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80'
                      }`}
                    >
                      {/* Product Selector with Instant 1-Letter Search / Name */}
                      <div>
                        {products.length > 0 ? (
                          <div className="space-y-1">
                            <SearchableSelect
                              options={products.map(p => ({
                                id: p.id,
                                label: p.name,
                                subLabel: p.unit ? `الوحدة: ${p.unit}` : undefined,
                                badge: formatCurrency(p.price, currency),
                                badgeColor: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400',
                              }))}
                              value={item.productId || ''}
                              onChange={(prodId) => handleItemProductChange(idx, prodId)}
                              placeholder="-- ابحث عن صنف بالاسم من أول حرف --"
                              searchPlaceholder="اكتب أول حرف للبحث الفوري عن المنتج..."
                              accentColor="indigo"
                              onAddNew={() => {
                                setActiveItemIdx(idx);
                                setQuickProductName(item.productName || '');
                                setIsQuickAddProductOpen(true);
                              }}
                              addNewText="+ إضافة صنف جديد للمخزن"
                            />
                            {activeItemIdx === idx && isQuickAddProductOpen && (
                              <div className="mt-2 p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2">
                                <span className="font-bold text-xs text-indigo-900 dark:text-indigo-200 block">حفظ الصنف في قاعدة البيانات:</span>
                                <input
                                  type="text"
                                  placeholder="اسم الصنف الجديد"
                                  value={quickProductName}
                                  onChange={(e) => setQuickProductName(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                                />
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  placeholder="السعر الافتراضي للوحدة (اختياري)"
                                  value={quickProductPrice}
                                  onChange={(e) => setQuickProductPrice(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono-num"
                                />
                                <div className="flex justify-end gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => { setIsQuickAddProductOpen(false); setActiveItemIdx(null); }}
                                    className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400"
                                  >
                                    إلغاء
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickAddProduct(idx)}
                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold active:scale-95 transition-all"
                                  >
                                    حفظ واختيار
                                  </button>
                                </div>
                              </div>
                            )}
                            <input
                              type="text"
                              placeholder=""
                              value={item.productName}
                              onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                            />
                          </div>
                        ) : (
                          <input
                            type="text"
                            required
                            placeholder="اسم المنتج المطلوب"
                            value={item.productName}
                            onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                          />
                        )}
                      </div>

                      {/* Quantity Ordered + Unit Price */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => adjustQty(idx, -1)}
                            className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            id={`qty-input-${idx}`}
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0"
                            value={item.quantityOrdered === 0 ? '' : item.quantityOrdered}
                            onChange={(e) => handleItemChange(idx, 'quantityOrdered', e.target.value)}
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

                        <div className="font-mono-num font-bold text-slate-900 dark:text-white text-xs">
                          {formatCurrency((item.quantityOrdered || 0) * (item.unitPrice || 0), currency)}
                        </div>

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

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full mt-3 py-2.5 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700/60 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ إضافة صنف جديد للطلب</span>
                </button>
              </div>

              {/* Delivery and Accounting Action at Registration */}
              {!editingOrder && (
                <div className="p-3 bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/80 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>طريقة تسجيل وتسليم الطلب:</span>
                    </label>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                      {creationAction === 'pending' ? 'تسجيل كطلب تحضير' : 'تسليم فوري وإصدار فاتورة'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setCreationAction('pending')}
                      className={`p-2 rounded-xl border text-center font-bold transition-all text-[11px] ${
                        creationAction === 'pending'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      قيد التحضير (تسليم لاحقاً)
                    </button>

                    <button
                      type="button"
                      onClick={() => setCreationAction('deliver_debt')}
                      className={`p-2 rounded-xl border text-center font-bold transition-all text-[11px] ${
                        creationAction === 'deliver_debt'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      تسليم فوري (دين آجل على التاجر)
                    </button>

                    <button
                      type="button"
                      onClick={() => setCreationAction('deliver_cash')}
                      className={`p-2 rounded-xl border text-center font-bold transition-all text-[11px] ${
                        creationAction === 'deliver_cash'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      تسليم فوري (مسدد كاش بالكامل)
                    </button>

                    <button
                      type="button"
                      onClick={() => setCreationAction('deliver_partial')}
                      className={`p-2 rounded-xl border text-center font-bold transition-all text-[11px] ${
                        creationAction === 'deliver_partial'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      تسليم فوري (جزء كاش وباقي دين)
                    </button>
                  </div>

                  {creationAction === 'deliver_debt' && (
                    <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">
                      • سيتم حفظ الطلب وإصدار فاتورة بيع فوراً وإضافة كامل المبلغ إلى ديون التاجر ({formatCurrency(items.reduce((s, it) => s + (it.quantityOrdered * it.unitPrice), 0), currency)}).
                    </p>
                  )}

                  {creationAction === 'deliver_cash' && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                      • سيتم حفظ الطلب وإصدار فاتورة بيع مسددة كاش فوراً وإيداع المبلغ بالخزينة.
                    </p>
                  )}

                  {creationAction === 'deliver_partial' && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[11px] text-slate-600 dark:text-slate-400 font-bold block">
                        المسدد كاش فوري الآن:
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0"
                        value={creationPaidAmount}
                        onChange={(e) => setCreationPaidAmount(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono-num text-xs font-bold text-teal-700 dark:text-teal-400"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظات على الطلب أو مواعيد التسليم</label>
                <input
                  type="text"
                  placeholder="ملاحظات أو مواصفات إضافية..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

            </form>

            {/* Bottom Actions - Lifted above mobile navigation bar */}
            <div className="pt-3 pb-8 sm:pb-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
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
                  form="work-order-form"
                  className="py-3 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
                >
                  {editingOrder ? 'حفظ التعديلات' : 'تسجيل طلب الشغل'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Delivery Confirmation & Partial Batch Modal */}
      {deliveryModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white flex flex-col max-h-[85vh] sm:max-h-[90vh] overflow-hidden">
            
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 mb-2 shrink-0">
              <div className="min-w-0 pr-1">
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                  <PackageCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>تسليم طلب الشغل: {deliveryModalOrder.merchantName}</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  حدد ما تم تسليمه فعلياً، واشترط هل هو دين على الحساب أم مدفوع كاش فوري.
                </p>
              </div>
              <button onClick={() => setDeliveryModalOrder(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {deliveryError && (
              <div className="p-2 mb-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs flex items-center gap-1.5 font-bold shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deliveryError}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto overscroll-contain space-y-3 text-xs pr-1">
              
              {/* Items Delivery List (User specifies what was delivered now) */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  الكمية المسلمة للتاجر في هذه الدفعة:
                </div>

                {deliveryModalOrder.items.map((it) => {
                  const maxAllowed = it.quantityRemaining;
                  const currentVal = deliveryInputs[it.id] ?? maxAllowed;

                  return (
                    <div key={it.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">{it.productName}</span>
                        <span className="font-mono-num font-semibold text-slate-500 dark:text-slate-400">
                          {formatCurrency(it.unitPrice, currency)} / للوحدة
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>المتبقي للتسليم: <b className="text-slate-800 dark:text-slate-200 font-mono-num">{maxAllowed}</b></span>
                        <span>تم تسليمه سابقاً: <b className="text-teal-700 dark:text-teal-400 font-mono-num">{it.quantityDelivered}</b></span>
                      </div>

                      {/* Quantity Input for this delivery batch */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                        <span className="font-bold text-indigo-900 dark:text-indigo-300">المسلّم الآن:</span>

                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max={maxAllowed}
                            value={currentVal}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              setDeliveryInputs(prev => ({
                                ...prev,
                                [it.id]: Math.min(Math.max(0, v), maxAllowed),
                              }));
                            }}
                            className="w-16 px-2 py-1 rounded-lg border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 font-mono-num text-center font-bold text-indigo-700 dark:text-indigo-300 focus:outline-none"
                          />

                          <button
                            type="button"
                            onClick={() => setDeliveryInputs(prev => ({ ...prev, [it.id]: maxAllowed }))}
                            className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg text-[10px]"
                          >
                            تسليم الكل
                          </button>
                        </div>

                        <div className="font-mono-num font-bold text-slate-900 dark:text-white">
                          {formatCurrency(currentVal * it.unitPrice, currency)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total of Delivered Batch */}
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-between font-mono-num">
                <span className="text-indigo-900 dark:text-indigo-200 font-bold text-xs">إجمالي قيمة التسليم الحالي:</span>
                <span className="text-base font-black text-indigo-700 dark:text-indigo-300">
                  {formatCurrency(currentBatchTotal, currency)}
                </span>
              </div>

              {/* Payment Type Selection (Crucial user requirement: دين أم مدفوع) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                <label className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                  حالة حساب ما تم تسليمه (دين أم مدفوع؟) *
                </label>

                <div className="grid grid-cols-3 gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setDeliveryPaymentType('debt')}
                    className={`p-2 rounded-xl border text-center font-bold transition-all ${
                      deliveryPaymentType === 'debt'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    دين على الحساب
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryPaymentType('paid_full')}
                    className={`p-2 rounded-xl border text-center font-bold transition-all ${
                      deliveryPaymentType === 'paid_full'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    مدفوع كاش فوري
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryPaymentType('paid_partial')}
                    className={`p-2 rounded-xl border text-center font-bold transition-all ${
                      deliveryPaymentType === 'paid_partial'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    جزء كاش والباقي دين
                  </button>
                </div>

                {deliveryPaymentType === 'debt' && (
                  <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">
                    • سيتم إصدار فاتورة بيع بالمبلغ ({formatCurrency(currentBatchTotal, currency)}) وإضافتها كدين مستحق على التاجر.
                  </p>
                )}

                {deliveryPaymentType === 'paid_full' && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                    • سيتم إصدار فاتورة بيع وتسجيل استلام المبلغ نقداً ({formatCurrency(currentBatchTotal, currency)}) كإيراد دون زيادة دين.
                  </p>
                )}

                {deliveryPaymentType === 'paid_partial' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[11px] text-slate-600 dark:text-slate-400 font-bold block">
                      المبلغ المسدد كاش نقداً الآن:
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max={currentBatchTotal}
                      placeholder="0"
                      value={deliveryPaidAmount}
                      onChange={(e) => setDeliveryPaidAmount(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono-num text-xs font-bold text-teal-700 dark:text-teal-400"
                    />
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
                      المتبقي دين: <b>{formatCurrency(Math.max(0, currentBatchTotal - (parseFloat(deliveryPaidAmount) || 0)), currency)}</b>
                    </div>
                  </div>
                )}

                {/* Live Merchant Debt Preview Before and After Delivery */}
                {(() => {
                  const mBal = merchantBalances[deliveryModalOrder.merchantId];
                  const currentMerchantDebt = mBal ? Math.max(0, mBal.currentDebt) : 0;
                  const addedDebt = deliveryPaymentType === 'debt'
                    ? currentBatchTotal
                    : deliveryPaymentType === 'paid_full'
                    ? 0
                    : Math.max(0, currentBatchTotal - (parseFloat(deliveryPaidAmount) || 0));
                  const projectedDebt = currentMerchantDebt + addedDebt;

                  return (
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 font-mono-num text-xs space-y-1">
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span className="font-sans">حساب التاجر السابق (قبل التسليم):</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{formatCurrency(currentMerchantDebt, currency)}</span>
                      </div>
                      <div className="flex justify-between text-rose-600 dark:text-rose-400">
                        <span className="font-sans font-bold">المضاف للدين من هذه الدفعة:</span>
                        <span className="font-black">+{formatCurrency(addedDebt, currency)}</span>
                      </div>
                      <div className="pt-1 border-t border-slate-100 dark:border-slate-700 flex justify-between font-bold">
                        <span className="font-sans text-slate-800 dark:text-slate-200">حساب التاجر الإجمالي بعد التسليم:</span>
                        <span className={`font-black ${projectedDebt > 0 ? 'text-rose-600 dark:text-rose-400 text-sm' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {formatCurrency(projectedDebt, currency)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Delivery Notes */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">ملاحظات على التسليم</label>
                <input
                  type="text"
                  placeholder=""
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                />
              </div>

            </div>

            {/* Delivery Bottom Actions - Lifted above mobile navigation bar */}
            <div className="pt-3 pb-8 sm:pb-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <div className="grid grid-cols-2 gap-2 mb-2 sm:mb-0">
                <button
                  type="button"
                  onClick={() => setDeliveryModalOrder(null)}
                  className="py-3 sm:py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs active:scale-95 transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelivery}
                  className="py-3 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
                >
                  تأكيد التسليم وتحديث الحساب
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(orderToDelete)}
        title={`حذف طلب الشغل #${orderToDelete?.orderNumber}`}
        message="هل أنت متأكد من حذف هذا الطلب؟ لن يتم حذف الفواتير التي تم إصدارها سابقاً."
        onConfirm={handleConfirmDelete}
        onClose={() => setOrderToDelete(null)}
      />

    </div>
  );
};
