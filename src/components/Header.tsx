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
  LogIn, 
  LogOut, 
  Settings, 
  RotateCcw,
  Sun,
  Moon,
  Store
} from 'lucide-react';
import { CloudAuthModal } from './CloudAuthModal';
import { PWAInstallButton } from './PWAInstallButton';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onOpenSettings: () => void;
  onTitleClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, onTitleClick }) => {
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
  const { role, tenantData, logout } = useAuth();

  const hasPermission = (feature: string) => {
    if (role === 'admin') return true;
    if (!tenantData?.permissions) return true;
    return (tenantData.permissions as Record<string, boolean | undefined>)[feature] !== false;
  };

  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [logoLoadError, setLogoLoadError] = useState(false);
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

  return (
    <>
      <header className="bg-white dark:bg-slate-900">
        <div className="max-w-md mx-auto px-3 pt-2 pb-1 space-y-1.5">
          
          {/* Top line: Brand + Cloud indicator + Dark Toggle + Settings */}
          <div className="flex items-center justify-between gap-2">
            
            <div className="flex items-center gap-2 min-w-0">
              {role === 'tenant' ? (
                <>
                  {tenantData?.logoUrl && !logoLoadError ? (
                    <img
                      src={tenantData.logoUrl}
                      alt={tenantData.name || 'Logo'}
                      onError={() => setLogoLoadError(true)}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                      <Store className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1
                      onClick={onTitleClick}
                      className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight select-none cursor-pointer active:opacity-70 transition-opacity"
                    >
                      {tenantData?.name || 'نظام الحسابات'}
                    </h1>
                  </div>
                </>
              ) : (
                <>
                  <img 
                    src={`${import.meta.env.BASE_URL}app-icon.png`} 
                    alt="Logo" 
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-contain drop-shadow-md bg-white/5 border border-white/10" 
                  />
                  <div className="min-w-0">
                    <h1 
                      onClick={onTitleClick}
                      className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight select-none cursor-pointer active:opacity-70 transition-opacity"
                    >
                      Ahmed And Hamdy
                    </h1>
                  </div>
                </>
              )}
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* PWA Install Button */}
              <PWAInstallButton />

              {/* Dark Mode Quick Toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-400 transition-colors"
                title={isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي (الداكن)'}
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Cloud Connection / Login button */}
              {hasPermission('showCloudStatus') && (
                <button
                  onClick={() => setIsCloudModalOpen(true)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                    currentUser
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                  }`}
                >
                  {currentUser ? (
                    <>
                      <Cloud className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>سحابي</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-3 h-3" />
                      <span>دخول</span>
                    </>
                  )}
                </button>
              )}

              {hasPermission('showSettings') && (
                <button
                  onClick={onOpenSettings}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  title="الإعدادات"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={logout}
                className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition-colors"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
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

      {/* Cloud Authentication & Sync Modal */}
      <CloudAuthModal 
        isOpen={isCloudModalOpen} 
        onClose={() => setIsCloudModalOpen(false)} 
      />
    </>
  );
};
