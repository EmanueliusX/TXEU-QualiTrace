import React, { useEffect, useState } from 'react';
import { reportsApi, operationsApi } from '../../services/api';
import { Inspection, Operation, ReportStats } from '../../types';
import {
  CheckCircle2, XCircle, Clock, Filter, Eye, Trash2,
  ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const statusLabel: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pass: { label: 'Aprobat', className: 'badge-pass', icon: <CheckCircle2 size={11} /> },
  fail: { label: 'Respins', className: 'badge-fail', icon: <XCircle size={11} /> },
  in_progress: { label: 'În desfășurare', className: 'badge-progress', icon: <Clock size={11} /> },
};

export default function ReportsAdmin() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<{ inspections: Inspection[]; stats: ReportStats } | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [filters, setFilters] = useState({ from: '', to: '', status: '', operation_id: '' });
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const fetchData = (pg = 0) => {
    setLoading(true);
    reportsApi.listInspections({
      ...filters,
      operation_id: filters.operation_id ? parseInt(filters.operation_id) : undefined,
      limit: PAGE_SIZE,
      offset: pg * PAGE_SIZE,
    }).then(d => { setData(d); setPage(pg); })
      .catch(() => toast.error('Eroare la încărcare'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    operationsApi.list().then(setOperations).catch(() => {});
    fetchData();
  }, []);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const d = await reportsApi.getInspection(id);
      setDetail(d);
    } catch { toast.error('Eroare la detalii'); }
    finally { setDetailLoading(false); }
  };

  const handleFilterApply = () => fetchData(0);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await reportsApi.deleteInspection(confirmDelete);
      toast.success('Inspectie ștearsă');
      setConfirmDelete(null);
      fetchData(page);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Eroare la ștergere');
    } finally {
      setDeleting(false);
    }
  };

  const statCards = data ? [
    { label: 'Total', value: data.stats.total, color: 'text-slate-800', bg: 'bg-slate-100' },
    { label: 'Aprobate', value: data.stats.pass_count, color: 'text-emerald-700', bg: 'bg-emerald-100' },
    { label: 'Respinse', value: data.stats.fail_count, color: 'text-red-700', bg: 'bg-red-100' },
    { label: 'În progres', value: data.stats.in_progress_count, color: 'text-amber-700', bg: 'bg-amber-100' },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Rapoarte Inspecții</h1>
        <p className="text-slate-500 mt-1">Istoric și analiză inspecții de calitate</p>
      </div>

      {/* Stats mini */}
      {data && (
        <div className="grid grid-cols-4 gap-4">
          {statCards.map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-sm text-slate-600 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Filtre</span>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="label text-xs">De la</label>
            <input type="date" value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))}
              className="input w-40 text-sm" />
          </div>
          <div>
            <label className="label text-xs">Până la</label>
            <input type="date" value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))}
              className="input w-40 text-sm" />
          </div>
          <div>
            <label className="label text-xs">Status</label>
            <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
              className="input w-44 text-sm">
              <option value="">Toate</option>
              <option value="pass">Aprobat</option>
              <option value="fail">Respins</option>
              <option value="in_progress">În desfășurare</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Operație</label>
            <select value={filters.operation_id} onChange={e => setFilters(p => ({ ...p, operation_id: e.target.value }))}
              className="input w-56 text-sm">
              <option value="">Toate</option>
              {operations.map(o => <option key={o.id} value={o.id.toString()}>{o.code} — {o.name}</option>)}
            </select>
          </div>
          <button onClick={handleFilterApply} className="btn-primary py-2.5">Aplică</button>
          <button onClick={() => { setFilters({ from: '', to: '', status: '', operation_id: '' }); setTimeout(() => fetchData(0), 0); }}
            className="btn-secondary py-2.5 text-sm">Resetează</button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Job / Part</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Operație</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Operator</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Detalii</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12"><Loader2 className="animate-spin mx-auto text-slate-400" /></td></tr>
            ) : !data?.inspections.length ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">Nicio inspecție găsită</td></tr>
            ) : data.inspections.map(insp => {
              const st = statusLabel[insp.status] ?? statusLabel.in_progress;
              return (
                <tr key={insp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 text-xs font-mono text-slate-400">#{insp.id}</td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-800 text-sm">{insp.job_number}</div>
                    <div className="text-xs text-slate-500">{insp.part_number}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-sm text-slate-700">{insp.operation_name}</div>
                    <code className="text-xs text-slate-400">{insp.operation_code}</code>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">{insp.operator_name ?? insp.operator_badge ?? '—'}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-500">
                    {new Date(insp.created_at).toLocaleDateString('ro-RO', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={st.className}>
                      {st.icon} {st.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openDetail(insp.id)}
                        className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                        <Eye size={15} />
                      </button>
                      {isAdmin && (
                        <button onClick={() => setConfirmDelete(insp.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.inspections.length === PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500">Pagina {page + 1}</span>
            <div className="flex items-center gap-2">
              <button disabled={page === 0} onClick={() => fetchData(page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                <ChevronLeft size={15} />
              </button>
              <button onClick={() => fetchData(page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-slide-up my-4">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Detalii Inspecție #{detail?.inspection?.id}</h3>
              <button onClick={() => setDetail(null)} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg">
                <XCircle size={18} />
              </button>
            </div>
            {detailLoading ? (
              <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" /></div>
            ) : detail && (
              <div className="p-6 space-y-5">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Job Number', detail.inspection.job_number],
                    ['Part Number', detail.inspection.part_number],
                    ['Operație', `${detail.inspection.operation_code} — ${detail.inspection.operation_name}`],
                    ['Operator', detail.inspection.operator_name ?? detail.inspection.operator_badge ?? '—'],
                    ['Status', statusLabel[detail.inspection.status]?.label ?? detail.inspection.status],
                    ['Data', new Date(detail.inspection.created_at).toLocaleString('ro-RO')],
                    detail.inspection.validated_by_name && ['Validat de', detail.inspection.validated_by_name],
                    detail.inspection.validated_at && ['Validat la', new Date(detail.inspection.validated_at).toLocaleString('ro-RO')],
                  ].filter(Boolean).map(([k, v]) => (
                    <div key={k as string} className="bg-slate-50 rounded-xl px-4 py-3">
                      <div className="text-xs text-slate-500 mb-0.5">{k as string}</div>
                      <div className="font-semibold text-slate-800">{v as string}</div>
                    </div>
                  ))}
                </div>

                {/* Measurements */}
                <div>
                  <h4 className="font-semibold text-slate-700 mb-3 text-sm">Măsurători</h4>
                  <div className="space-y-2">
                    {detail.measurements.map((m: any) => (
                      <div key={m.id} className={`flex items-center gap-4 px-4 py-3 rounded-xl border
                        ${m.status === 'pass' ? 'bg-emerald-50 border-emerald-200' : m.status === 'fail' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex-shrink-0">
                          {m.status === 'pass'
                            ? <CheckCircle2 size={18} className="text-emerald-500" />
                            : m.status === 'fail'
                            ? <XCircle size={18} className="text-red-500" />
                            : <Clock size={18} className="text-slate-400" />}
                        </div>
                        <div className="flex-1">
                          <span className="font-medium text-slate-800 text-sm">{m.name}</span>
                          <span className="ml-2 text-xs text-slate-500">
                            [{m.min_value} — {m.max_value}] {m.unit}
                          </span>
                        </div>
                        <div className={`font-bold font-mono text-sm
                          ${m.status === 'pass' ? 'text-emerald-700' : m.status === 'fail' ? 'text-red-700' : 'text-slate-400'}`}>
                          {m.value !== null && m.value !== undefined ? `${m.value} ${m.unit}` : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm delete inspection modal */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
                <Trash2 size={22} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Șterge inspecția #{confirmDelete}?</h3>
              <p className="text-sm text-slate-500 mb-6">Această acțiune este ireversibilă. Toate măsurătorile asociate vor fi șterse.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                  className="btn-secondary flex-1 justify-center">Anulează</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 justify-center flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition-colors">
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={15} />}
                  {deleting ? 'Se șterge...' : 'Șterge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
