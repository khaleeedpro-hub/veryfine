import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Investment } from '../types';
import { Briefcase, Calendar, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

export const InvestmentsPage: React.FC = () => {
  const { token } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchInvestments();
  }, [token]);

  const fetchInvestments = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/vip/my-investments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvestments(Array.isArray(data) ? data : (data.investments || []));
      }
    } catch (err) {
      console.error('Failed to fetch user investments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-teal-400" />
            <span>Investment Portfolio & Rewards Lifecycle</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track active plan durations, daily reward deposits, and maturity dates.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-bold text-sm text-white">Active & Past Investments</h2>
          <span className="text-xs text-slate-400">{investments.length} Total Record(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 uppercase text-[10px] text-slate-400 tracking-wider">
              <tr>
                <th className="p-4">Investment ID</th>
                <th className="p-4">Plan Name</th>
                <th className="p-4">Capital</th>
                <th className="p-4">Daily Return</th>
                <th className="p-4">Progress Days</th>
                <th className="p-4">Total Earned</th>
                <th className="p-4">Maturity Date</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {investments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    No active or past investments found.
                  </td>
                </tr>
              ) : (
                investments.map((inv) => {
                  const pct = Math.min(100, Math.round((inv.days_credited / inv.duration_days) * 100));
                  return (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-mono text-slate-400">{inv.id}</td>
                      <td className="p-4 font-bold text-white">{inv.plan_name}</td>
                      <td className="p-4 font-semibold text-slate-200">${Number(inv.investment_amount).toFixed(2)}</td>
                      <td className="p-4 text-emerald-400 font-bold">+${Number(inv.daily_earning).toFixed(2)}/day</td>
                      <td className="p-4">
                        <div className="space-y-1 w-32">
                          <div className="flex justify-between text-[10px] font-semibold">
                            <span>Day {inv.days_credited}/{inv.duration_days}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-purple-300 font-bold">+${Number(inv.total_earned).toFixed(2)}</td>
                      <td className="p-4 text-slate-400">{new Date(inv.maturity_date).toLocaleDateString()}</td>
                      <td className="p-4">
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
