import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Plus } from 'lucide-react';

export interface SearchOption {
  id: string;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeColor?: string;
}

interface SearchableSelectProps {
  options: SearchOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  required?: boolean;
  emptyMessage?: string;
  onAddNew?: () => void;
  addNewText?: string;
  accentColor?: 'emerald' | 'teal' | 'indigo' | 'rose';
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'اختر...',
  searchPlaceholder = 'ابحث بالاسم من أول حرف...',
  label,
  required = false,
  emptyMessage = 'لا توجد نتائج مطابقة',
  onAddNew,
  addNewText = '+ إضافة جديد',
  accentColor = 'emerald',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selected Option
  const selectedOption = useMemo(() => {
    return options.find(o => o.id === value);
  }, [options, value]);

  // Filtered options from the very first letter
  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(o => 
      o.label.toLowerCase().includes(q) || 
      (o.subLabel && o.subLabel.toLowerCase().includes(q))
    );
  }, [options, query]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setQuery('');
  };

  const ringColor = {
    emerald: 'focus:border-emerald-500 focus:ring-emerald-500',
    teal: 'focus:border-teal-500 focus:ring-teal-500',
    indigo: 'focus:border-indigo-500 focus:ring-indigo-500',
    rose: 'focus:border-rose-500 focus:ring-rose-500',
  }[accentColor];

  const activeBg = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300',
    teal: 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300',
    rose: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300',
  }[accentColor];

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-right rounded-xl border transition-all flex items-center justify-between gap-2 text-xs sm:text-sm ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-white dark:bg-slate-800'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-600'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {selectedOption ? (
            <div className="min-w-0 flex items-center gap-1.5 flex-1">
              <span className="font-bold text-slate-900 dark:text-white truncate">
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-md font-bold shrink-0 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono-num">
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 truncate">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu with Instant Search Filter */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          
          {/* Search Input Box */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-7 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Add New Trigger if supplied */}
            {onAddNew && (
              <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400">غير موجود بالقائمة؟</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onAddNew();
                  }}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>{addNewText}</span>
                </button>
              </div>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-52 overflow-y-auto p-1 space-y-0.5 text-xs">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={`w-full p-2 rounded-xl text-right flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? activeBg
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="min-w-0 pr-1 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold font-mono-num ${
                            opt.badgeColor || 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}>
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subLabel && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate mt-0.5 font-mono-num">
                          {opt.subLabel}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="py-4 text-center text-xs text-slate-400">
                <p>{emptyMessage}</p>
                {onAddNew && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onAddNew();
                    }}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{addNewText}</span>
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
