import React, { useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  HandCoins, 
  Package, 
  UserCheck, 
  Archive,
  Truck,
  AlertCircle,
  Trash2
} from 'lucide-react';

export const TopNav: React.FC = () => {
  const { activeTab, setActiveTab, pendingOrdersCount, debtorMerchantsCount } = useApp();
  const navContainerRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'orders', label: 'الطلبات', icon: Truck, badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined },
    { id: 'debts', label: 'ديون التجار', icon: AlertCircle, badge: debtorMerchantsCount > 0 ? debtorMerchantsCount : undefined },
    { id: 'merchants', label: 'التجار', icon: Users },
    { id: 'invoices', label: 'الفواتير', icon: FileText },
    { id: 'payments', label: 'الدفعات', icon: HandCoins },
    { id: 'products', label: 'المنتجات', icon: Package },
    { id: 'personal', label: 'شخصي', icon: UserCheck },
    { id: 'archive', label: 'الأرشيف', icon: Archive },
    { id: 'recycle_bin', label: 'المحذوفات', icon: Trash2 },
  ];

  // Auto-scroll active tab into view horizontally
  useEffect(() => {
    if (navContainerRef.current) {
      const activeEl = navContainerRef.current.querySelector('[data-active="true"]') as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  return (
    <nav className="bg-white dark:bg-slate-900">
      <div 
        ref={navContainerRef}
        className="max-w-md mx-auto flex items-center gap-1.5 px-2.5 pt-0.5 pb-2 overflow-x-auto no-scrollbar scroll-smooth"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              data-active={isActive ? 'true' : 'false'}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                isActive
                  ? tab.id === 'orders'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : tab.id === 'debts'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : tab.id === 'invoices'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : tab.id === 'payments'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : tab.id === 'personal'
                    ? 'bg-violet-600 text-white shadow-2xs'
                    : tab.id === 'recycle_bin'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-emerald-600 text-white shadow-2xs'
                  : tab.id === 'debts' && debtorMerchantsCount > 0
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <div className="relative">
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white rounded-full text-[8px] px-1 font-bold font-mono-num animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
