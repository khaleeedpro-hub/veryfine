import React, { useState } from 'react';
import { Shield, TrendingUp, Wallet, ArrowRight, Lock, CheckCircle2, ChevronRight, HelpCircle, ShieldAlert } from 'lucide-react';
import { RiskDisclaimerBanner } from '../components/common/RiskDisclaimerBanner';

interface LandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onExploreVipClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onRegisterClick, onExploreVipClick }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How do daily earnings work on VIP plans?',
      a: 'When you activate a VIP plan, daily returns are automatically credited to your available balance every 24 hours for the duration of the plan (e.g. 120 days). Principal returns at maturity.',
    },
    {
      q: 'What are the deposit and withdrawal limits?',
      a: 'Minimum deposit is $20 and maximum deposit is $10,000 per transaction. Withdrawals require your secret 4-digit PIN and are subject to a standard 1.5% processing fee.',
    },
    {
      q: 'How do internal wallet transfers work?',
      a: 'Users can send funds instantly to any registered user using their unique Wallet Address (e.g. WALLET-XXXXXXXX). Daily transfer limits apply ($50 max per day, 2 transfers max per day).',
    },
    {
      q: 'Is my capital secured?',
      a: 'Yes. All financial transactions are logged in an immutable double-entry ledger. Account operations require hashed passwords and 4-digit security PINs with optional 2FA protection.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950">
            <Shield className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white">VeryFine<span className="text-emerald-400">Invest</span></span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onLoginClick}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 transition-all"
          >
            Sign In
          </button>
          <button
            onClick={onRegisterClick}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-lg shadow-emerald-400/20 transition-all"
          >
            Create Account
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 lg:px-8 py-12 space-y-16">
        {/* Hero Section */}
        <section className="text-center max-w-3xl mx-auto space-y-6 pt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Regulated Double-Entry Financial Engine</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Institutional-Grade <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">USD Investment & Rewards</span> Platform
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Maximize your USD capital with configurable daily-return VIP plans, 4-digit PIN protected withdrawals, and instant internal wallet transfers.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={onRegisterClick}
              className="w-full sm:w-auto px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Get Started Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onExploreVipClick}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold rounded-xl border border-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>View VIP Plans</span>
            </button>
          </div>

          <RiskDisclaimerBanner />
        </section>

        {/* Feature Cards Grid */}
        <section className="grid md:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-3 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Daily Return VIP Plans</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Configurable 120-day investment plans with automatic idempotent daily returns credited directly to your available balance.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-3 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">4-Digit Withdrawal PIN</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Every withdrawal requires your secret 4-digit security PIN. PIN resets apply a 24-hour security cooldown for complete asset protection.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-3 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Internal Wallet Transfers</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Transfer USD instantly between registered users using unique wallet IDs. Daily transfer limits apply ($50 max per day).
            </p>
          </div>
        </section>

        {/* VIP Plans Overview */}
        <section className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-2xl font-bold text-white">Configurable VIP Plans</h2>
            <p className="text-slate-400 text-xs">Transparent returns calculated over 120-day investment periods.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { level: 1, name: 'VIP 1', amount: 20, daily: 1.0, duration: 120, total: 120 },
              { level: 2, name: 'VIP 2', amount: 50, daily: 2.5, duration: 120, total: 300 },
              { level: 3, name: 'VIP 3', amount: 100, daily: 5.0, duration: 120, total: 600 },
              { level: 4, name: 'VIP 4', amount: 200, daily: 10.0, duration: 120, total: 1200 },
            ].map((plan) => (
              <div key={plan.level} className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 space-y-4 transition-all">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{plan.name}</span>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-medium">{plan.duration} Days</span>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">${plan.amount}</div>
                  <div className="text-[11px] text-slate-400 mt-1">Capital Requirement</div>
                </div>
                <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Daily Return:</span>
                    <span className="font-bold text-emerald-400">+${plan.daily.toFixed(2)}/day</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Reward:</span>
                    <span className="font-bold text-white">${plan.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="space-y-6 max-w-3xl mx-auto">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
              <HelpCircle className="w-5 h-5 text-emerald-400" />
              <span>Frequently Asked Questions</span>
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full text-left p-4 flex items-center justify-between font-semibold text-sm text-slate-200 hover:text-white"
                >
                  <span>{faq.q}</span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${openFaq === idx ? 'rotate-90' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed border-t border-slate-800/50 pt-2">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
