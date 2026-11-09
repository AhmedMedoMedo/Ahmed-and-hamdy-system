import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import type { TrashItem, TrashCollectionType } from '../types';
import { formatCurrency, formatDateArabic, getTimeAgoArabic } from '../utils/formatters';
import { ConfirmModal } from './ConfirmModal';
import { 
  Trash2, 
  RotateCcw, 
  Search, 
  RotateCw, 
  FileText, 
  HandCoins, 
  Truck, 
  Receipt, 
  Users, 
  Package, 
  UserCheck, 
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Clock
} from 'lucide-react';

export const RecycleBinView: React.FC = () => {
  const { fetchTrashItems, restoreItem, permanentDelete, currency, showToast } = useApp();

  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<'all' | TrashCollectionType>('all');

  // Permanent Delete Dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    item: TrashItem | null;
  }>({
    isOpen: false,
    item: null,
  });

  // Action in progress (item id)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadTrash = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchTrashItems();
      setItems(data);
    } catch (err) {
      console.error('Failed to load trash:', err);
      showToast('تعذر تحميل عناصر سلة المحذوفات');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchTrashItems, showToast]);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  // Handle Restore
  const handleRestore = async (item: TrashItem) => {
    setActionInProgress(item.id);
    try {
      await restoreItem(item.collectionName, item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      console.error('Restore failed:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  // Trigger permanent delete modal
  const triggerPermanentDelete = (item: TrashItem) => {
    setDeleteDialog({
      isOpen: true,
      item,
    });
  };

  // Confirm permanent delete
  const handleConfirmPermanentDelete = async () => {
    if (!deleteDialog.item) return;
    const item = deleteDialog.item;
    setActionInProgress(item.id);

    try {
      await permanentDelete(item.collectionName, item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      console.error('Permanent delete failed:', err);
    } finally {
      setActionInProgress(null);
      setDeleteDialog({ isOpen: false, item: null });
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Collection Filter
      if (collectionFilter !== 'all' && item.collectionName !== collectionFilter) {
        return false;
      }

      // Search Query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(query);
        const matchesSubtitle = item.subtitle?.toLowerCase().includes(query);
        const matchesLabel = item.typeLabel?.toLowerCase().includes(query);
        const matchesId = item.id.toLowerCase().includes(query);
        if (!matchesTitle && !matchesSubtitle && !matchesLabel && !matchesId) {
          return false;
        }
      }

      return true;
    });
  }, [items, collectionFilter, searchTerm]);

  // Render icon based on collection type
  const renderCollectionIcon = (coll: TrashCollectionType) => {
    switch (coll) {
      case 'invoices':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'payments':
        return <HandCoins className="w-4 h-4 text-emerald-500" />;
      case 'orders':
        return <Truck className="w-4 h-4 text-indigo-500" />;
      case 'expenses':
        return <Receipt className="w-4 h-4 text-amber-500" />;
      case 'merchants':
        return <Users className="w-4 h-4 text-teal-500" />;
      case 'products':
        return <Package className="w-4 h-4 text-violet-500" />;
      case 'personal_contacts':
        return <UserCheck className="w-4 h-4 text-rose-500" />;
      case 'personal_transactions':
        return <HandCoins className="w-4 h-4 text-fuchsia-500" />;
      default:
        return <Trash2 className="w-4 h-4 text-slate-400" />;
    }
  };

  // Badge styles
  const getBadgeStyle = (coll: TrashCollectionType) => {
    switch (coll) {
      case 'invoices':
        return 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-900/40';
      case 'payments':
        return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-900/40';
      case 'orders':
        return 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-900/40';
      case 'expenses':
        return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-900/40';
      case 'merchants':
        return 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200/60 dark:border-teal-900/40';
      case 'products':
        return 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-200/60 dark:border-violet-900/40';
      case 'personal_contacts':
        return 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-900/40';
      case 'personal_transactions':
        return 'bg-fuchsia-50 dark:bg-fuchsia-950/50 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200/60 dark:border-fuchsia-900/40';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-3 pb-12 animate-in fade-in duration-150">
      
      {/* Top Banner & Info Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/40">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 dark:text-white text-base leading-tight">
                سلة المحذوفات
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                نظام الحذف الآمن (Soft Delete) لحماية بياناتك
              </p>
            </div>
          </div>

          <button
            onClick={() => loadTrash(true)}
            disabled={refreshing || loading}
            title="تحديث القائمة"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 active:scale-95 transition-all disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-rose-600' : ''}`} />
          </button>
        </div>

        <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-300 font-medium">
            إجمالي المحذوفات المعلقة:
          </span>
          <span className="font-black font-mono-num px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/50 dark:border-rose-900/40">
            {items.length} عنصر
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-2">
        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث في المحذوفات بالاسم أو الرقم أو النوع..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-rose-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
            >
              مسح
            </button>
          )}
        </div>

        {/* Collection Type Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
          <button
            onClick={() => setCollectionFilter('all')}
            className={`py-1.5 px-3 rounded-xl font-bold whitespace-nowrap transition-all ${
              collectionFilter === 'all'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            الكل ({items.length})
          </button>
          <button
            onClick={() => setCollectionFilter('invoices')}
            className={`py-1.5 px-3 rounded-xl font-bold whitespace-nowrap transition-all ${
              collectionFilter === 'invoices'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            فواتير
          </button>
          <button
            onClick={() => setCollectionFilter('payments')}
            className={`py-1.5 px-3 rounded-xl font-bold whitespace-nowrap transition-all ${
              collectionFilter === 'payments'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            دفعات
          </button>
          <button
            onClick={() => setCollectionFilter('orders')}
            className={`py-1.5 px-3 rounded-xl font-bold whitespace-nowrap transition-all ${
              collectionFilter === 'orders'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            طلبات
          </button>
          <button
            onClick={() => setCollectionFilter('expenses')}
            className={`py-1.5 px-3 rounded-xl font-bold whitespace-nowrap transition-all ${
              collectionFilter === 'expenses'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            مصاريف
          </button>
          <button
            onClick={() => setCollectionFilter('merchants')}
            className={`py-1.5 px-3 rounded-xl font-bold whitespace-nowrap transition-all ${
              collectionFilter === 'merchants'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            تجار
          </button>
          <button
            onClick={() => setCollectionFilter('products')}
            className={`py-1.5 px-3 rounded-xl font-bold whitespace-nowrap transition-all ${
              collectionFilter === 'products'
                ? 'bg-violet-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            منتجات
          </button>
          <button
            onClick={() => setCollectionFilter('personal_contacts')}
            className={`py-1.5 px-3 rounded-xl font-bold whitespace-nowrap transition-all ${
              collectionFilter === 'personal_contacts'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            حساب شخصي
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3">
          <RotateCw className="w-8 h-8 text-rose-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
            جاري فحص واسترجاع عناصر سلة المحذوفات من السحابة...
          </p>
        </div>
      )}

      {/* Items List */}
      {!loading && (
        <div className="space-y-2.5">
          {filteredItems.map(item => {
            const isWorking = actionInProgress === item.id;

            return (
              <div
                key={`${item.collectionName}_${item.id}`}
                className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 shadow-xs border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                      {renderCollectionIcon(item.collectionName)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${getBadgeStyle(item.collectionName)}`}>
                          {item.typeLabel}
                        </span>
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs truncate">
                          {item.title}
                        </h4>
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Amount if present */}
                  {typeof item.amount === 'number' && (
                    <div className="text-left shrink-0">
                      <span className="font-black text-xs font-mono-num text-slate-900 dark:text-white block">
                        {formatCurrency(item.amount, currency)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer details & Action Buttons */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                  {/* Deleted date */}
                  <div className="flex items-center flex-wrap gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span>
                      {item.deletedAt ? `حُذف: ${formatDateArabic(item.deletedAt.slice(0, 10))}` : 'محذوف مؤقتاً'}
                    </span>
                    {item.deletedAt && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          {getTimeAgoArabic(item.deletedAt)}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Restore Button */}
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => handleRestore(item)}
                      title="استعادة العنصر وإعادته للعمل"
                      className="py-1 px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-bold text-xs flex items-center gap-1 border border-emerald-200/60 dark:border-emerald-800/50 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isWorking ? 'جاري...' : 'استعادة'}</span>
                    </button>

                    {/* Permanent Delete Button */}
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => triggerPermanentDelete(item)}
                      title="حذف نهائي لا يمكن التراجع عنه"
                      className="py-1 px-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 font-bold text-xs flex items-center gap-1 border border-rose-200/60 dark:border-rose-800/50 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف نهائي</span>
                    </button>
                  </div>
                </div>

              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-900/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                سلة المحذوفات فارغة
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                {searchTerm || collectionFilter !== 'all'
                  ? 'لا توجد عناصر محذوفة تطابق معايير البحث والفلترة.'
                  : 'رائع! لا توجد أي عناصر محذوفة حالياً، جميع سجلاتك نشطة ومحفوظة.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Permanent Deletion */}
      {deleteDialog.item && (
        <ConfirmModal
          isOpen={deleteDialog.isOpen}
          title={`حذف نهائي لـ "${deleteDialog.item.title}"`}
          message="تحذير: هذا الإجراء سيقوم بحذف هذا السجل نهائياً من قاعدة بيانات السحابة (Firestore) ولن تتمكن من استعادته مرة أخرى. هل أنت متأكد؟"
          confirmText="نعم، حذف نهائي"
          cancelText="تراجع"
          isDestructive={true}
          onConfirm={handleConfirmPermanentDelete}
          onClose={() => setDeleteDialog({ isOpen: false, item: null })}
        />
      )}

    </div>
  );
};
