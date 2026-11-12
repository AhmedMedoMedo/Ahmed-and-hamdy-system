import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, X, Share2, PlusSquare } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { installPrompt, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  // If already installed, hide the button
  if (isInstalled) {
    return null;
  }

  // If Android/Chrome/Desktop and install prompt is available
  if (!isIOS && installPrompt) {
    return (
      <button
        onClick={promptInstall}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white text-[11px] sm:text-xs font-bold shadow-xs transition-all shrink-0 cursor-pointer animate-pulse hover:animate-none"
        title="تثبيت التطبيق على جهازك للعمل دون إنترنت"
      >
        <Download className="w-3.5 h-3.5" />
        <span>تثبيت التطبيق</span>
      </button>
    );
  }

  // If iOS device (Safari)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-blue-600 dark:text-blue-400 text-[11px] sm:text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all shrink-0 cursor-pointer"
          title="تثبيت التطبيق على أجهزة الآيفون والآيباد"
        >
          <Download className="w-3.5 h-3.5" />
          <span>تثبيت التطبيق</span>
        </button>

        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" dir="rtl">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-right animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>تثبيت التطبيق على آيفون / آيباد</span>
                </h3>
                <button 
                  onClick={() => setShowIOSModal(false)} 
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-3">
                <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold shrink-0 text-[11px]">1</span>
                  <span>اضغط على زر <strong>المشاركة (Share)</strong> <Share2 className="w-3.5 h-3.5 inline text-blue-500 mx-1" /> في شريط متصفح سفاري بالأسفل.</span>
                </div>

                <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold shrink-0 text-[11px]">2</span>
                  <span>مرر للأسفل واختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong> <PlusSquare className="w-3.5 h-3.5 inline text-blue-500 mx-1" />.</span>
                </div>

                <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold shrink-0 text-[11px]">3</span>
                  <span>اضغط على <strong>إضافة (Add)</strong> أعلى الشاشة، وسيظهر التطبيق على شاشتك الرئيسية ويعمل بدون إنترنت!</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSModal(false)}
                className="mt-4 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
