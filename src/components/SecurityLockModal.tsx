import React, { useState } from 'react';
import { ShieldCheck, Lock, Unlock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

interface SecurityLockModalProps {
  isOpen: boolean;
  correctPin: string;
  onUnlock: () => void;
  storeName: string;
}

export const SecurityLockModal: React.FC<SecurityLockModalProps> = ({
  isOpen,
  correctPin,
  onUnlock,
  storeName
}) => {
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pinInput.trim() === correctPin.trim()) {
      setErrorMsg(null);
      onUnlock();
    } else {
      setErrorMsg('رمز المرور غير صحيح، يرجى التأكد والمحاولة مرة أخرى.');
    }
  };

  const handleKeyPress = (num: string) => {
    if (pinInput.length < 8) {
      const next = pinInput + num;
      setPinInput(next);
      setErrorMsg(null);
      if (next === correctPin) {
        setTimeout(() => onUnlock(), 100);
      }
    }
  };

  const handleDelete = () => {
    setPinInput(prev => prev.slice(0, -1));
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
        
        {/* Lock Icon Header */}
        <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-3 shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        <h3 className="font-black text-lg text-slate-900 dark:text-white mb-1">
          {storeName || 'نظام حسابات أحمد وحمدي'}
        </h3>
        
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
          نظام محاسبي سحابي محمي ومشفّر. أدخل رمز المرور السري للدخول على الحسابات والفواتير من هذا الجهاز.
        </p>

        {/* PIN Input Display */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="relative max-w-[200px] mx-auto">
            <input
              type={showPin ? 'text' : 'password'}
              maxLength={8}
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setErrorMsg(null);
                if (e.target.value === correctPin) {
                  setTimeout(() => onUnlock(), 100);
                }
              }}
              placeholder="••••"
              className="w-full text-center text-2xl font-mono tracking-widest py-2.5 px-3 rounded-2xl border-2 border-emerald-500/50 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-center justify-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs font-bold animate-shake">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Keypad for mobile convenience */}
          <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'مسح', '0', 'دخول'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  if (k === 'مسح') handleDelete();
                  else if (k === 'دخول') handleVerify();
                  else handleKeyPress(k);
                }}
                className={`py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                  k === 'دخول'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                    : k === 'مسح'
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-1 font-medium flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>نظام مشفر ومحمي برمز وصول سري</span>
          </div>
        </form>

      </div>
    </div>
  );
};
