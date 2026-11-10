import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Settings, 
  Cloud, 
  Download, 
  Upload, 
  LogIn, 
  LogOut, 
  X, 
  ShieldCheck, 
  Coins, 
  Database,
  CheckCircle2,
  AlertTriangle,
  Sun,
  Moon,
  Building2,
  Lock,
  KeyRound,
  User
} from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { 
    currentUser, 
    cloudConnected, 
    loginWithGoogle, 
    logoutUser, 
    currency, 
    setCurrency, 
    storeName,
    setStoreName,
    currentUserName,
    updateCurrentUserName,
    updateDeviceName,
    exportDataJSON, 
    importDataJSON,
    isDarkMode,
    toggleDarkMode,
    systemPin,
    updateSystemPin,
    isPinEnabled,
    togglePinEnabled,
    lockSystem,
    showToast
  } = useApp();

  const [userNameInput, setUserNameInput] = useState(currentUserName);
  const [userNameSaved, setUserNameSaved] = useState(false);

  const [authWorking, setAuthWorking] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [newPinValue, setNewPinValue] = useState(systemPin);
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [showSecretSection, setShowSecretSection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setNewPinValue(systemPin);
  }, [systemPin]);

  const handleGoogleAuth = async () => {
    try {
      setAuthWorking(true);
      if (currentUser) {
        await logoutUser();
      } else {
        await loginWithGoogle();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAuthWorking(false);
    }
  };

  const handleExport = () => {
    const jsonStr = exportDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounting_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const ok = await importDataJSON(content);
        if (ok) {
          setImportStatus('تمت استعادة البيانات بنجاح!');
          setTimeout(() => setImportStatus(null), 3500);
        } else {
          setImportStatus('تعذر قراءة ملف النسخة الاحتياطية.');
        }
      } catch (err) {
        setImportStatus('خطأ أثناء استيراد البيانات.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <h3 
            onClick={() => {
              const next = tapCount + 1;
              if (next >= 5) {
                setShowSecretSection(true);
                showToast('تم فتح إعدادات المالك السرية 🔓');
                setTapCount(0);
              } else {
                setTapCount(next);
              }
            }}
            className="font-bold text-base text-slate-800 dark:text-white flex items-center gap-2 cursor-pointer select-none active:scale-95 transition-transform"
            title="إعدادات النظام"
          >
            <Settings className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>إعدادات النظام والحفظ السحابي</span>
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs sm:text-sm">
          
          {/* Cloud Storage & Firebase */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>حفظ البيانات السحابي (Firebase)</span>
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                currentUser ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
              }`}>
                {currentUser ? 'سحابي محفوظ للأبد' : 'حفظ محلي فقط'}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {currentUser
                ? `بياناتك تُحفظ وتُزامن فورياً على خوادم فايربيز بحساب جوجل (${currentUser.email}). لن تضيع بياناتك حتى لو قمت بتغيير الهاتف أو الكمبيوتر.`
                : 'قم بتسجيل الدخول بحساب Google لضمان حفظ التجار، الفواتير، والدفعات في السحاب للأبد وبشكل فوري.'}
            </p>

            <button
              onClick={handleGoogleAuth}
              disabled={authWorking}
              className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs transition-all ${
                currentUser
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/60'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
              }`}
            >
              {currentUser ? (
                <>
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج ({currentUser.email?.slice(0, 15)}...)</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>تسجيل الدخول بحساب Google للحفظ الأبدي</span>
                </>
              )}
            </button>
          </div>

          {/* Theme Mode Toggle (Dark / Light) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                {isDarkMode ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                <span>مظهر وتصميم النظام (الوضع الليلي والنهاري)</span>
              </label>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {isDarkMode ? 'الوضع الليلي مفعّل' : 'الوضع النهاري مفعّل'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { if (isDarkMode) toggleDarkMode(); }}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  !isDarkMode
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>الوضع النهاري العادي</span>
              </button>

              <button
                type="button"
                onClick={() => { if (!isDarkMode) toggleDarkMode(); }}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  isDarkMode
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600'
                }`}
              >
                <Moon className="w-4 h-4 text-amber-300" />
                <span>الوضع الليلي (Dark Mode)</span>
              </button>
            </div>
          </div>

          {/* Store / Trade Name Setting */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
            <label className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>اسم النشاط التجاري / المحل (يظهر أعلى الفاتورة والسند)</span>
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder=""
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
              الاسم الافتراضي: Ahmed And Hamdy (يمكنك تغييره لأي اسم تجاري تريده)
            </span>
          </div>

          {/* Currency Selector */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
            <label className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>رمز العملة</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['ج.م', 'ريال', 'درهم', '$'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`py-2 rounded-xl font-bold text-xs transition-all ${
                    currency === c
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Security & Owner Configuration (Secret Section - unlocked with 5 taps) */}
          {showSecretSection && (
            <>
              {/* User Name on this device (Secret Owner Setting) */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in duration-300">
                <label className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>اسم المستخدم على هذا الجهاز (سجل التدقيق السري)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={userNameInput}
                    onChange={(e) => {
                      setUserNameInput(e.target.value);
                      setUserNameSaved(false);
                    }}
                    placeholder="مثال: أحمد، حمدي، المحاسب..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const clean = userNameInput.trim() || 'مستخدم غير معروف';
                      setUserNameSaved(true);
                      await updateDeviceName(clean);
                      setUserNameInput(clean);
                      setTimeout(() => setUserNameSaved(false), 2500);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-xs shrink-0 flex items-center gap-1.5"
                  >
                    {userNameSaved ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        <span>تم الحفظ</span>
                      </>
                    ) : (
                      <span>حفظ الاسم</span>
                    )}
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  يُسجل هذا الاسم تلقائياً مع كل عملية بيع أو تعديل تقوم بها ليظهر في سجل التدقيق السري.
                </span>
              </div>

              {/* Security PIN Code Configuration */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>حماية النظام برمز مرور سري (PIN)</span>
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                    checked={isPinEnabled}
                    onChange={(e) => {
                      togglePinEnabled(e.target.checked);
                      showToast(e.target.checked ? 'تم تفعيل قفل النظام بالرمز' : 'تم تعطيل قفل النظام');
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>مفعّل</span>
                </label>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                يمنع أي شخص أو متطفل من رؤية حساباتك أو فواتيرك عند فتح الرابط من أي جهاز جديد دون إدخال الرمز السري.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPinValue}
                  onChange={(e) => setNewPinValue(e.target.value.replace(/[^0-9a-zA-Z]/g, '').slice(0, 8))}
                  placeholder="أدخل الرمز السري الجديد"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-mono font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isSavingPin}
                  onClick={async () => {
                    const clean = newPinValue.trim();
                    if (clean.length >= 3) {
                      setIsSavingPin(true);
                      try {
                        try {
                          localStorage.setItem('account_app_system_pin', clean);
                          localStorage.setItem('account_app_pin_verified', 'true');
                        } catch {}
                        await updateSystemPin(clean);
                        showToast('تم حفظ وتحديث رمز المرور السحابي بنجاح 🔒');
                      } catch (e) {
                        showToast('حدث خطأ أثناء حفظ الرمز');
                      } finally {
                        setIsSavingPin(false);
                      }
                    } else {
                      showToast('يجب أن يتكون الرمز من 3 خانات على الأقل');
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shrink-0 disabled:opacity-60"
                >
                  {isSavingPin ? 'جاري الحفظ...' : 'حفظ الرمز'}
                </button>
              </div>

                <div className="flex justify-between items-center pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>الرمز الحالي: <b className="font-mono text-emerald-600 dark:text-emerald-400">{systemPin}</b></span>
                  <button
                    type="button"
                    onClick={() => {
                      lockSystem();
                      onClose();
                    }}
                    className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-bold flex items-center gap-1"
                  >
                    <Lock className="w-3 h-3" />
                    <span>قفل النظام الآن</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Backup / Export / Import JSON */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <span className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>النسخ الاحتياطي اليدوي (أمان مضاعف)</span>
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              يمكنك تصدير نسخة كاملة من بياناتك إلى ملف على هاتفك أو حاسوبك، أو استعادتها في أي وقت.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleExport}
                className="py-2 px-3 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>تصدير نسخة JSON</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-2 px-3 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>استيراد نسخة JSON</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFile}
                accept=".json"
                className="hidden"
              />
            </div>

            {importStatus && (
              <div className="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs text-center font-bold">
                {importStatus}
              </div>
            )}
          </div>

        </div>

        {/* Modal footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 dark:bg-emerald-600 hover:bg-slate-900 dark:hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
          >
            تم
          </button>
        </div>

      </div>
    </div>
  );
};
