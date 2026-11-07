import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { PersonalContact, PersonalTransaction, PersonalTransactionType } from '../types';
import { formatCurrency, formatDateArabic, getTodayDateString, getMonthKeyFromDate } from '../utils/formatters';
import { ConfirmModal } from './ConfirmModal';
import { 
  UserCheck, 
  Users, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  Phone, 
  Calendar,
  Wallet,
  ShieldCheck,
  CreditCard,
  AlertCircle
} from 'lucide-react';

export const PersonalLedgerView: React.FC = () => {
  const { 
    personalContacts, 
    personalTransactions, 
    personalStats, 
    currency, 
    savePersonalContact, 
    removePersonalContact, 
    savePersonalTransaction, 
    removePersonalTransaction,
    showToast 
  } = useApp();

  const [subTab, setSubTab] = useState<'transactions' | 'contacts'>('transactions');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Contact Form Modal
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<PersonalContact | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', relationship: '', notes: '' });

  // Transaction Form Modal
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<PersonalTransaction | null>(null);
  const [txForm, setTxForm] = useState({
    contactId: '',
    type: 'loan_given' as PersonalTransactionType,
    amount: '',
    date: getTodayDateString(),
    notes: '',
  });

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'contact' | 'tx';
    id: string;
    title: string;
    message: string;
  } | null>(null);

  // Calculate per-contact personal balance
  const contactBalances = useMemo(() => {
    const map: Record<string, { lent: number; borrowed: number; net: number }> = {};
    personalContacts.forEach(c => {
      map[c.id] = { lent: 0, borrowed: 0, net: 0 };
    });

    personalTransactions.forEach(tx => {
      if (!tx.contactId) return;
      if (!map[tx.contactId]) {
        map[tx.contactId] = { lent: 0, borrowed: 0, net: 0 };
      }
      const b = map[tx.contactId];
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'loan_given') b.lent += amt;
      if (tx.type === 'loan_repaid') b.lent -= amt;
      if (tx.type === 'loan_taken') b.borrowed += amt;
      if (tx.type === 'debt_paid') b.borrowed -= amt;
      b.net = b.lent - b.borrowed;
    });

    return map;
  }, [personalContacts, personalTransactions]);

  // Open Contact Modal
  const handleOpenContactModal = (contact?: PersonalContact) => {
    if (contact) {
      setEditingContact(contact);
      setContactForm({
        name: contact.name,
        phone: contact.phone || '',
        relationship: contact.relationship || '',
        notes: contact.notes || '',
      });
    } else {
      setEditingContact(null);
      setContactForm({ name: '', phone: '', relationship: '', notes: '' });
    }
    setIsContactModalOpen(true);
  };

  const handleSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim()) return;

    await savePersonalContact({
      ...(editingContact ? { id: editingContact.id } : {}),
      name: contactForm.name.trim(),
      phone: contactForm.phone.trim(),
      relationship: contactForm.relationship.trim(),
      notes: contactForm.notes.trim(),
    });

    showToast(editingContact ? 'تم تعديل بيانات الشخص' : 'تمت إضافة الاسم للحساب الشخصي');
    setIsContactModalOpen(false);
    setEditingContact(null);
  };

  // Open Transaction Modal
  const handleOpenTxModal = (tx?: PersonalTransaction, preselectedContactId?: string) => {
    if (tx) {
      setEditingTx(tx);
      setTxForm({
        contactId: tx.contactId || '',
        type: tx.type,
        amount: String(tx.amount),
        date: tx.date,
        notes: tx.notes || '',
      });
    } else {
      setEditingTx(null);
      setTxForm({
        contactId: preselectedContactId || (personalContacts[0]?.id || ''),
        type: 'loan_given',
        amount: '',
        date: getTodayDateString(),
        notes: '',
      });
    }
    setIsTxModalOpen(true);
  };

  const handleSubmitTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(txForm.amount);
    if (!parsedAmount || parsedAmount <= 0) {
      alert('يرجى إدخال مبلغ صحيح');
      return;
    }

    const c = personalContacts.find(item => item.id === txForm.contactId);
    const cName = c ? c.name : undefined;
    const monthKey = getMonthKeyFromDate(txForm.date);

    await savePersonalTransaction({
      ...(editingTx ? { id: editingTx.id } : {}),
      contactId: txForm.contactId || undefined,
      contactName: cName,
      type: txForm.type,
      amount: parsedAmount,
      date: txForm.date,
      monthKey,
      notes: txForm.notes.trim(),
    });

    showToast(editingTx ? 'تم تعديل الحركة الشخصية' : 'تم تسجيل الحركة في الحساب الشخصي');
    setIsTxModalOpen(false);
    setEditingTx(null);
  };

  // Safe Deletion confirmation
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'contact') {
      await removePersonalContact(itemToDelete.id);
      showToast('تم حذف الاسم من الحساب الشخصي');
    } else {
      await removePersonalTransaction(itemToDelete.id);
      showToast('تم حذف الحركة وتحديث الأرصدة');
    }
    setItemToDelete(null);
  };

  // Filtered transactions
  const filteredTxs = useMemo(() => {
    return personalTransactions
      .filter(tx => {
        if (filterType !== 'all' && tx.type !== filterType) return false;
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
          (tx.contactName && tx.contactName.toLowerCase().includes(q)) ||
          (tx.notes && tx.notes.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [personalTransactions, filterType, searchTerm]);

  const getTypeInfo = (type: PersonalTransactionType) => {
    switch (type) {
      case 'loan_given':
        return { label: 'سلفية له (أطلبها منه)', color: 'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-900/60' };
      case 'loan_repaid':
        return { label: 'استرداد سلفية', color: 'text-emerald-800 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-900/60' };
      case 'loan_taken':
        return { label: 'استلفت منه (دين عليّ)', color: 'text-rose-800 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/40 dark:border-rose-900/60' };
      case 'debt_paid':
        return { label: 'سداد دين عليّ', color: 'text-teal-800 bg-teal-50 border-teal-200 dark:text-teal-300 dark:bg-teal-950/40 dark:border-teal-900/60' };
      case 'expense':
      case 'personal_expense':
        return { label: 'مصروف شخصي', color: 'text-red-800 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/40 dark:border-red-900/60' };
      case 'income':
      case 'personal_income':
        return { label: 'دخل شخصي', color: 'text-green-800 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-950/40 dark:border-green-900/60' };
    }
  };

  return (
    <div className="space-y-3.5 pb-24">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 rounded-2xl p-3.5 text-white shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-indigo-300 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>دفتر حساب شخصي مستقل تماماً</span>
            </div>
            <h2 className="text-base font-bold mt-0.5">الحساب الشخصي</h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => handleOpenContactModal()}
              className="bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1"
            >
              <Users className="w-3.5 h-3.5" />
              <span>+ اسم</span>
            </button>
            <button
              onClick={() => handleOpenTxModal()}
              className="bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ حركة</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white dark:bg-slate-800/95 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[10px] text-slate-500 dark:text-slate-300 block font-semibold">سلفيات مستحقة لي (أطلبها)</span>
          <span className="text-base font-black text-amber-700 dark:text-amber-400 font-mono-num">
            {formatCurrency(personalStats.totalLoansGiven, currency)}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800/95 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[10px] text-slate-500 dark:text-slate-300 block font-semibold">ديون عليّ للغير (مطلوبة مني)</span>
          <span className="text-base font-black text-rose-600 dark:text-rose-400 font-mono-num">
            {formatCurrency(personalStats.totalLoansTaken, currency)}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800/95 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[10px] text-slate-500 dark:text-slate-300 block font-semibold">المصاريف الشخصية</span>
          <span className="text-base font-black text-red-600 dark:text-red-400 font-mono-num">
            {formatCurrency(personalStats.totalPersonalExpenses, currency)}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800/95 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[10px] text-slate-500 dark:text-slate-300 block font-semibold">الدخل والإيرادات الشخصية</span>
          <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono-num">
            {formatCurrency(personalStats.totalPersonalIncome, currency)}
          </span>
        </div>
      </div>

      {/* Sub Tabs Selector */}
      <div className="grid grid-cols-2 gap-1.5 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-xl text-xs border border-transparent dark:border-slate-700/60">
        <button
          onClick={() => setSubTab('transactions')}
          className={`py-1.5 rounded-lg font-bold transition-all ${
            subTab === 'transactions' 
              ? 'bg-indigo-600 text-white shadow-2xs' 
              : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          سجل الحركات ({personalTransactions.length})
        </button>

        <button
          onClick={() => setSubTab('contacts')}
          className={`py-1.5 rounded-lg font-bold transition-all ${
            subTab === 'contacts' 
              ? 'bg-indigo-600 text-white shadow-2xs' 
              : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          الأسماء والأشخاص ({personalContacts.length})
        </button>
      </div>

      {/* View 1: Transactions Sub-Tab */}
      {subTab === 'transactions' && (
        <div className="space-y-2.5">
          {/* Search & Type filter */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="بحث بالاسم أو الملاحظات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="all">كل الحركات</option>
              <option value="loan_given">سلفيات لي</option>
              <option value="loan_repaid">استرداد سلفيات</option>
              <option value="loan_taken">ديون عليّ</option>
              <option value="debt_paid">سداد ديون</option>
              <option value="personal_expense">مصاريف خاصة</option>
              <option value="personal_income">دخل شخصي</option>
            </select>
          </div>

          {/* List */}
          <div className="space-y-2">
            {filteredTxs.map((tx) => {
              const typeInfo = getTypeInfo(tx.type);
              return (
                <div
                  key={tx.id}
                  className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-3 shadow-2xs flex items-center justify-between gap-2 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {tx.contactName && (
                        <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{tx.contactName}</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-md border font-bold ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      <span>{formatDateArabic(tx.date)}</span>
                      {tx.notes && (
                        <>
                          <span>•</span>
                          <span className="text-slate-600 dark:text-slate-300 truncate">{tx.notes}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono-num font-black text-slate-900 dark:text-white text-sm">
                      {formatCurrency(tx.amount, currency)}
                    </span>

                    <button
                      onClick={() => handleOpenTxModal(tx)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setItemToDelete({
                        type: 'tx',
                        id: tx.id,
                        title: 'حذف الحركة الشخصية',
                        message: 'هل أنت متأكد من حذف هذه الحركة؟ سيتم تعديل رصيد الحساب تلقائياً.',
                      })}
                      className="p-1 text-rose-400 hover:text-rose-600 dark:hover:text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredTxs.length === 0 && (
              <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
                <UserCheck className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">لا توجد حركات مسجلة</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">سجل سلفياتك ومصاريفك الشخصية بسهولة.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View 2: Contacts Sub-Tab */}
      {subTab === 'contacts' && (
        <div className="space-y-2.5">
          {personalContacts.map((contact) => {
            const b = contactBalances[contact.id] || { lent: 0, borrowed: 0, net: 0 };
            const isOwed = b.net > 0;
            const owesThem = b.net < 0;

            return (
              <div
                key={contact.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-3.5 shadow-2xs transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">{contact.name}</h3>
                    {contact.relationship && (
                      <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded inline-block mt-0.5 border border-indigo-100 dark:border-indigo-900/40">
                        {contact.relationship}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenContactModal(contact)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setItemToDelete({
                        type: 'contact',
                        id: contact.id,
                        title: `حذف "${contact.name}" من الحساب الشخصي`,
                        message: 'هل أنت متأكد من حذف هذا الاسم؟',
                      })}
                      className="p-1 text-rose-400 hover:text-rose-600 dark:hover:text-rose-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Balances */}
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-2.5 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs my-2">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">سلفيات له</span>
                    <span className="font-bold font-mono-num text-amber-700 dark:text-amber-400">{formatCurrency(b.lent, currency)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">ديون عليّ له</span>
                    <span className="font-bold font-mono-num text-rose-600 dark:text-rose-400">{formatCurrency(b.borrowed, currency)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">الصافي</span>
                    <span className={`font-black font-mono-num ${isOwed ? 'text-amber-700 dark:text-amber-400' : owesThem ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {isOwed ? `له عليّ دين: ${formatCurrency(b.net, currency)}` : owesThem ? `عليّ له: ${formatCurrency(Math.abs(b.net), currency)}` : 'خالص'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenTxModal(undefined, contact.id)}
                  className="w-full py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-colors border border-indigo-100 dark:border-indigo-900/30"
                >
                  + تسجيل حركة لهذا الشخص
                </button>
              </div>
            );
          })}

          {personalContacts.length === 0 && (
            <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
              <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">لا يوجد أسماء مضافة</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">أضف الأشخاص لتسجيل الديون والسلفيات الخاصة بهم.</p>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{editingContact ? 'تعديل اسم' : 'إضافة شخص للحساب الشخصي'}</span>
              </h3>
              <button onClick={() => setIsContactModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitContact} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الاسم *</label>
                <input
                  type="text"
                  required
                  placeholder=""
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الصفة أو صلة القرابة</label>
                <input
                  type="text"
                  placeholder=""
                  value={contactForm.relationship}
                  onChange={(e) => setContactForm({ ...contactForm, relationship: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  dir="ltr"
                  placeholder=""
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-right"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  {editingContact ? 'حفظ التعديل' : 'إضافة الاسم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Transaction Modal */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{editingTx ? 'تعديل حركة شخصية' : 'تسجيل حركة شخصية جديدة'}</span>
              </h3>
              <button onClick={() => setIsTxModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTx} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">نوع الحركة *</label>
                <select
                  value={txForm.type}
                  onChange={(e) => setTxForm({ ...txForm, type: e.target.value as PersonalTransactionType })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
                >
                  <option value="loan_given">سلفية له (أسلفت مالاً لشخص)</option>
                  <option value="loan_repaid">استرداد سلفية (استرددت مالاً)</option>
                  <option value="loan_taken">استلفت منه (دين شخصي عليّ للغير)</option>
                  <option value="debt_paid">سداد دين عليّ (سددت للغير)</option>
                  <option value="personal_expense">مصروف شخصي (مصاريف خاصة)</option>
                  <option value="personal_income">دخل شخصي (إيراد خاص)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الشخص المرتبط (اختياري)</label>
                <select
                  value={txForm.contactId}
                  onChange={(e) => setTxForm({ ...txForm, contactId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
                >
                  <option value="">-- بدون شخص محدد (عام) --</option>
                  {personalContacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">المبلغ *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    placeholder=""
                    value={txForm.amount}
                    onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-mono-num text-left font-bold text-base"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500">
                    {currency}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">التاريخ *</label>
                <input
                  type="date"
                  required
                  value={txForm.date}
                  onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-mono-num"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظات توضيحية</label>
                <input
                  type="text"
                  placeholder=""
                  value={txForm.notes}
                  onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsTxModalOpen(false)}
                  className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  {editingTx ? 'حفظ التعديل' : 'تسجيل الحركة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(itemToDelete)}
        title={itemToDelete?.title || ''}
        message={itemToDelete?.message || ''}
        onConfirm={handleConfirmDelete}
        onClose={() => setItemToDelete(null)}
      />

    </div>
  );
};
