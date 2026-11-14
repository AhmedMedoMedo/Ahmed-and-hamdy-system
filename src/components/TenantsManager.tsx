import React, { useState, useEffect } from 'react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  useAuth,
  DEFAULT_TENANT_PERMISSIONS,
  type TenantData,
  type TenantPermissions,
} from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { formatDateArabic } from '../utils/formatters';
import { ConfirmModal } from './ConfirmModal';
import {
  Building2,
  PlusCircle,
  Trash2,
  KeyRound,
  ShieldCheck,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  Users,
  Pencil,
  Save,
  X,
  SlidersHorizontal,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';

const PERMISSION_ITEMS: { key: keyof Required<TenantPermissions>; label: string }[] = [
  { key: 'showHome', label: 'الرئيسية' },
  { key: 'showMerchants', label: 'التجار' },
  { key: 'showWorkOrders', label: 'الطلبات' },
  { key: 'showPersonal', label: 'شخصي' },
  { key: 'showDebts', label: 'ديون التجار' },
  { key: 'showArchive', label: 'الأرشيف' },
  { key: 'showActivityLog', label: 'سجل النشاط' },
  { key: 'showSettings', label: 'الإعدادات (الترس)' },
  { key: 'showCloudStatus', label: 'حالة السحابة (سحابي)' },
];

export const TenantsManager: React.FC = () => {
  const { role } = useAuth();
  const { showToast } = useApp();

  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [pin, setPin] = useState('');
  const [permissions, setPermissions] = useState<Required<TenantPermissions>>({
    ...DEFAULT_TENANT_PERMISSIONS,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [visiblePins, setVisiblePins] = useState<Record<string, boolean>>({});
  const [tenantToDelete, setTenantToDelete] = useState<TenantData | null>(null);

  useEffect(() => {
    if (role !== 'admin') return;

    const tenantsRef = collection(db, 'tenants');
    const unsubscribe = onSnapshot(
      tenantsRef,
      (snapshot) => {
        const list: TenantData[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const rawPerms = (data.permissions || {}) as Record<string, unknown>;
          return {
            id: docSnap.id,
            name: String(data.name || ''),
            pin: String(data.pin || ''),
            logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : undefined,
            permissions: {
              showHome: rawPerms.showHome !== false,
              showMerchants: rawPerms.showMerchants !== false,
              showWorkOrders: rawPerms.showWorkOrders !== false,
              showPersonal: rawPerms.showPersonal !== false,
              showDebts: rawPerms.showDebts !== false,
              showArchive: rawPerms.showArchive !== false,
              showActivityLog: rawPerms.showActivityLog !== false,
              showSettings: rawPerms.showSettings !== false,
              showCloudStatus: rawPerms.showCloudStatus !== false,
            },
            createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
          };
        });
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setTenants(list);
        setIsLoadingList(false);
      },
      (error) => {
        setIsLoadingList(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'tenants');
        } catch {
          setFormError('تعذر تحميل قائمة المشتركين من قاعدة البيانات');
        }
      }
    );

    return () => unsubscribe();
  }, [role]);

  if (role !== 'admin') {
    return null;
  }

  const resetForm = () => {
    setEditingTenantId(null);
    setName('');
    setLogoUrl('');
    setPin('');
    setPermissions({ ...DEFAULT_TENANT_PERMISSIONS });
    setFormError(null);
  };

  const handleStartEdit = (tenant: TenantData) => {
    setEditingTenantId(tenant.id);
    setName(tenant.name);
    setLogoUrl(tenant.logoUrl || '');
    setPin(tenant.pin);
    setPermissions({
      showHome: tenant.permissions?.showHome !== false,
      showMerchants: tenant.permissions?.showMerchants !== false,
      showWorkOrders: tenant.permissions?.showWorkOrders !== false,
      showPersonal: tenant.permissions?.showPersonal !== false,
      showDebts: tenant.permissions?.showDebts !== false,
      showArchive: tenant.permissions?.showArchive !== false,
      showActivityLog: tenant.permissions?.showActivityLog !== false,
      showSettings: tenant.permissions?.showSettings !== false,
      showCloudStatus: tenant.permissions?.showCloudStatus !== false,
    });
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTogglePermission = (key: keyof Required<TenantPermissions>) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const img = new Image();
      img.onload = () => {
        const MAX_SIZE = 256;
        let { width, height } = img;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setFormError('تعذر معالجة الصورة على هذا المتصفح');
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let compressedDataUrl = canvas.toDataURL('image/webp', 0.8);
        if (!compressedDataUrl.startsWith('data:image/webp')) {
          compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        }

        setLogoUrl(compressedDataUrl);
        if (formError) setFormError(null);
      };
      img.onerror = () => {
        setFormError('تعذر قراءة ملف الصورة المختار، يرجى اختيار صورة صالحة');
      };
      img.src = reader.result;
    };
    reader.onerror = () => {
      setFormError('حدث خطأ أثناء تحميل الصورة من الجهاز');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedLogoUrl = logoUrl.trim();
    const trimmedPin = pin.trim();

    if (!trimmedName) {
      setFormError('يرجى إدخال اسم النظام أو الشركة');
      return;
    }
    if (!trimmedPin) {
      setFormError('يرجى إدخال رمز الدخول (PIN)');
      return;
    }
    if (trimmedPin === '2026') {
      setFormError('هذا الرمز محجوز لمدير النظام، يرجى اختيار رمز آخر');
      return;
    }
    if (tenants.some((t) => t.pin === trimmedPin && t.id !== editingTenantId)) {
      setFormError('رمز الدخول مستخدم بالفعل لمشترك آخر، اختر رمزاً فريداً');
      return;
    }
    if (trimmedLogoUrl.length > 200000) {
      setFormError('حجم الشعار بعد الضغط كبير جداً، يرجى اختيار صورة أخرى');
      return;
    }

    setIsSubmitting(true);
    const isEditing = Boolean(editingTenantId);
    const existingTenant = isEditing ? tenants.find((t) => t.id === editingTenantId) : null;
    const id = editingTenantId || `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const payload = {
      name: trimmedName.slice(0, 100),
      pin: trimmedPin.slice(0, 30),
      ...(trimmedLogoUrl ? { logoUrl: trimmedLogoUrl } : {}),
      permissions: { ...permissions },
      createdAt: existingTenant?.createdAt || new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'tenants', id), payload);
      resetForm();
      showToast(
        isEditing
          ? `تم تحديث بيانات وصلاحيات "${trimmedName}" بنجاح`
          : `تمت إضافة المشترك "${trimmedName}" بنجاح`
      );
    } catch (error) {
      try {
        handleFirestoreError(
          error,
          isEditing ? OperationType.UPDATE : OperationType.CREATE,
          `tenants/${id}`
        );
      } catch {
        setFormError('تعذر حفظ المشترك في قاعدة البيانات، يرجى المحاولة مرة أخرى');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!tenantToDelete) return;
    const target = tenantToDelete;
    setTenantToDelete(null);

    try {
      await deleteDoc(doc(db, 'tenants', target.id));
      if (editingTenantId === target.id) {
        resetForm();
      }
      showToast(`تم حذف المشترك "${target.name}"`);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.DELETE, `tenants/${target.id}`);
      } catch {
        showToast('تعذر حذف المشترك، يرجى المحاولة مجدداً');
      }
    }
  };

  const togglePinVisibility = (id: string) => {
    setVisiblePins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const countEnabledPermissions = (perms?: TenantPermissions) => {
    if (!perms) return PERMISSION_ITEMS.length;
    return PERMISSION_ITEMS.filter((item) => perms[item.key] !== false).length;
  };

  return (
    <div className="space-y-3.5 pb-24">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-950 to-slate-900 rounded-2xl p-3.5 text-white shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-amber-300 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>لوحة تحكم المدير (SaaS)</span>
            </div>
            <h2 className="text-base font-bold mt-0.5">إدارة المشتركين والعملاء</h2>
          </div>
          <div className="bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl text-center">
            <span className="text-[10px] text-amber-200 block">إجمالي المشتركين</span>
            <span className="text-sm font-black font-mono-num">{tenants.length}</span>
          </div>
        </div>
      </div>

      {/* Add / Edit Tenant Form Card */}
      <div className="bg-white dark:bg-slate-800/95 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            {editingTenantId ? (
              <Pencil className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>{editingTenantId ? 'تعديل بيانات وصلاحيات المشترك' : 'إضافة مشترك جديد'}</span>
          </div>

          {editingTenantId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <X className="w-3 h-3" />
              <span>إلغاء التعديل</span>
            </button>
          )}
        </div>

        {formError && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmitTenant} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              اسم النظام / الشركة *
            </label>
            <input
              type="text"
              required
              maxLength={100}
              placeholder="مثال: سوبر ماركت السلام"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (formError) setFormError(null);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <span className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              لوجو / شعار النظام (اختياري)
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="logo-upload"
              onChange={handleImageUpload}
            />
            <div className="flex items-center gap-3 flex-wrap">
              <label
                htmlFor="logo-upload"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span>{logoUrl ? 'تغيير صورة الشعار' : 'رفع صورة الشعار من الجهاز'}</span>
              </label>

              {logoUrl ? (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <img
                    src={logoUrl}
                    alt="معاينة الشعار"
                    className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() => setLogoUrl('')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-[11px] font-bold transition-colors cursor-pointer"
                    title="حذف الصورة"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>يتم ضغط الصورة تلقائياً لتناسب الحفظ السحابي</span>
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              رمز الدخول السري (PIN) *
            </label>
            <input
              type="text"
              required
              maxLength={30}
              placeholder="مثال: 5050"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (formError) setFormError(null);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-mono-num focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Comprehensive Top Bar & Header Permissions */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>صلاحيات القائمة العلوية للمشترك</span>
              </span>
              <span className="text-[10px] font-mono-num font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/70 dark:border-emerald-800/60">
                {PERMISSION_ITEMS.filter((it) => permissions[it.key]).length} / {PERMISSION_ITEMS.length}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PERMISSION_ITEMS.map((item) => {
                const checked = permissions[item.key];
                return (
                  <label
                    key={item.key}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-[11px] font-bold cursor-pointer select-none transition-colors ${
                      checked
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleTogglePermission(item.key)}
                      className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 shrink-0"
                    />
                    <span className="truncate">{item.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2.5 rounded-xl disabled:opacity-60 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer ${
              editingTenantId
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            ) : editingTenantId ? (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات والصلاحيات</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                <span>حفظ وإضافة المشترك</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Tenants List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>قائمة المشتركين المسجلين</span>
          </span>
        </div>

        {isLoadingList ? (
          <div className="py-10 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500 dark:text-slate-400">جاري تحميل المشتركين...</p>
          </div>
        ) : tenants.length === 0 ? (
          <div className="py-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
            <Building2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">لا يوجد مشتركين حالياً</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              أضف أول عميل أو مشترك باستخدام النموذج أعلاه.
            </p>
          </div>
        ) : (
          tenants.map((tenant) => {
            const isPinShown = Boolean(visiblePins[tenant.id]);
            const enabledCount = countEnabledPermissions(tenant.permissions);
            return (
              <div
                key={tenant.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-3.5 shadow-2xs flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/70 dark:border-amber-800/60 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0 overflow-hidden">
                      {tenant.logoUrl ? (
                        <img
                          src={tenant.logoUrl}
                          alt={tenant.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                        {tenant.name}
                      </h3>
                      {tenant.createdAt && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                          تاريخ الإضافة: {formatDateArabic(tenant.createdAt.slice(0, 10))}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center flex-wrap gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono-num font-bold text-slate-700 dark:text-slate-200">
                      <KeyRound className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>PIN: {isPinShown ? tenant.pin : '••••'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => togglePinVisibility(tenant.id)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title={isPinShown ? 'إخفاء الرمز' : 'إظهار الرمز'}
                    >
                      {isPinShown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-800/60 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 font-mono-num">
                      <SlidersHorizontal className="w-2.5 h-2.5" />
                      <span>{enabledCount}/{PERMISSION_ITEMS.length} صلاحيات</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(tenant)}
                    className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-400 transition-colors"
                    title="تعديل البيانات والصلاحيات"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTenantToDelete(tenant)}
                    className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition-colors"
                    title="حذف المشترك"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(tenantToDelete)}
        title={`حذف المشترك "${tenantToDelete?.name || ''}"`}
        message="هل أنت متأكد من حذف هذا المشترك؟ لن يتمكن من الدخول باستخدام رمز PIN الخاص به بعد الحذف."
        onConfirm={handleConfirmDelete}
        onClose={() => setTenantToDelete(null)}
      />
    </div>
  );
};
