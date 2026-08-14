import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Wallet, Bell, LogOut, User as UserIcon, ShieldCheck, Menu, Sparkles } from 'lucide-react';

interface NavbarProps {
  onToggleSidebar?: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, activeTab, setActiveTab }) => {
  const { user, wallet, logout, unreadNotificationCount, notifications, markNotificationsRead } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 text-slate-100">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <span className="font-bold tracking-tight text-white text-base">VeryFine<span className="text-emerald-400">Invest</span></span>
            <span className="hidden sm:inline-block text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded ml-2 border border-slate-700/50">USD CAPITAL</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Available Wallet Balance Badge */}
        {wallet && (
          <div
            onClick={() => setActiveTab('wallet')}
            className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
          >
            <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Available</div>
              <div className="text-xs font-bold text-emerald-400">${Number(wallet.available_balance).toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* AI Support Quick Button */}
        <button
          onClick={() => setActiveTab('ai-support')}
          className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-medium ${
            activeTab === 'ai-support'
              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
              : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:text-white'
          }`}
          title="AI Platform Assistant"
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="hidden md:inline">AI Helper</span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) markNotificationsRead();
            }}
            className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl relative transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center animate-pulse">
                {unreadNotificationCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 z-50 text-slate-200 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h4 className="font-bold text-sm text-white">Notifications</h4>
                <span className="text-xs text-slate-400">{notifications.length} total</span>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-2 mt-2 pr-1">
                {notifications.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">No new notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-2.5 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700/30 text-xs">
                      <div className="font-semibold text-emerald-400 mb-0.5">{n.title}</div>
                      <div className="text-slate-300 leading-snug">{n.message}</div>
                      <div className="text-[10px] text-slate-500 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Account Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 pl-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-slate-200 text-xs transition-colors"
          >
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <span className="hidden sm:inline font-medium text-slate-200">{user?.fullName?.split(' ')[0]}</span>
            {user?.role === 'admin' && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded">ADMIN</span>
            )}
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 text-slate-200 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-2.5 border-b border-slate-800 mb-1">
                <div className="font-semibold text-white truncate">{user?.fullName}</div>
                <div className="text-slate-400 truncate text-[11px]">{user?.email}</div>
              </div>

              <button
                onClick={() => {
                  setActiveTab('profile');
                  setShowUserMenu(false);
                }}
                className="w-full text-left p-2 hover:bg-slate-800 rounded-xl flex items-center gap-2 text-slate-300 hover:text-white"
              >
                <UserIcon className="w-4 h-4 text-slate-400" />
                <span>Profile & Security</span>
              </button>

              {user?.role === 'admin' && (
                <button
                  onClick={() => {
                    setActiveTab('admin');
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left p-2 hover:bg-amber-500/10 rounded-xl flex items-center gap-2 text-amber-300 font-semibold"
                >
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>Admin Portal</span>
                </button>
              )}

              <button
                onClick={logout}
                className="w-full text-left p-2 hover:bg-rose-500/10 rounded-xl flex items-center gap-2 text-rose-400 hover:text-rose-300 mt-1 border-t border-slate-800/80"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
