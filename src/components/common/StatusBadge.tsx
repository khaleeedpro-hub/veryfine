import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalized = status.toLowerCase();

  let styles = 'bg-slate-800 text-slate-300 border-slate-700';

  if (['completed', 'verified', 'active', 'approved'].includes(normalized)) {
    styles = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  } else if (['pending', 'processing', 'unverified'].includes(normalized)) {
    styles = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  } else if (['rejected', 'failed', 'suspended', 'cancelled'].includes(normalized)) {
    styles = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  }

  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border tracking-wide uppercase ${styles}`}>
      {status}
    </span>
  );
};
