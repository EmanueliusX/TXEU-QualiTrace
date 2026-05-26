import React, { useEffect, useState } from 'react';
import { capabilityApi, fieldsApi } from '../../services/api';
import { CapabilityConfig, CapabilityStudy, Template } from '../../types';
import {
  TrendingUp, Save, Trash2, RefreshCw, CheckCircle2, AlertCircle,
  Loader2, Settings, BarChart3, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ConfigForm {
  part_number: string;
  operation_id: number;
  samples_per_lot: number;
  lots_required: number;
}

const emptyForm: ConfigForm = { part_number: '', operation_id: 0, samples_per_lot: 5, lots_required: 5 };

function fmt(n: number | null | undefined, digits = 3) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function indexBadge(value: number | null | undefined): { label: string; cls: string } {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { label: 'N/A', cls: 'bg-slate-100 text-slate-500' };
  }
  if (value >= 1.67) return { label: 'Excelent', cls: 'bg-emerald-100 text-emerald-700' };
  if (value >= 1.33) return { label: 'Capabil',  cls: 'bg-green-100 text-green-700' };
  if (value >= 1.00) return { label: 'Marginal', cls: 'bg-yellow-100 text-yellow-700' };
  return { label: 'Incapabil', cls: 'bg-red-100 text-red-700' };
}

