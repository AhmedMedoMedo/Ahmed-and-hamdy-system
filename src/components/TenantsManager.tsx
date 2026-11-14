import React, { useState, useEffect } from 'react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth, type TenantData } from '../context/AuthContext';
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
} from 'lucide-react';

export const TenantsManager: React.FC = () => {
  const { role } = useAuth();
  const { showToast } = useApp();

  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [pin, setPin] = useState('');
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
          return {
            id: docSnap.id,
            name: String(data.name || ''),
            pin: String(data.pin || ''),
            logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : undefined,
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

  const handleAddTenant = async (e: React.FormEvent) => {
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
    if (tenants.some((t) => t.pin === trimmedPin)) {
      setFormError('رمز الدخول مستخدم بالفعل لمشترك آخر، اختر رمزاً فريداً');
      return;
    }

    setIsSubmitting(true);
    const id = `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newTenant = {
      name: trimmedName.slice(0, 100),
      pin: trimmedPin.slice(0, 30),
      ...(trimmedLogoUrl ? { logoUrl: trimmedLogoUrl.slice(0, 500) } : {}),
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'tenants', id), newTenant);
      setName('');
      setLogoUrl('');
      setPin('');
      showToast(`تمت إضافة المشترك "${trimmedName}" بنجاح`);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.CREATE, `tenants/${id}`);
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

      {/* Add Tenant Form Card */}
      <div className="bg-white dark:bg-slate-800/95 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
          <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>إضافة مشترك جديد</span>
        </div>

        {formError && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleAddTenant} className="space-y-2.5 text-xs">
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
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              رابط اللوجو / الشعار (اختياري)
            </label>
            <input
              type="text"
              dir="ltr"
              maxLength={500}
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => {
                setLogoUrl(e.target.value);
                if (formError) setFormError(null);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-left focus:outline-none focus:border-emerald-500"
            />
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ...</span>
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

                  <div className="flex items-center gap-2 pt-1">
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
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTenantToDelete(tenant)}
                  className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition-colors shrink-0"
                  title="حذف المشترك"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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
