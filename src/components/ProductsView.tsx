import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { Product } from '../types';
import { formatCurrency } from '../utils/formatters';
import { ConfirmModal } from './ConfirmModal';
import { 
  Package, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  DollarSign, 
  X,
  ShoppingCart,
  Check
} from 'lucide-react';

interface ProductsViewProps {
  onSellProduct?: (product: Product) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({ onSellProduct }) => {
  const { products, currency, saveProduct, removeProduct, showToast } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    costPrice: '',
    unit: 'كرتونة',
    notes: '',
  });

  // Deletion Modal
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.notes && p.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.unit && p.unit.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [products, searchTerm]);

  const handleOpenForm = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        price: String(product.price),
        costPrice: product.costPrice !== undefined ? String(product.costPrice) : '',
        unit: product.unit || 'كرتونة',
        notes: product.notes || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        price: '',
        costPrice: '',
        unit: 'كرتونة',
        notes: '',
      });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.price) return;

    await saveProduct({
      ...(editingProduct ? { id: editingProduct.id } : {}),
      name: formData.name.trim(),
      price: parseFloat(formData.price) || 0,
      costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
      unit: formData.unit.trim() || 'قطعة',
      notes: formData.notes.trim(),
    });

    showToast(editingProduct ? 'تم تعديل سعر وبيانات المنتج' : 'تمت إضافة المنتج بنجاح');
    setIsFormOpen(false);
    setEditingProduct(null);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    await removeProduct(productToDelete.id);
    showToast(`تم حذف منتج "${productToDelete.name}" بنجاح`);
    setProductToDelete(null);
  };

  return (
    <div className="space-y-3.5 pb-24">
      
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-1.5">
            <Package className="w-5 h-5 text-emerald-600" />
            <span>منتجات البيع والتسعير</span>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono-num font-bold">
              {products.length}
            </span>
          </h2>
          <p className="text-[11px] text-slate-500">حدد أسعار المنتجات وقم ببيعها للتجار بنقرة واحدة</p>
        </div>

        <button
          onClick={() => handleOpenForm()}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة منتج وسعر</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="بحث عن منتج بالاسم أو الوحدة..."
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

      {/* Products Cards List */}
      <div className="space-y-2.5">
        {filteredProducts.map((product) => {
          return (
            <div
              key={product.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs hover:border-slate-300 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-slate-900 text-sm truncate">{product.name}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {product.unit}
                    </span>
                  </div>
                  {product.notes && (
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{product.notes}</p>
                  )}
                </div>

                <div className="text-left shrink-0 pl-1">
                  <div className="text-[10px] text-slate-500 font-semibold">سعر بيع التاجر</div>
                  <div className="text-base font-black text-emerald-700 font-mono-num">
                    {formatCurrency(product.price, currency)}
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                {/* Direct Sell to Merchant Button */}
                <button
                  onClick={() => onSellProduct && onSellProduct(product)}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>بيع للتاجر الآن</span>
                </button>

                {/* Edit Button */}
                <button
                  onClick={() => handleOpenForm(product)}
                  title="تعديل السعر والبيانات"
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                {/* Delete Button */}
                <button
                  onClick={() => setProductToDelete(product)}
                  title="حذف المنتج"
                  className="p-1.5 rounded-xl hover:bg-rose-50 text-rose-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
            <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">لا توجد منتجات مسجلة</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">أضف منتجاتك بأسعار محددة لتتمكن من بيعها للتجار فوراً.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>{editingProduct ? 'تعديل سعر وبيانات المنتج' : 'إضافة منتج وسعر بيع جديد'}</span>
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اسم المنتج أو السلعة *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: عروسة لعبة حجم كبير"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">سعر البيع للتاجر *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      min="0"
                      placeholder="0.00"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 focus:outline-none focus:border-emerald-500 font-mono-num text-left font-bold text-xs"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500">
                      {currency}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">وحدة القياس</label>
                  <input
                    type="text"
                    placeholder="قطعة / دستة / كرتونة"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظات أو مواصفات (اختياري)</label>
                <input
                  type="text"
                  placeholder="ملاحظات الصنف..."
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
                  {editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(productToDelete)}
        title={`حذف منتج "${productToDelete?.name}"`}
        message="هل أنت متأكد من حذف هذا المنتج من كتالوج الأسعار؟"
        onConfirm={handleConfirmDelete}
        onClose={() => setProductToDelete(null)}
      />

    </div>
  );
};
