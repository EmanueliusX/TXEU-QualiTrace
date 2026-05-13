import React, { useEffect, useState } from 'react';
import { usersApi } from '../../services/api';
import { User, UserRole, ROLE_LABELS } from '../../types';
import { Plus, Pencil, X, Loader2, Shield, ShieldCheck, BadgeCheck, Search, Power } from 'lucide-react';
import toast from 'react-hot-toast';

interface UserForm {
  name: string;
  badge_id: string;
  role: UserRole;
  pin: string;
}

const emptyForm: UserForm = { name: '', badge_id: '', role: 'auditor', pin: '' };

const roleIcon = (role: UserRole) => {
  if (role === 'admin') return <Shield className="w-4 h-4 text-purple-600" />;
  if (role === 'quality_admin') return <ShieldCheck className="w-4 h-4 text-blue-600" />;
  return <BadgeCheck className="w-4 h-4 text-emerald-600" />;
};

const roleBadgeClass = (role: UserRole) => {
  if (role === 'admin') return 'bg-purple-100 text-purple-700';
  if (role === 'quality_admin') return 'bg-blue-100 text-blue-700';
  return 'bg-emerald-100 text-emerald-700';
};

export default function OperatorsAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetch = () => {
    setLoading(true);
    usersApi.list().then(setUsers).finally(() => setLoading(false));
  };
  useEffect(fetch, []);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.badge_id.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditUser(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({ name: u.name, badge_id: u.badge_id, role: u.role, pin: '' });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name || !form.badge_id) { toast.error('Nume și Badge ID sunt obligatorii'); return; }
    if (form.role === 'admin' && !editUser && !form.pin) {
      toast.error('PIN obligatoriu pentru administratorul sistem'); return;
    }
    setSaving(true);
    try {
      if (editUser) {
        const payload: any = { name: form.name, badge_id: form.badge_id.toUpperCase(), role: form.role };
        if (form.pin) payload.pin = form.pin;
        await usersApi.update(editUser.id, payload);
        toast.success('Utilizator actualizat');
      } else {
        await usersApi.create({
          name: form.name,
          badge_id: form.badge_id.toUpperCase(),
          role: form.role,
          pin: form.pin || undefined,
        });
        toast.success('Utilizator creat');
      }
      setShowModal(false);
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Eroare la salvare');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: User) => {
    try {
      await usersApi.update(u.id, { active: !u.active });
      toast.success(u.active ? 'Dezactivat' : 'Activat');
      fetch();
    } catch { toast.error('Eroare'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Personal Calitate</h1>
          <p className="text-slate-500 mt-1">Gestionare auditori, admini calitate și administratori sistem</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="w-4 h-4" /> Adaugă persoană
        </button>
      </div>

      <div className="card p-4 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Caută după nume sau badge..."
          className="flex-1 outline-none text-sm"
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Se încarcă...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Niciun utilizator</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nume</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Badge</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{u.badge_id}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${roleBadgeClass(u.role)}`}>
                      {roleIcon(u.role)} {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.active ? (
                      <span className="text-emerald-600 text-xs font-medium">● Activ</span>
                    ) : (
                      <span className="text-slate-400 text-xs">Inactiv</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-slate-100 rounded" title="Editează">
                        <Pencil className="w-4 h-4 text-slate-600" />
                      </button>
                      <button onClick={() => toggleActive(u)} className="p-1.5 hover:bg-slate-100 rounded" title="Activează/Dezactivează">
                        <Power className={`w-4 h-4 ${u.active ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">{editUser ? 'Editează utilizator' : 'Adaugă persoană'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Nume complet">
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" />
              </Field>
              <Field label="Badge ID">
                <input value={form.badge_id} onChange={e => setForm({ ...form, badge_id: e.target.value.toUpperCase() })} className="input uppercase" placeholder="ex: AUD003 / QA002 / ADMIN002" />
              </Field>
              <Field label="Rol">
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })} className="input">
                  <option value="auditor">Auditor Calitate (badge-only)</option>
                  <option value="quality_admin">Admin Calitate (definește șabloane)</option>
                  <option value="admin">Administrator Sistem (acces complet)</option>
                </select>
              </Field>
              {form.role === 'admin' && (
                <Field label={editUser ? 'PIN nou (opțional)' : 'PIN'}>
                  <input type="password" value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} className="input" placeholder="••••" />
                </Field>
              )}
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg hover:bg-slate-100">Anulează</button>
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Salvează
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
