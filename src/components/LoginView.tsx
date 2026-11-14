import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Cloud, Lock, Eye, EyeOff, LogIn, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pin.trim()) {
      setError('يرجى إدخال رمز الدخول');
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(pin);
      if (!res.success) {
        setError(res.error || 'رمز الدخول غير صحيح');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden"
      dir="rtl"
    >
      {/* Subtle Ambient Glow */}
      <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6">
          {/* Neutral SaaS Header */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center shadow-lg">
              <Cloud size={40} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">
                النظام المحاسبي السحابي
              </h1>
              <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>بوابة الدخول الآمنة</span>
              </p>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                رمز الدخول السري (PIN Code)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="أدخل رمز الدخول..."
                  autoFocus
                  autoComplete="current-password"
                  className="w-full pr-10 pl-10 py-3 rounded-2xl bg-slate-800/90 border border-slate-700 text-white placeholder:text-slate-500 text-sm font-mono-num tracking-widest focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((prev) => !prev)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-sm shadow-lg shadow-indigo-900/30 flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>دخول النظام</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