export default function CapabilityAdmin() {
  const [configs, setConfigs] = useState<CapabilityConfig[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState<ConfigForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<CapabilityConfig | null>(null);
  const [study, setStudy] = useState<CapabilityStudy | null>(null);
  const [loadingStudy, setLoadingStudy] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cfgs, tpls] = await Promise.all([
        capabilityApi.listConfigs(),
        fieldsApi.listTemplates(),
      ]);
      setConfigs(cfgs);
      setTemplates(tpls);
    } catch (e: any) {
      toast.error('Eroare la încărcare');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const loadStudy = async (cfg: CapabilityConfig) => {
    setSelected(cfg);
    setLoadingStudy(true);
    try {
      const s = await capabilityApi.getStudy(cfg.part_number, cfg.operation_id);
      setStudy(s);
    } catch {
      toast.error('Eroare la încărcarea studiului');
    } finally {
      setLoadingStudy(false);
    }
  };

  const handleSave = async () => {
    if (!form.part_number || !form.operation_id) {
      toast.error('Selectați șablonul (referință + operație)');
      return;
    }
    setSaving(true);
    try {
      await capabilityApi.saveConfig(form);
      toast.success('Configurare salvată');
      setShowForm(false);
      setForm(emptyForm);
      await loadAll();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Eroare la salvare');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cfg: CapabilityConfig) => {
    if (!confirm(`Ștergeți configurarea pentru ${cfg.part_number} / ${cfg.operation_code}?`)) return;
    try {
      await capabilityApi.removeConfig(cfg.id);
      toast.success('Șters');
      if (selected?.id === cfg.id) { setSelected(null); setStudy(null); }
      await loadAll();
    } catch {
      toast.error('Eroare la ștergere');
    }
  };

  // Șabloane disponibile (care nu au deja config)
  const availableTemplates = templates.filter(t =>
    !configs.some(c => c.part_number === t.part_number && c.operation_id === t.operation_id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-blue-600" /> Studii de Capabilitate
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cp / Cpk (capabilitate proces, scurt termen) și Pp / Ppk (performanță, lung termen)
          </p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setShowForm(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Settings className="w-4 h-4" /> Configurare nouă
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-6 border-2 border-blue-200 bg-blue-50/30">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Settings className="w-5 h-5" /> Configurare studiu</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Șablon (referință + operație)</label>
              <select
                value={`${form.part_number}|${form.operation_id}`}
                onChange={e => {
                  const [pn, opId] = e.target.value.split('|');
                  setForm(f => ({ ...f, part_number: pn, operation_id: parseInt(opId, 10) || 0 }));
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="|0">— Selectează —</option>
                {availableTemplates.map(t => (
                  <option key={`${t.part_number}|${t.operation_id}`} value={`${t.part_number}|${t.operation_id}`}>
                    {t.part_number} · {t.operation_code} {t.operation_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sample-uri per lot</label>
              <input
                type="number" min={1} max={50}
                value={form.samples_per_lot}
                onChange={e => setForm(f => ({ ...f, samples_per_lot: parseInt(e.target.value, 10) || 1 }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">Tipic: 3–10 (recomandat 5)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Loturi necesare</label>
              <input
                type="number" min={1} max={100}
                value={form.lots_required}
                onChange={e => setForm(f => ({ ...f, lots_required: parseInt(e.target.value, 10) || 1 }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">Tipic: 5–25 (recomandat 5)</p>
            </div>
          </div>
          <div className="mt-3 text-xs text-blue-700 bg-blue-100 rounded px-3 py-2">
            Total minim măsurători: <strong>{form.samples_per_lot * form.lots_required}</strong>.
            Recomandare AIAG / IATF: minim 25 de date pentru un studiu valid.
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => { setShowForm(false); setForm(emptyForm); }}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Renunță
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvează
            </button>
          </div>
        </div>
      )}

      {/* Lista configurări */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Configurări existente</h3>
          <button onClick={loadAll} className="text-slate-400 hover:text-blue-600">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : configs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Layers className="w-12 h-12 mx-auto mb-2 opacity-40" />
            <p>Nicio configurare. Adaugă una nouă pentru a începe.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Referință</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Operație</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Sample-uri/lot</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Loturi</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Total date</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {configs.map(cfg => (
                <tr key={cfg.id} className={`hover:bg-slate-50 ${selected?.id === cfg.id ? 'bg-blue-50/40' : ''}`}>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800">{cfg.part_number}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{cfg.operation_code}</div>
                    <div className="text-xs text-slate-400">{cfg.operation_name}</div>
                  </td>
                  <td className="px-4 py-3 text-center font-mono">{cfg.samples_per_lot}</td>
                  <td className="px-4 py-3 text-center font-mono">{cfg.lots_required}</td>
                  <td className="px-4 py-3 text-center font-mono text-slate-600">{cfg.samples_per_lot * cfg.lots_required}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => loadStudy(cfg)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Vezi studiu"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cfg)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Șterge"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Studiu selectat */}
      {selected && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Studiu: <span className="font-mono">{selected.part_number}</span> · {selected.operation_code}
            </h3>
          </div>

          {loadingStudy ? (
            <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
          ) : !study ? null : (
            <div className="p-6 space-y-6">
              {/* Progres colectare */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-slate-700">
                    Progres colectare: {study.complete_lots} / {study.lots_required} loturi complete
                  </div>
                  {study.ready ? (
                    <span className="badge-pass flex items-center gap-1">
                      <CheckCircle2 size={11} /> Date suficiente
                    </span>
                  ) : (
                    <span className="badge-progress flex items-center gap-1">
                      <AlertCircle size={11} /> Date insuficiente
                    </span>
                  )}
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, ((study.complete_lots || 0) / (study.lots_required || 1)) * 100)}%` }}
                  />
                </div>
                {study.lots && study.lots.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {study.lots.slice(0, 12).map(lot => (
                      <div key={lot.job_number}
                        className={`text-xs px-3 py-2 rounded border ${lot.complete ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                      >
                        <div className="font-mono font-semibold">{lot.job_number}</div>
                        <div>{lot.sample_count} / {lot.target}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rezultate per câmp */}
              {study.ready && study.results && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-y border-slate-100">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Caracteristică</th>
                        <th className="text-center px-3 py-2 font-medium text-slate-600">LSL / USL</th>
                        <th className="text-center px-3 py-2 font-medium text-slate-600">Medie (x̄)</th>
                        <th className="text-center px-3 py-2 font-medium text-slate-600">σ within</th>
                        <th className="text-center px-3 py-2 font-medium text-slate-600">σ overall</th>
                        <th className="text-center px-3 py-2 font-medium text-slate-600">Cp</th>
                        <th className="text-center px-3 py-2 font-medium text-slate-600">Cpk</th>
                        <th className="text-center px-3 py-2 font-medium text-slate-600">Pp</th>
                        <th className="text-center px-3 py-2 font-medium text-slate-600">Ppk</th>
                        <th className="text-center px-3 py-2 font-medium text-slate-600">Verdict</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {study.results.map(r => {
                        const verdict = indexBadge(r.cpk);
                        return (
                          <tr key={r.field.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-800">{r.field.name}</div>
                              <div className="text-xs text-slate-400">{r.field.unit}</div>
                            </td>
                            <td className="px-3 py-2 text-center font-mono text-xs">
                              {r.field.min_value} / {r.field.max_value}
                            </td>
                            <td className="px-3 py-2 text-center font-mono">{fmt(r.xbar, 4)}</td>
                            <td className="px-3 py-2 text-center font-mono">{fmt(r.sigma_within, 5)}</td>
                            <td className="px-3 py-2 text-center font-mono">{fmt(r.sigma_overall, 5)}</td>
                            <td className="px-3 py-2 text-center font-mono font-semibold">{fmt(r.cp, 2)}</td>
                            <td className="px-3 py-2 text-center font-mono font-semibold">{fmt(r.cpk, 2)}</td>
                            <td className="px-3 py-2 text-center font-mono">{fmt(r.pp, 2)}</td>
                            <td className="px-3 py-2 text-center font-mono">{fmt(r.ppk, 2)}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-xs px-2 py-1 rounded font-medium ${verdict.cls}`}>{verdict.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-400 mt-3">
                    Verdict bazat pe Cpk: ≥1.67 excelent · ≥1.33 capabil · ≥1.00 marginal · &lt;1.00 incapabil.
                    σ within = σ̄/c4 (variație în interiorul lotului). σ overall = stdev din toate datele.
                  </p>
                </div>
              )}

              {!study.ready && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                  Mai trebuie {(study.lots_required || 0) - (study.complete_lots || 0)} loturi complete pentru calculul indicilor.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
