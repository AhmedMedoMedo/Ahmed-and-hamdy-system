import React from 'react';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/formatters';
import { 
  Archive, 
  Calendar, 
  TrendingUp, 
  HandCoins, 
  Clock, 
  AlertCircle, 
  CheckCircle2,
  ChevronLeft
} from 'lucide-react';

export const MonthlyArchiveView: React.FC = () => {
  const { allMonthsArchive, selectedMonth, setSelectedMonth, setActiveTab, currency, showToast } = useApp();

  const handleSelectMonth = (monthKey: string) => {
    setSelectedMonth(monthKey);
    showToast(`تم التبديل إلى شهر ${monthKey}`);
    setActiveTab('dashboard');
  };

  return (
    <div className="space-y-3.5 pb-24">
      
      {/* Header */}
      <div className="pt-1">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-1.5">
          <Archive className="w-5 h-5 text-emerald-600" />
          <span>أرشيف وسجل الشهور</span>
          <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono-num font-bold">
            {allMonthsArchive.length} شهور
          </span>
        </h2>
        <p className="text-[11px] text-slate-500">
          متابعة ترحيل الحسابات التاريخي والتبديل السريع بين الشهور
        </p>
      </div>

      {/* Explanatory Banner */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 text-emerald-950 text-xs flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          تبدأ أرقام المبيعات والتحصيلات في كل شهر جديد بصفر، وترحل ديون التجار السابقة آلياً كرصيد افتتاحي.
        </p>
      </div>

      {/* Months Archive Cards (1 col for mobile) */}
      <div className="space-y-2.5">
        {allMonthsArchive.map((month) => {
          const isSelected = month.monthKey === selectedMonth;

          return (
            <div
              key={month.monthKey}
              className={`rounded-2xl border p-3.5 transition-all shadow-2xs ${
                isSelected
                  ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}
            >
              {/* Month Name & Active Badge */}
              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <Calendar className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <h3 className="font-bold text-sm text-slate-900">{month.monthName}</h3>
                </div>

                {isSelected ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold">
                    الشهر النشط
                  </span>
                ) : (
                  <span className="text-[11px] font-mono-num text-slate-400">
                    {month.monthKey}
                  </span>
                )}
              </div>

              {/* 4 Numbers Grid */}
              <div className="grid grid-cols-2 gap-1.5 text-xs mb-2.5">
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500 text-[10px] block">مبيعات هذا الشهر</span>
                  <span className="font-bold font-mono-num text-slate-900 text-xs">
                    {formatCurrency(month.newSales, currency)}
                  </span>
                </div>

                <div className="p-2 bg-teal-50/50 rounded-xl border border-teal-100">
                  <span className="text-teal-800 text-[10px] block">تحصيلات هذا الشهر</span>
                  <span className="font-bold font-mono-num text-teal-700 text-xs">
                    {formatCurrency(month.newCollections, currency)}
                  </span>
                </div>

                <div className="p-2 bg-amber-50/50 rounded-xl border border-amber-100">
                  <span className="text-amber-800 text-[10px] block">ديون مرحّلة سابقة</span>
                  <span className="font-bold font-mono-num text-amber-700 text-xs">
                    {formatCurrency(month.carriedForwardDebt, currency)}
                  </span>
                </div>

                <div className="p-2 bg-rose-50/50 rounded-xl border border-rose-100">
                  <span className="text-rose-800 text-[10px] block">صافي الدين النهائي</span>
                  <span className="font-bold font-mono-num text-rose-600 text-xs">
                    {formatCurrency(month.endingDebt, currency)}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleSelectMonth(month.monthKey)}
                className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                  isSelected
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                }`}
              >
                <span>{isSelected ? 'أنت تعرض هذا الشهر حالياً' : 'الانتقال وعرض تفاصيل هذا الشهر'}</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
};
