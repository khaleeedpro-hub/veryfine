import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalized = (status || '').toLowerCase();

  let styles = 'bg-slate-800 text-slate-300 border-slate-700';

  if (['completed', 'verified', 'active', 'approved'].includes(normalized)) {
    styles = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  } else if (['confirming', 'detecting', 'pending', 'processing', 'unverified'].includes(normalized)) {
    styles = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  } else if (['rejected', 'failed', 'suspended', 'cancelled'].includes(normalized)) {
    styles = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wide uppercase ${styles}`}>
      {['confirming', 'detecting', 'processing'].includes(normalized) && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      )}
      {['completed', 'verified', 'active'].includes(normalized) && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      )}
      <span>{status}</span>
    </span>
  );
};
