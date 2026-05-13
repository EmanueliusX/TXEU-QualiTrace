import React, { useEffect, useState } from 'react';
import { operationsApi } from '../../services/api';
import { Operation } from '../../types';
import { Plus, Pencil, Trash2, Search, X, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface OpForm { code: string; name: string; description: string; }
const emptyForm: OpForm = { code: '', name: '', description: '' };

export default function OperationsAdmin() {
  const [ops, setOps] = useState<Operation[]>([]);
  const [allOps, setAllOps] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editOp, setEditOp] = useState<Operation | null>(null);
  const [form, setForm] = useState<OpForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Operation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchOps = () => {
    setLoading(true);
    operationsApi.listAll().then(data => {
      setAllOps(data);
      setOps(data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchOps(); }, []);

  useEffect(() => {
    setOps(allOps.filter(o =>
      o.code.toLowerCase().includes(search.toLowerCase()) ||
      o.name.toLowerCase().includes(search.toLowerCase())
    ));
  }, [search, allOps]);

  const openAdd = () => { setEditOp(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (o: Operation) => {
    setEditOp(o);
    setForm({ code: o.code, name: o.name, description: o.description || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) { toast.error('Cod și Nume sunt obligatorii'); return; }
    setSaving(true);
    try {
      if (editOp) {
        await operationsApi.update(editOp.id, { code: form.code.toUpperCase(), name: form.name, description: form.description });
        toast.success('Operație actualizată');
      } else {
        await operationsApi.create({ code: form.code.toUpperCase(), name: form.name, description: form.description });
        toast.success('Operație creată');
      }
      setShowModal(false);
      fetchOps();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Eroare la salvare');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (o: Operation) => {
    try {
      await operationsApi.update(o.id, { active: !o.active });
      toast.success(o.active ? 'Operație dezactivată' : 'Operație activată');
      fetchOps();
    } catch { toast.error('Eroare'); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await operationsApi.remove(confirmDelete.id);
      toast.success('Operație ștearsă');
      setAllOps(prev => prev.filter(o => o.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Eroare la ștergere');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Operații</h1>
          <p className="text-slate-500 mt-1">Definire operații de control calitate</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={18} /> Adaugă Operație</button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Caută operație..." className="input pl-11 max-w-xs" />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cod</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Denumire</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Descriere</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="text-right px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acțiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12"><Loader2 className="animate-spin mx-auto text-slate-400" /></td></tr>
            ) : ops.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-slate-400">Nicio operație găsită</td></tr>
            ) : ops.map(o => (
              <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <code className="text-sm font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">{o.code}</code>
                </td>
                <td className="px-6 py-4 font-medium text-slate-800">{o.name}</td>
                <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">{o.description || '—'}</td>
                <td className="px-6 py-4">
                  <button onClick={() => handleToggle(o)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border cursor-pointer
                    ${o.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                    {o.active ? <><CheckCircle2 size={11} /> Activ</> : <>Inactiv</>}
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(o)}
                      className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setConfirmDelete(o)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">{editOp ? 'Editare Operație' : 'Operație Nouă'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Cod Operație *</label>
                <input type="text" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="OP-001" className="input font-mono font-bold uppercase" />
                <p className="text-xs text-slate-400 mt-1">Cod unic, utilizat pentru scanare</p>
              </div>
              <div>
                <label className="label">Denumire *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Inspecție Diametru Exterior" className="input" />
              </div>
              <div>
                <label className="label">Descriere</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Detalii operație..." rows={3}
                  className="input resize-none" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Anulează</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {saving ? 'Se salvează...' : 'Salvează'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
                <Trash2 size={22} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Șterge operație?</h3>
              <p className="text-sm text-slate-500 mb-6">
                Operația <span className="font-semibold text-slate-700">{confirmDelete.code} — {confirmDelete.name}</span> va fi dezactivată permanent.
              </p>
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
