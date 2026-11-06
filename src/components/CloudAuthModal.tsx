import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Cloud, 
  CloudOff, 
  CheckCircle2, 
  X, 
  Zap, 
  AlertTriangle, 
  ExternalLink, 
  Copy, 
  Loader2,
  LogIn,
  LogOut,
  ShieldCheck
} from 'lucide-react';

interface CloudAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudAuthModal: React.FC<CloudAuthModalProps> = ({ isOpen, onClose }) => {
  const { 
    currentUser, 
    loginWithGoogle, 
    loginAnonymously, 
    logoutUser, 
    showToast,
    merchants,
    invoices,
    payments
  } = useApp();

  const [isLoading, setIsLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);

  if (!isOpen) return null;

  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'ahmedmedomedo.github.io';

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorDetails(null);
    setIsUnauthorizedDomain(false);
    try {
      await loginWithGoogle();
      showToast('تم تسجيل الدخول بحساب Google وتفعيل الحفظ السحابي ☁️');
      onClose();
    } catch (err: unknown) {
      console.error("Google sign in error", err);
      const error = err as { code?: string; message?: string };
      if (error?.code === 'auth/unauthorized-domain' || error?.message?.includes('unauthorized domain')) {
        setIsUnauthorizedDomain(true);
      } else if (error?.message === 'REDIRECT_INITIATED') {
        // Redirecting to Google on mobile
        return;
      } else {
        setErrorDetails(error?.message || 'تعذر تسجيل الدخول بحساب Google، يرجى المحاولة أو استخدام الحفظ السحابي الفوري.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstantCloudSync = async () => {
    setIsLoading(true);
    setErrorDetails(null);
    try {
      await loginAnonymously();
      showToast('تم تفعيل الحفظ السحابي الفوري بنجاح! بياناتك محفوظة في السحابة الآن 🚀');
      onClose();
    } catch (err: unknown) {
      console.error("Instant cloud sync error", err);
      const error = err as { message?: string };
      setErrorDetails(error?.message || 'تعذر تفعيل الحفظ السحابي، تأكد من الاتصال بالإنترنت.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      showToast('تم تسجيل الخروج والتحويل للتخزين المحلي');
      onClose();
    } catch {
      showToast('حدث خطأ أثناء تسجيل الخروج');
    }
  };

  const copyDomain = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentDomain);
      showToast('تم نسخ اسم النطاق: ' + currentDomain);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-hidden animate-in fade-in duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
              currentUser 
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' 
                : 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
            }`}>
              {currentUser ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                حالة الحفظ السحابي (Firebase)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {currentUser 
                  ? 'البيانات مربوطة ومحفوظة سحابياً لحظياً' 
                  : 'البيانات مخزنة حالياً في ذاكرة هذا الجهاز فقط'}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-3.5 space-y-3.5 text-xs overflow-y-auto max-h-[70vh]">
          
          {/* Status Box */}
          <div className={`p-3 rounded-2xl border ${
            currentUser
              ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
          }`}>
            <div className="flex items-center gap-2 font-bold mb-1">
              {currentUser ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-emerald-900 dark:text-emerald-200">
                    الحفظ السحابي نشط ومؤمّن للابد
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-amber-900 dark:text-amber-200">
                    تنبيه: أنت تعمل بالتخزين المحلي فقط
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              {currentUser 
                ? `مرتبط بحساب: ${currentUser.email || 'سحابي خاص بهذا الجهاز (UID: ' + currentUser.uid.substring(0, 8) + '...)'} — يتم حفظ أي فاتورة أو حركة لحظياً في فايربيز.`
                : 'لحفظ جميع حساباتك وفواتيرك وديون التجار في السحابة للابد بدون ضياع حتى لو قمت بمسح بيانات المتصفح، اختر إحدى الطرق السحابية بالأسفل:'}
            </p>
          </div>

          {/* If Unauthorized Domain Error Occurred with Google */}
          {isUnauthorizedDomain && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-2xl space-y-2 text-rose-900 dark:text-rose-200">
              <div className="flex items-center gap-1.5 font-bold text-xs text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>إذن نطاق Google لموقعك على GitHub Pages:</span>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                فايربيز يتطلب إضافة نطاق موقعك المصرح به في إعدادات Google Auth. الخطوة سهلة جداً:
              </p>
              <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between font-mono text-[11px] text-slate-900 dark:text-white">
                <span>{currentDomain}</span>
                <button
                  onClick={copyDomain}
                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-sans font-bold flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>نسخ</span>
                </button>
              </div>
              <ol className="list-decimal list-inside text-[10px] space-y-1 text-slate-600 dark:text-slate-400 pr-1">
                <li>افتح لوحة تحكم فايربيز (Firebase Console) لمشروعك: <b>smartscanner-a5e0d</b>.</li>
                <li>ادخل على <b>Authentication</b> ثم تبويب <b>Settings</b>.</li>
                <li>تحت <b>Authorized domains</b> اضغط <b>Add domain</b> وألصق النطاق المنسوخ أعلاه.</li>
              </ol>
              <div className="pt-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                💡 أو ببساطة: اضغط زر "الحفظ السحابي الفوري" بالأسفل وسيبدأ الحفظ السحابي فوراً بدون الحاجة لأي إعدادات!
              </div>
            </div>
          )}

          {/* Any other error */}
          {errorDetails && (
            <div className="p-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold">
              {errorDetails}
            </div>
          )}

          {/* Connection Actions */}
          {!currentUser ? (
            <div className="space-y-2.5 pt-1">
              
              {/* Option 1: Instant Cloud Sync (No Google domain restrictions, works everywhere) */}
              <button
                onClick={handleInstantCloudSync}
                disabled={isLoading}
                className="w-full p-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold flex items-center justify-between shadow-xs transition-all active:scale-98 disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5 text-right">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-black">⚡ تفعيل الحفظ السحابي الفوري (موصى به)</div>
                    <div className="text-[10px] text-emerald-100 font-normal">
                      يربط النظام بسحابة Firebase فوراً وبدون أي قيود أو نوافذ
                    </div>
                  </div>
                </div>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">بنقرة واحدة</span>
              </button>

              {/* Option 2: Google Sign-in */}
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full p-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-100 font-bold flex items-center justify-between border border-slate-200 dark:border-slate-700 shadow-2xs transition-all active:scale-98 disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5 text-right">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    <LogIn className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-xs font-black">تسجيل الدخول بحساب Google</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                      ربط الحساب بإيميلك الشخصي لنقل البيانات لأي جهاز آخر
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 font-bold">حساب رسمي</span>
              </button>

            </div>
          ) : (
            <div className="space-y-2 pt-1">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  إحصائيات المزامنة السحابية الحالية:
                </div>
                <div className="grid grid-cols-3 gap-1 text-center font-mono-num text-[11px] pt-1">
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 block text-[9px] font-sans">تجار</span>
                    <span className="font-bold text-slate-900 dark:text-white">{merchants.length}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 block text-[9px] font-sans">فواتير</span>
                    <span className="font-bold text-slate-900 dark:text-white">{invoices.length}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 block text-[9px] font-sans">دفعات</span>
                    <span className="font-bold text-slate-900 dark:text-white">{payments.length}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 border border-rose-200 dark:border-rose-900 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج والتحويل للتخزين المحلي</span>
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
