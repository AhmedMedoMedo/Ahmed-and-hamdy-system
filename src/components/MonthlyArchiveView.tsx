import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/formatters';
import { 
  Archive, 
  Calendar, 
  CheckCircle2,
  ChevronLeft
} from 'lucide-react';

export const MonthlyArchiveView: React.FC = () => {
  const { allMonthsArchive, selectedMonth, setSelectedMonth, setActiveTab, currency, showToast } = useApp();
  const [monthFilter, setMonthFilter] = useState('all');

  const handleSelectMonth = (monthKey: string) => {
    setSelectedMonth(monthKey);
    showToast(`تم التبديل إلى شهر ${monthKey}`);
    setActiveTab('dashboard');
  };

  const displayedMonths = monthFilter === 'all'
    ? allMonthsArchive
    : allMonthsArchive.filter((m) => m.monthKey === monthFilter);

  return (
    <div className="space-y-3.5 pb-24">
      
      {/* Header */}
      <div className="pt-1">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <Archive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>أرشيف وسجل الشهور</span>
          <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono-num font-bold">
            {allMonthsArchive.length} شهور
          </span>
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          متابعة ترحيل الحسابات التاريخي والتبديل السريع بين الشهور
        </p>
      </div>

      {/* Explanatory Banner */}
      <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-3 text-emerald-950 dark:text-emerald-200 text-xs flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          تبدأ أرقام المبيعات والتحصيلات في كل شهر جديد بصفر، وترحل ديون التجار السابقة آلياً كرصيد افتتاحي.
        </p>
      </div>

      {/* Month Filter Selector */}
      <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shrink-0">
          <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>تصفية الشهور:</span>
        </label>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="flex-1 max-w-xs px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer font-bold"
        >
          <option value="all">عرض كل الأرشيف ({allMonthsArchive.length})</option>
          {allMonthsArchive.map((m) => (
            <option key={m.monthKey} value={m.monthKey}>
              {m.monthName} ({m.monthKey})
            </option>
          ))}
        </select>
      </div>

      {/* Months Archive Cards (1 col for mobile) */}
      <div className="space-y-2.5">
        {displayedMonths.map((month) => {
          const isSelected = month.monthKey === selectedMonth;

          return (
            <div
              key={month.monthKey}
              className={`rounded-2xl border p-3.5 transition-all shadow-2xs ${
                isSelected
                  ? 'bg-white dark:bg-slate-800 border-emerald-500 dark:border-emerald-500/80 ring-2 ring-emerald-500/20'
                  : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {/* Month Name & Active Badge */}
              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5">
                  <Calendar className={`w-4 h-4 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">{month.monthName}</h3>
                </div>

                {isSelected ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold">
                    الشهر النشط
                  </span>
                ) : (
                  <span className="text-[11px] font-mono-num text-slate-400 dark:text-slate-500">
                    {month.monthKey}
                  </span>
                )}
              </div>

              {/* 4 Numbers Grid */}
              <div className="grid grid-cols-2 gap-1.5 text-xs mb-2.5">
                <div className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] block">مبيعات هذا الشهر</span>
                  <span className="font-bold font-mono-num text-slate-900 dark:text-white text-xs">
                    {formatCurrency(month.newSales, currency)}
                  </span>
                </div>

                <div className="p-2 bg-teal-50/50 dark:bg-teal-950/20 rounded-xl border border-teal-100 dark:border-teal-900/40">
                  <span className="text-teal-800 dark:text-teal-300 text-[10px] block">تحصيلات هذا الشهر</span>
                  <span className="font-bold font-mono-num text-teal-700 dark:text-teal-400 text-xs">
                    {formatCurrency(month.newCollections, currency)}
                  </span>
                </div>

                <div className="p-2 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40">
                  <span className="text-amber-800 dark:text-amber-300 text-[10px] block">ديون مرحّلة سابقة</span>
                  <span className="font-bold font-mono-num text-amber-700 dark:text-amber-400 text-xs">
                    {formatCurrency(month.carriedForwardDebt, currency)}
                  </span>
                </div>

                <div className="p-2 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/40">
                  <span className="text-rose-800 dark:text-rose-300 text-[10px] block">صافي الدين النهائي</span>
                  <span className="font-bold font-mono-num text-rose-600 dark:text-rose-400 text-xs">
                    {formatCurrency(month.endingDebt, currency)}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleSelectMonth(month.monthKey)}
                className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                  isSelected
                    ? 'bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                }`}
              >
                <span>{isSelected ? 'أنت تعرض هذا الشهر حالياً' : 'الانتقال وعرض تفاصيل هذا الشهر'}</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {displayedMonths.length === 0 && (
          <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-xs">
            لا توجد بيانات مسجلة لهذا الشهر المحدد.
          </div>
        )}
      </div>

    </div>
  );
};
