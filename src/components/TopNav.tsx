import React, { useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
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
  Trash2,
  Activity
} from 'lucide-react';

interface TopNavProps {
  showSecretTabs?: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({ showSecretTabs = false }) => {
  const { activeTab, setActiveTab, pendingOrdersCount, debtorMerchantsCount } = useApp();
  const { role, tenantData } = useAuth();
  const navContainerRef = useRef<HTMLDivElement>(null);

  const hasPermission = useCallback((feature: string) => {
    if (role === 'admin') return true;
    if (!tenantData?.permissions) return true;
    return (tenantData.permissions as Record<string, boolean | undefined>)[feature] !== false;
  }, [role, tenantData]);

  // Drag-to-scroll state refs
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const hasDragged = useRef(false);

  const tabs = [
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard, permissionKey: 'showHome' },
    { id: 'orders', label: 'الطلبات', icon: Truck, badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined, permissionKey: 'showWorkOrders' },
    { id: 'personal', label: 'شخصي', icon: UserCheck, permissionKey: 'showPersonal' },
    { id: 'debts', label: 'ديون التجار', icon: AlertCircle, badge: debtorMerchantsCount > 0 ? debtorMerchantsCount : undefined, permissionKey: 'showDebts' },
    { id: 'merchants', label: 'التجار', icon: Users, permissionKey: 'showMerchants' },
    { id: 'invoices', label: 'الفواتير', icon: FileText },
    { id: 'payments', label: 'الدفعات', icon: HandCoins },
    { id: 'products', label: 'المنتجات', icon: Package },
    { id: 'archive', label: 'الأرشيف', icon: Archive, permissionKey: 'showArchive' },
    { id: 'logs', label: 'سجل النشاط', icon: Activity, permissionKey: 'showActivityLog' },
    { id: 'recycle_bin', label: 'المحذوفات', icon: Trash2 },
  ];

  // If the current active tab is disabled by tenant permissions, move to first allowed tab
  useEffect(() => {
    const currentTabDef = tabs.find(t => t.id === activeTab);
    if (currentTabDef?.permissionKey && !hasPermission(currentTabDef.permissionKey)) {
      const firstAllowed = tabs.find(t => t.id !== 'logs' && (!t.permissionKey || hasPermission(t.permissionKey)));
      if (firstAllowed) {
        setActiveTab(firstAllowed.id);
      }
    }
  }, [activeTab, hasPermission, setActiveTab]);

  // Auto-scroll active tab into view horizontally
  useEffect(() => {
    if (navContainerRef.current) {
      const activeEl = navContainerRef.current.querySelector('[data-active="true"]') as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  // Pointer drag event handlers with pointer capture
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const container = navContainerRef.current;
    if (!container) return;

    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.clientX;
    scrollLeft.current = container.scrollLeft;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const container = navContainerRef.current;
    if (!container) return;

    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 5) {
      hasDragged.current = true;
    }

    container.scrollLeft = scrollLeft.current - dx;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    setTimeout(() => {
      hasDragged.current = false;
    }, 50);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    setTimeout(() => {
      hasDragged.current = false;
    }, 50);
  };

  return (
    <nav className="bg-white dark:bg-slate-900">
      <div 
        ref={navContainerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="max-w-md mx-auto flex items-center gap-1.5 px-2.5 pt-0.5 pb-2 overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing select-none"
      >
        {tabs.map((tab) => {
          if (tab.permissionKey && !hasPermission(tab.permissionKey)) {
            return null;
          }
          if (tab.id === 'logs' && role !== 'tenant' && !showSecretTabs) {
            return null;
          }
          if (tab.id === 'logs' && role === 'tenant' && tenantData?.permissions?.showActivityLog === undefined && !showSecretTabs) {
            return null;
          }

          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              data-active={isActive ? 'true' : 'false'}
              onClick={(e) => {
                if (hasDragged.current) {
                  e.preventDefault();
                  return;
                }
                setActiveTab(tab.id);
              }}
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
                    : tab.id === 'logs'
                    ? 'bg-indigo-600 text-white shadow-2xs'
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
