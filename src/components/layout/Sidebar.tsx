import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Send,
  History,
  Sparkles,
  Lock,
  ShieldAlert,
  Headphones,
  User as UserIcon,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, onClose }) => {
  const { user } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profile', label: 'My Profile', icon: UserIcon },
    { id: 'vip-plans', label: 'VIP Plans', icon: TrendingUp },
    { id: 'investments', label: 'My Investments', icon: Briefcase },
    { id: 'wallet', label: 'USD Wallet', icon: Wallet },
    { id: 'deposit', label: 'Deposit Funds', icon: ArrowDownLeft },
    { id: 'withdraw', label: 'Withdraw USD', icon: ArrowUpRight },
    { id: 'transfer', label: 'Internal Transfer', icon: Send },
    { id: 'transactions', label: 'Transaction History', icon: History },
    { id: 'ai-support', label: 'AI Assistant', icon: Sparkles, badge: 'AI' },
    { id: 'security', label: 'Security & PIN', icon: Lock },
  ];

  if (user?.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Admin Portal', icon: ShieldAlert, badge: 'ADMIN' });
  }

  const handleSelect = (id: string) => {
    setActiveTab(id);
    onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" />
      )}

      <aside
        className={`fixed lg:static top-16 left-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800/80 z-40 flex flex-col justify-between p-4 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="space-y-1 overflow-y-auto">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-3 mb-2">
            Platform Operations
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-xs transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      item.badge === 'ADMIN'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Security / System status footer */}
        <div className="pt-4 border-t border-slate-800/80">
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-xs text-slate-400">
            <div className="flex items-center gap-2 font-semibold text-slate-300 mb-1">
              <Headphones className="w-3.5 h-3.5 text-emerald-400" />
              <span>VeryFine Security 24/7</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-80">
              4-digit PIN verification & double-entry financial ledger active.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
