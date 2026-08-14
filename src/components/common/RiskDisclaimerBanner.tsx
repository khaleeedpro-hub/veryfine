import React from 'react';
import { ShieldAlert } from 'lucide-react';

export const RiskDisclaimerBanner: React.FC = () => {
  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-amber-200 text-xs flex items-start gap-3 my-4">
      <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div>
        <span className="font-semibold text-amber-300">Investment & Regulatory Risk Disclosure:</span>
        <p className="mt-0.5 opacity-90 leading-relaxed">
          Digital capital investments carry financial risk. Daily earnings and returns are subject to active platform plan durations and system balance requirements. Returns are non-guaranteed. All financial operations are recorded in an immutable ledger with full 2FA and 4-digit PIN verification controls.
        </p>
      </div>
    </div>
  );
};
