import React, { useEffect, useState } from 'react';
import { reportsApi } from '../../services/api';
import { ReportStats } from '../../types';
import { CheckCircle2, XCircle, Clock, TrendingUp, BarChart3, Activity } from 'lucide-react';

export default function AdminHome() {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [recentInspections, setRecentInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsApi.listInspections({ limit: 5 }).then(data => {
      setStats(data.stats);
      setRecentInspections(data.inspections);
    }).finally(() => setLoading(false));
  }, []);

  const passRate = stats && stats.total > 0
    ? Math.round(((stats.pass_count || 0) / stats.total) * 100)
    : 0;

  const statCards = [
    { label: 'Total Inspecții', value: stats?.total ?? '—', icon: BarChart3, color: 'text-brand-600', bg: 'bg-brand-50' },
    { label: 'Aprobate', value: stats?.pass_count ?? '—', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Respinse', value: stats?.fail_count ?? '—', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'În Desfășurare', value: stats?.in_progress_count ?? '—', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Vizualizare generală sistem QualiTrace</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-5">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={20} className={color} />
            </div>
            <div className="text-2xl font-bold text-slate-800">{value}</div>
            <div className="text-sm text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Pass rate */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-brand-600" />
            <span className="font-semibold text-slate-800">Rata de Aprobare</span>
          </div>
          <span className="text-2xl font-bold text-emerald-600">{passRate}%</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${passRate}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
      </div>

      {/* Recent inspections */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
          <Activity size={16} className="text-slate-400" />
          <h2 className="font-semibold text-slate-800">Inspecții Recente</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">Se încarcă...</div>
        ) : recentInspections.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Nicio inspecție înregistrată</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recentInspections.map(insp => (
              <div key={insp.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                  ${insp.status === 'pass' ? 'bg-emerald-100' : insp.status === 'fail' ? 'bg-red-100' : 'bg-amber-100'}`}>
                  {insp.status === 'pass'
                    ? <CheckCircle2 size={16} className="text-emerald-500" />
                    : insp.status === 'fail'
                    ? <XCircle size={16} className="text-red-500" />
                    : <Clock size={16} className="text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 text-sm">{insp.job_number}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-sm text-slate-600">{insp.part_number}</span>
                  </div>
                  <div className="text-xs text-slate-400 truncate">{insp.operation_name} {insp.operator_name && `· ${insp.operator_name}`}</div>
                </div>
                <div className="text-xs text-slate-400 flex-shrink-0">
                  {new Date(insp.created_at).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
