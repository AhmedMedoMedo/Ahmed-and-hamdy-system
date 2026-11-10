import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { TopNav } from './components/TopNav';
import { DashboardView } from './components/DashboardView';
import { MerchantsView } from './components/MerchantsView';
import { ProductsView } from './components/ProductsView';
import { InvoicesView } from './components/InvoicesView';
import { PaymentsView } from './components/PaymentsView';
import { WorkOrdersView } from './components/WorkOrdersView';
import { PersonalLedgerView } from './components/PersonalLedgerView';
import { MonthlyArchiveView } from './components/MonthlyArchiveView';
import { MerchantDebtsView } from './components/MerchantDebtsView';
import { RecycleBinView } from './components/RecycleBinView';
import { PrintModal } from './components/PrintModal';
import { SettingsModal } from './components/SettingsModal';
import { SecurityLockModal } from './components/SecurityLockModal';
import type { Invoice, Payment, Product, WorkOrder, Expense, MerchantStatementPrintData } from './types';
import { CheckCircle2 } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    currency, 
    toastMessage, 
    isLocked, 
    unlockSystem, 
    systemPin, 
    storeName 
  } = useApp();

  // Modals & Navigation triggers
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [printableInvoice, setPrintableInvoice] = useState<Invoice | null>(null);
  const [printablePayment, setPrintablePayment] = useState<Payment | null>(null);
  const [printableOrder, setPrintableOrder] = useState<WorkOrder | null>(null);
  const [printableExpense, setPrintableExpense] = useState<Expense | null>(null);
  const [printableMerchantStatement, setPrintableMerchantStatement] = useState<MerchantStatementPrintData | null>(null);

  // Cross-view deep links
  const [selectedMerchantForView, setSelectedMerchantForView] = useState<string | null>(null);
  const [autoOpenInvoice, setAutoOpenInvoice] = useState(false);
  const [editingInvoiceForView, setEditingInvoiceForView] = useState<Invoice | null>(null);
  const [invoiceMerchantId, setInvoiceMerchantId] = useState<string | null>(null);
  const [invoicePreselectedProduct, setInvoicePreselectedProduct] = useState<Product | null>(null);

  const [autoOpenPayment, setAutoOpenPayment] = useState(false);
  const [editingPaymentForView, setEditingPaymentForView] = useState<Payment | null>(null);
  const [paymentMerchantId, setPaymentMerchantId] = useState<string | null>(null);

  // Quick action from dashboard or merchants
  const handleOpenNewInvoice = (merchantId?: string, product?: Product) => {
    setInvoiceMerchantId(merchantId || null);
    setInvoicePreselectedProduct(product || null);
    setEditingInvoiceForView(null);
    setAutoOpenInvoice(true);
    setActiveTab('invoices');
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoiceForView(invoice);
    setActiveTab('invoices');
  };

  const handleOpenNewPayment = (merchantId?: string) => {
    setPaymentMerchantId(merchantId || null);
    setEditingPaymentForView(null);
    setAutoOpenPayment(true);
    setActiveTab('payments');
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPaymentForView(payment);
    setActiveTab('payments');
  };

  const handleSelectMerchant = (merchantId: string) => {
    setSelectedMerchantForView(merchantId);
    setActiveTab('merchants');
  };

  return (
    <div className="min-h-screen bg-slate-200/60 dark:bg-slate-950 font-sans transition-colors duration-200" dir="rtl">
      
      {/* Mobile-Only Application Frame */}
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col relative shadow-2xl border-x border-slate-200 dark:border-slate-800">
        
        {/* Toast Notification Banner */}
        {toastMessage && (
          <div className="fixed top-14 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-slate-900/95 dark:bg-slate-800/95 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-xl border border-slate-800 dark:border-slate-700 flex items-center gap-2 max-w-sm pointer-events-auto backdrop-blur-xs font-mono-num">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Top Header & Navigation Bar (Seamlessly attached to Archive Date) */}
        <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-2xs">
          <Header onOpenSettings={() => setIsSettingsOpen(true)} />
          <TopNav />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 px-3 pt-3 pb-8">
          {activeTab === 'dashboard' && (
            <DashboardView
              onOpenNewInvoice={() => handleOpenNewInvoice()}
              onOpenNewPayment={() => handleOpenNewPayment()}
              onOpenNewMerchant={() => {
                setSelectedMerchantForView(null);
                setActiveTab('merchants');
              }}
              onOpenNewProduct={() => setActiveTab('products')}
              onOpenNewOrder={() => setActiveTab('orders')}
              onSelectMerchant={handleSelectMerchant}
              onEditInvoice={handleEditInvoice}
              onEditPayment={handleEditPayment}
              onPrintInvoice={(inv) => setPrintableInvoice(inv)}
              onPrintPayment={(pay) => setPrintablePayment(pay)}
              onPrintOrder={(ord) => setPrintableOrder(ord)}
              onPrintExpense={(exp) => setPrintableExpense(exp)}
            />
          )}

          {activeTab === 'orders' && (
            <WorkOrdersView 
              onSelectMerchant={handleSelectMerchant}
              onPrintInvoice={(inv) => setPrintableInvoice(inv)}
              onPrintOrder={(ord) => setPrintableOrder(ord)}
            />
          )}

          {activeTab === 'debts' && (
            <MerchantDebtsView
              onSelectMerchant={handleSelectMerchant}
              onOpenNewPayment={(merchantId) => handleOpenNewPayment(merchantId)}
              onOpenNewInvoice={(merchantId) => handleOpenNewInvoice(merchantId)}
            />
          )}

          {activeTab === 'merchants' && (
            <MerchantsView
              initialSelectedMerchantId={selectedMerchantForView}
              onClearSelectedMerchant={() => setSelectedMerchantForView(null)}
              onOpenNewInvoiceWithMerchant={(mId) => handleOpenNewInvoice(mId)}
              onOpenNewPaymentWithMerchant={(mId) => handleOpenNewPayment(mId)}
              onEditInvoice={handleEditInvoice}
              onEditPayment={handleEditPayment}
              onPrintInvoice={(inv) => setPrintableInvoice(inv)}
              onPrintPayment={(pay) => setPrintablePayment(pay)}
              onPrintMerchantStatement={(stmt) => setPrintableMerchantStatement(stmt)}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesView
              initialOpenCreate={autoOpenInvoice}
              initialEditingInvoice={editingInvoiceForView}
              initialMerchantId={invoiceMerchantId}
              initialProduct={invoicePreselectedProduct}
              onClearInitialCreate={() => {
                setAutoOpenInvoice(false);
                setEditingInvoiceForView(null);
                setInvoiceMerchantId(null);
                setInvoicePreselectedProduct(null);
              }}
              onPrintInvoice={(inv) => setPrintableInvoice(inv)}
              onSelectMerchant={handleSelectMerchant}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentsView
              initialOpenCreate={autoOpenPayment}
              initialEditingPayment={editingPaymentForView}
              initialMerchantId={paymentMerchantId}
              onClearInitialCreate={() => {
                setAutoOpenPayment(false);
                setEditingPaymentForView(null);
                setPaymentMerchantId(null);
              }}
              onPrintPayment={(pay) => setPrintablePayment(pay)}
              onSelectMerchant={handleSelectMerchant}
            />
          )}

          {activeTab === 'products' && (
            <ProductsView
              onSellProduct={(product) => handleOpenNewInvoice(undefined, product)}
            />
          )}

          {activeTab === 'personal' && (
            <PersonalLedgerView />
          )}

          {activeTab === 'archive' && (
            <MonthlyArchiveView />
          )}

          {activeTab === 'recycle_bin' && (
            <RecycleBinView />
          )}
        </main>

        {/* Settings Modal */}
        {isSettingsOpen && (
          <SettingsModal onClose={() => setIsSettingsOpen(false)} />
        )}

        {/* Printable Invoice / Payment / Order / Expense / Merchant Statement Modal */}
        {(printableInvoice || printablePayment || printableOrder || printableExpense || printableMerchantStatement) && (
          <PrintModal
            invoice={printableInvoice}
            payment={printablePayment}
            order={printableOrder}
            expense={printableExpense}
            merchantStatement={printableMerchantStatement}
            currency={currency}
            onClose={() => {
              setPrintableInvoice(null);
              setPrintablePayment(null);
              setPrintableOrder(null);
              setPrintableExpense(null);
              setPrintableMerchantStatement(null);
            }}
          />
        )}

        {/* Security Lock Modal (PIN Prompt) */}
        <SecurityLockModal
          isOpen={isLocked}
          correctPin={systemPin}
          onUnlock={unlockSystem}
          storeName={storeName}
        />

      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
