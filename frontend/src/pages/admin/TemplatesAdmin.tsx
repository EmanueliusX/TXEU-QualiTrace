import React, { useEffect, useMemo, useState } from 'react';
import { fieldsApi, operationsApi } from '../../services/api';
import { MeasurementField, Operation, Template } from '../../types';
import { Plus, Pencil, Trash2, X, Loader2, Layers, Wrench, Package, Copy, ListChecks, AlertCircle, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface FieldForm {
  name: string;
  description: string;
  unit: string;
  nominal_value: string;
  min_value: string;
  max_value: string;
}

const emptyField: FieldForm = { name: '', description: '', unit: 'mm', nominal_value: '', min_value: '', max_value: '' };

export default function TemplatesAdmin() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [partNumber, setPartNumber] = useState('');
  const [operationId, setOperationId] = useState<number | ''>('');
  const [fields, setFields] = useState<MeasurementField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editField, setEditField] = useState<MeasurementField | null>(null);
  const [form, setForm] = useState<FieldForm>(emptyField);
  const [saving, setSaving] = useState(false);

  const [showCopy, setShowCopy] = useState(false);
  const [copySource, setCopySource] = useState<{ part_number: string; operation_id: number } | null>(null);

  const newTemplate = () => {
    setPartNumber('');
    setOperationId('');
    setFields([]);
    // scroll editor into view on mobile
    document.getElementById('template-editor')?.scrollIntoView({ behavior: 'smooth' });
  };

  const deleteTemplate = async (t: Template, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Ștergi tot șablonul ${t.part_number} · ${t.operation_code}? (${t.field_count} câmpuri vor fi șterse)`)) return;
    try {
      const fs = await fieldsApi.list(t.operation_id, t.part_number);
      await Promise.all(fs.map((f: MeasurementField) => fieldsApi.remove(f.id)));
      toast.success('Șablon șters');
      if (partNumber === t.part_number && operationId === t.operation_id) {
        setPartNumber(''); setOperationId(''); setFields([]);
      }
      loadTemplates();
    } catch { toast.error('Eroare la ștergere'); }
  };

  const loadTemplates = () => fieldsApi.listTemplates().then(setTemplates);

  useEffect(() => {
    operationsApi.list().then(setOperations);
    loadTemplates();
  }, []);

  const fetchFields = () => {
    if (!partNumber || !operationId) { setFields([]); return; }
    setLoadingFields(true);
    fieldsApi.list(operationId as number, partNumber.toUpperCase())
      .then(setFields)
      .finally(() => setLoadingFields(false));
  };

  useEffect(fetchFields, [partNumber, operationId]);

  const selectedOp = operations.find(o => o.id === operationId);

  const openAddField = () => { setEditField(null); setForm(emptyField); setShowFieldModal(true); };
  const openEditField = (f: MeasurementField) => {
    setEditField(f);
    setForm({
      name: f.name,
      description: f.description || '',
      unit: f.unit,
      nominal_value: f.nominal_value !== null && f.nominal_value !== undefined ? String(f.nominal_value) : '',
      min_value: String(f.min_value),
      max_value: String(f.max_value),
    });
    setShowFieldModal(true);
  };

  const saveField = async () => {
    if (!form.name.trim()) { toast.error('Numele câmpului e obligatoriu'); return; }
    const min = parseFloat(form.min_value);
    const max = parseFloat(form.max_value);
    if (isNaN(min) || isNaN(max)) { toast.error('Min și Max sunt obligatorii'); return; }
    if (min >= max) { toast.error('Min trebuie să fie mai mic decât Max'); return; }
    if (!partNumber || !operationId) { toast.error('Selectați Part Number și Operația'); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        unit: form.unit || 'mm',
        nominal_value: form.nominal_value !== '' ? parseFloat(form.nominal_value) : null,
        min_value: min,
        max_value: max,
      };
      if (editField) {
        await fieldsApi.update(editField.id, payload);
        toast.success('Câmp actualizat');
      } else {
        await fieldsApi.create({
          ...payload,
          part_number: partNumber.toUpperCase(),
          operation_id: operationId as number,
          order_index: fields.length,
        });
        toast.success('Câmp adăugat');
      }
      setShowFieldModal(false);
      fetchFields();
      loadTemplates();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Eroare la salvare');
    } finally {
      setSaving(false);
    }
  };

  const deleteField = async (f: MeasurementField) => {
    if (!confirm(`Ștergi câmpul "${f.name}"?`)) return;
    try {
      await fieldsApi.remove(f.id);
      toast.success('Câmp șters');
      fetchFields();
      loadTemplates();
    } catch { toast.error('Eroare'); }
  };

  const handleSelectTemplate = (t: Template) => {
    setPartNumber(t.part_number);
    setOperationId(t.operation_id);
  };

  const handleCopy = async () => {
    if (!copySource || !partNumber || !operationId) return;
    try {
      // copy uses target_part with same operation as source
      await fieldsApi.copy({
        source_part: copySource.part_number,
        source_operation_id: copySource.operation_id,
        target_part: partNumber.toUpperCase(),
      });
      toast.success('Câmpuri copiate');
      setShowCopy(false);
      setCopySource(null);
      // After copy, jump to the source operation since copy creates fields with same operation
      setOperationId(copySource.operation_id);
      fetchFields();
      loadTemplates();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Eroare la copiere');
    }
  };

  const groupedTemplates = useMemo(() => {
    const grouped: Record<string, Template[]> = {};
    for (const t of templates) {
      if (!grouped[t.part_number]) grouped[t.part_number] = [];
      grouped[t.part_number].push(t);
    }
    return grouped;
  }, [templates]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Șabloane Calitate</h1>
          <p className="text-slate-500 mt-1">Definește câmpurile de măsurare per Part Number + Operație</p>
        </div>
        <button onClick={newTemplate} className="btn-primary">
          <Plus className="w-4 h-4" /> Șablon nou
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar — existing templates */}
        <aside className="col-span-12 lg:col-span-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-slate-800 text-sm">Șabloane existente</h3>
              </div>
              <button
                onClick={newTemplate}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                title="Șablon nou"
              >
                <Plus className="w-3 h-3" /> Nou
              </button>
            </div>
            {Object.keys(groupedTemplates).length === 0 ? (
              <div className="text-sm text-slate-400 py-4 text-center">Niciun șablon definit</div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-auto">
                {Object.entries(groupedTemplates).map(([part, ts]) => (
                  <div key={part}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                      <Package className="w-3 h-3" /> {part}
                    </div>
                    <div className="space-y-1 ml-4">
                      {ts.map(t => {
                        const isActive = partNumber.toUpperCase() === t.part_number && operationId === t.operation_id;
                        return (
                          <div
                            key={`${t.part_number}-${t.operation_id}`}
                            className={`group flex items-center gap-1 rounded text-xs transition ${
                              isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-slate-50 text-slate-600'
                            }`}
                          >
                            <button
                              onClick={() => handleSelectTemplate(t)}
                              className="flex-1 text-left px-2 py-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span>{t.operation_code}</span>
                                <span className="text-slate-400">{t.field_count} câmp{t.field_count !== 1 ? 'uri' : ''}</span>
                              </div>
                              <div className="text-slate-400 truncate">{t.operation_name}</div>
                            </button>
                            <div className="flex gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleSelectTemplate(t)}
                                className="p-1 rounded hover:bg-blue-100 text-blue-500"
                                title="Editează câmpuri"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={e => deleteTemplate(t, e)}
                                className="p-1 rounded hover:bg-red-100 text-red-400"
                                title="Șterge șablon"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Editor */}
        <section id="template-editor" className="col-span-12 lg:col-span-8 space-y-4">
          <div className="card p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Package className="w-3 h-3" /> Part Number
                </span>
                <input
                  value={partNumber}
                  onChange={e => setPartNumber(e.target.value.toUpperCase())}
                  placeholder="ex: PN-12345-A"
                  className="input uppercase"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> Operație
                </span>
                <select
                  value={operationId}
                  onChange={e => setOperationId(e.target.value ? Number(e.target.value) : '')}
                  className="input"
                >
                  <option value="">— Selectați —</option>
                  {operations.filter(o => o.active).map(o => (
                    <option key={o.id} value={o.id}>{o.code} — {o.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {!partNumber && !operationId && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
              <Plus className="w-5 h-5 flex-shrink-0" />
              <span>Introduceți un <strong>Part Number</strong> și selectați o <strong>Operație</strong> pentru a crea sau edita un șablon. Sau apăsați pe un șablon existent din stânga.</span>
            </div>
          )}

          {partNumber && operationId ? (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">
                    Șablon: {partNumber.toUpperCase()} · {selectedOp?.code}
                  </div>
                  <div className="text-xs text-slate-500">{fields.length} câmp{fields.length !== 1 ? 'uri' : ''} de măsurare</div>
                </div>
                <div className="flex gap-2">
                  {templates.length > 0 && (
                    <button onClick={() => setShowCopy(true)} className="px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5">
                      <Copy className="w-4 h-4" /> Copiază din alt șablon
                    </button>
                  )}
                  <button onClick={openAddField} className="btn-primary">
                    <Plus className="w-4 h-4" /> Câmp nou
                  </button>
                </div>
              </div>

              {loadingFields ? (
                <div className="p-8 text-center text-slate-400">Se încarcă...</div>
              ) : fields.length === 0 ? (
                <div className="p-10 text-center">
                  <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Niciun câmp definit pentru acest șablon</p>
                  <p className="text-slate-400 text-xs mt-1">Apăsați "Câmp nou" pentru a defini primul câmp de măsurare</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Câmp</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">UM</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Min</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Nominal</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Max</th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">Acțiuni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {fields.map(f => (
                      <tr key={f.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{f.name}</div>
                          {f.description && <div className="text-xs text-slate-400">{f.description}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{f.unit}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{f.min_value}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{f.nominal_value ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{f.max_value}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <button onClick={() => openEditField(f)} className="p-1.5 hover:bg-slate-100 rounded">
                              <Pencil className="w-4 h-4 text-slate-600" />
                            </button>
                            <button onClick={() => deleteField(f)} className="p-1.5 hover:bg-red-50 rounded">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="card p-10 text-center">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500">Selectați un Part Number și o Operație pentru a defini sau modifica șablonul</p>
            </div>
          )}
        </section>
      </div>

      {/* Field modal */}
      {showFieldModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">{editField ? 'Editează câmp' : 'Câmp nou'}</h2>
              <button onClick={() => setShowFieldModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Nume câmp">
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" placeholder="ex: Diametru" />
              </Field>
              <Field label="Descriere (opțional)">
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Unitate de măsură">
                  <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="input" placeholder="mm" />
                </Field>
                <Field label="Valoare nominală (opțional)">
                  <input type="number" step="0.001" value={form.nominal_value} onChange={e => setForm({ ...form, nominal_value: e.target.value })} className="input" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Min">
                  <input type="number" step="0.001" value={form.min_value} onChange={e => setForm({ ...form, min_value: e.target.value })} className="input" />
                </Field>
                <Field label="Max">
                  <input type="number" step="0.001" value={form.max_value} onChange={e => setForm({ ...form, max_value: e.target.value })} className="input" />
                </Field>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => setShowFieldModal(false)} className="px-4 py-2 text-sm rounded-lg hover:bg-slate-100">Anulează</button>
              <button onClick={saveField} disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvează
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy modal */}
      {showCopy && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">Copiază din alt șablon</h2>
              <button onClick={() => setShowCopy(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Câmpurile vor fi copiate către <strong>{partNumber.toUpperCase()}</strong> cu aceeași operație ca sursa.
            </p>
            <div className="space-y-2 max-h-72 overflow-auto">
              {templates.map(t => (
                <button
                  key={`${t.part_number}-${t.operation_id}`}
                  onClick={() => setCopySource({ part_number: t.part_number, operation_id: t.operation_id })}
                  className={`w-full text-left p-3 rounded-lg border ${
                    copySource?.part_number === t.part_number && copySource?.operation_id === t.operation_id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-sm font-medium text-slate-800">{t.part_number} · {t.operation_code}</div>
                  <div className="text-xs text-slate-500">{t.operation_name} · {t.field_count} câmpuri</div>
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => setShowCopy(false)} className="px-4 py-2 text-sm rounded-lg hover:bg-slate-100">Anulează</button>
              <button onClick={handleCopy} disabled={!copySource} className="btn-primary">
                <Copy className="w-4 h-4" /> Copiază
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
