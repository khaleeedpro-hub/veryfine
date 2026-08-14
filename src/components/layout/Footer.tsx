import React from 'react';
import { Shield } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-950 border-t border-slate-900 py-8 px-4 lg:px-8 text-slate-500 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-300">VeryFineInvest USD Capital Platform</span>
          <span className="text-slate-600">|</span>
          <span>Double-Entry Financial Ledger Engine</span>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span>Terms of Service</span>
          <span>Privacy Policy</span>
          <span>Risk Disclosures</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-4 pt-4 border-t border-slate-900/60 text-[10px] text-slate-600 text-center md:text-left leading-relaxed">
        IMPORTANT RISK WARNING: Capital returns and VIP daily rewards are generated according to active plan terms and recorded in an auditable database ledger. Returns depend on plan configuration and are non-guaranteed. Always maintain secure passwords and 4-digit withdrawal PINs.
      </div>
    </footer>
  );
};
