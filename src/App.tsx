import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { VipPlansPage } from './pages/VipPlansPage';
import { InvestmentsPage } from './pages/InvestmentsPage';
import { WalletPage } from './pages/WalletPage';
import { DepositPage } from './pages/DepositPage';
import { WithdrawPage } from './pages/WithdrawPage';
import { TransferPage } from './pages/TransferPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { AiSupportPage } from './pages/AiSupportPage';
import { SecurityPage } from './pages/SecurityPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPortalPage } from './pages/AdminPortalPage';
import { AuthModal } from './components/auth/AuthModal';

const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'login' | 'register' }>({
    isOpen: false,
    mode: 'login',
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-xs font-semibold tracking-wider uppercase text-slate-400">
          Initializing Double-Entry Ledger Engine...
        </div>
      </div>
    );
  }

  // Unauthenticated view
  if (!isAuthenticated) {
    return (
      <>
        <LandingPage
          onLoginClick={() => setAuthModal({ isOpen: true, mode: 'login' })}
          onRegisterClick={() => setAuthModal({ isOpen: true, mode: 'register' })}
          onExploreVipClick={() => setAuthModal({ isOpen: true, mode: 'register' })}
        />
        <AuthModal
          isOpen={authModal.isOpen}
          onClose={() => setAuthModal({ ...authModal, isOpen: false })}
          initialMode={authModal.mode}
        />
      </>
    );
  }

  // Authenticated Dashboard Layout
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />}
          {activeTab === 'vip-plans' && <VipPlansPage />}
          {activeTab === 'investments' && <InvestmentsPage />}
          {activeTab === 'wallet' && <WalletPage onNavigate={(tab) => setActiveTab(tab)} />}
          {activeTab === 'deposit' && <DepositPage />}
          {activeTab === 'withdraw' && <WithdrawPage />}
          {activeTab === 'transfer' && <TransferPage onNavigate={(tab) => setActiveTab(tab)} />}
          {activeTab === 'transactions' && <TransactionsPage />}
          {activeTab === 'ai-support' && <AiSupportPage />}
          {activeTab === 'security' && <SecurityPage />}
          {activeTab === 'profile' && <ProfilePage onNavigate={(tab) => setActiveTab(tab)} />}
          {activeTab === 'admin' && user?.role === 'admin' && <AdminPortalPage />}
        </main>
      </div>

      <Footer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
