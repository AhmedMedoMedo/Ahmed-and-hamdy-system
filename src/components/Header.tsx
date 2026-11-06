import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  formatMonthName, 
  getPreviousMonthKey, 
  getNextMonthKey, 
  getCurrentMonthKey 
} from '../utils/formatters';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Cloud, 
  CloudOff, 
  LogIn, 
  LogOut, 
  Settings, 
  Wallet,
  RotateCcw,
  Sun,
  Moon
} from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  const { 
    selectedMonth, 
    setSelectedMonth, 
    currentUser, 
    loginWithGoogle, 
    logoutUser,
    showToast,
    isDarkMode,
    toggleDarkMode
  } = useApp();

  const [authWorking, setAuthWorking] = useState(false);
  const currentRealMonth = getCurrentMonthKey();
  const isViewingCurrentMonth = selectedMonth === currentRealMonth;

  const handlePrevMonth = () => {
    setSelectedMonth(getPreviousMonthKey(selectedMonth));
  };

  const handleNextMonth = () => {
    setSelectedMonth(getNextMonthKey(selectedMonth));
  };

  const handleResetToCurrentMonth = () => {
    setSelectedMonth(currentRealMonth);
    showToast('تمت العودة للشهر الحالي');
  };

  const handleGoogleAuth = async () => {
    try {
      setAuthWorking(true);
      if (currentUser) {
        await logoutUser();
        showToast('تم تسجيل الخروج');
      } else {
        await loginWithGoogle();
        showToast('تم تسجيل الدخول وتفعيل الحفظ السحابي');
      }
    } catch (err) {
      console.error(err);
      showToast('تعذر تسجيل الدخول');
    } finally {
      setAuthWorking(false);
    }
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-md mx-auto px-3 py-2 space-y-1.5">
        
        {/* Top line: Brand + Cloud indicator + Dark Toggle + Settings */}
        <div className="flex items-center justify-between gap-2">
          
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xs shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">
                نظام الحسابات والتجار
              </h1>
              <div className="flex items-center gap-1 text-[10px]">
                {currentUser ? (
                  <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold truncate">
                    <Cloud className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[130px]">{currentUser.email?.split('@')[0]} (سحابي)</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium">
                    <CloudOff className="w-3 h-3 shrink-0" />
                    <span>تخزين محلي</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Dark Mode Quick Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-400 transition-colors"
              title={isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي (الداكن)'}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={handleGoogleAuth}
              disabled={authWorking}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                currentUser
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
              }`}
            >
              {currentUser ? (
                <>
                  <LogOut className="w-3 h-3" />
                  <span>خروج</span>
                </>
              ) : (
                <>
                  <LogIn className="w-3 h-3" />
                  <span>دخول</span>
                </>
              )}
            </button>

            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="الإعدادات"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Bottom line: Month Selector Bar (Always one tap away) */}
        <div className="flex items-center justify-between bg-slate-100/90 dark:bg-slate-800/80 rounded-xl p-1 border border-slate-200/70 dark:border-slate-700/60">
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 active:scale-95 transition-all"
            title="الشهر السابق"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{formatMonthName(selectedMonth)}</span>
            {!isViewingCurrentMonth && (
              <button
                onClick={handleResetToCurrentMonth}
                className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 hover:bg-emerald-200 px-1.5 py-0.2 rounded-md flex items-center gap-0.5 font-bold"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                الحالي
              </button>
            )}
          </div>

          <button
            onClick={handleNextMonth}
            className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 active:scale-95 transition-all"
            title="الشهر التالي"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
