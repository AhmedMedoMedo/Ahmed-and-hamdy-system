import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Activity, 
  Users, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  LogIn, 
  Clock, 
  Search, 
  FileText, 
  Package, 
  Truck, 
  CreditCard, 
  Receipt,
  UserCheck
} from 'lucide-react';
import { getTimeAgoArabic } from '../utils/formatters';

export const ActivityLogView: React.FC = () => {
  const { systemLogs } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'add' | 'edit' | 'delete'>('all');

  // Filter logs
  const filteredLogs = useMemo(() => {
    return systemLogs.filter(log => {
      const matchAction = actionFilter === 'all' || log.action === actionFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q || 
        log.userName.toLowerCase().includes(q) ||
        log.target.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q);
      return matchAction && matchSearch;
    });
  }, [systemLogs, actionFilter, searchQuery]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'add':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <PlusCircle className="w-2.5 h-2.5" />
            <span>إضافة</span>
          </span>
        );
      case 'edit':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <Edit3 className="w-2.5 h-2.5" />
            <span>تعديل</span>
          </span>
        );
      case 'delete':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <Trash2 className="w-2.5 h-2.5" />
            <span>حذف</span>
          </span>
        );
      case 'login':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <LogIn className="w-2.5 h-2.5" />
            <span>دخول</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {action}
          </span>
        );
    }
  };

  const getTargetIcon = (target: string) => {
    if (target.includes('فاتورة')) return <Receipt className="w-3.5 h-3.5 text-blue-500" />;
    if (target.includes('دفعة')) return <CreditCard className="w-3.5 h-3.5 text-emerald-500" />;
    if (target.includes('طلب')) return <Truck className="w-3.5 h-3.5 text-indigo-500" />;
    if (target.includes('منتج')) return <Package className="w-3.5 h-3.5 text-amber-500" />;
    if (target.includes('تاجر')) return <Users className="w-3.5 h-3.5 text-violet-500" />;
    if (target.includes('شخصي')) return <UserCheck className="w-3.5 h-3.5 text-teal-500" />;
    return <FileText className="w-3.5 h-3.5 text-slate-500" />;
  };

  return (
    <div className="space-y-3 pb-8" dir="rtl">
      {/* Page Header */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800/90 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-700 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">سجل نشاط العمليات</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">تتبع سري لكافة العمليات المنفذة في النظام</p>
          </div>
        </div>
        <span className="text-xs font-bold font-mono-num px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
          {systemLogs.length} حركة
        </span>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 shadow-2xs space-y-2.5">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في سجل العمليات واسم المستخدم..."
            className="w-full pr-8 pl-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'add', label: 'إضافات' },
            { id: 'edit', label: 'تعديلات' },
            { id: 'delete', label: 'حذفيات' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActionFilter(tab.id as any)}
              className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all ${
                actionFilter === tab.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <span className="mr-auto text-[11px] font-bold text-slate-400 dark:text-slate-500 font-mono-num shrink-0">
            {filteredLogs.length} عملية
          </span>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700 shadow-2xs">
            <Activity className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
              لا توجد عمليات مسجلة حتى الآن
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              سيتم تسجيل كافة الفواتير، الدفعات، وتعديلات الطلبات هنا لحظياً مع اسم القائم بها.
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const timeAgo = getTimeAgoArabic(log.timestamp);
            return (
              <div
                key={log.id}
                className="bg-white dark:bg-slate-800/90 rounded-2xl p-3 border border-slate-200 dark:border-slate-700/80 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition-all space-y-1.5"
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {getActionBadge(log.action)}
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/70 px-2 py-0.5 rounded-md">
                      {getTargetIcon(log.target)}
                      <span>{log.target}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono-num">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{timeAgo}</span>
                  </div>
                </div>

                {/* Details text */}
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                  {log.details}
                </p>

                {/* User footer */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/50 text-[10px]">
                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-bold">
                    <UserCheck className="w-3 h-3 text-indigo-500 shrink-0" />
                    <span>بواسطة:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                      {log.userName}
                    </span>
                  </div>

                  <span className="text-slate-400 font-mono-num text-[9px]">
                    {new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActivityLogView;
