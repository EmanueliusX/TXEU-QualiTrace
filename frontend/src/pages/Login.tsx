import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [badgeId, setBadgeId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsPin, setNeedsPin] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Hidden input that captures scanner bursts only
  const hiddenRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep focus on hidden input (unless PIN field is visible)
  useEffect(() => {
    if (!needsPin) {
      hiddenRef.current?.focus();
    }
  }, [needsPin]);

  const handleHiddenKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const scanned = bufferRef.current.trim().toUpperCase();
      bufferRef.current = '';
      if (timerRef.current) clearTimeout(timerRef.current);
      if (scanned) {
        setBadgeId(scanned);
        submitBadge(scanned);
      }
      return;
    }
    if (e.key.length === 1) {
      bufferRef.current += e.key;
      // Safety flush after 300ms (in case scanner doesn't send Enter)
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const scanned = bufferRef.current.trim().toUpperCase();
        bufferRef.current = '';
        if (scanned) {
          setBadgeId(scanned);
          submitBadge(scanned);
        }
      }, 300);
    }
  };

  const submitBadge = async (badge: string) => {
    if (!badge) return;
    setLoading(true);
    try {
      const user = await login(badge, '');
      toast.success(`Bun venit, ${user.name}`);
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'quality_admin') navigate('/admin/templates');
      else navigate('/');
    } catch (err: any) {
      const msg: string = err.response?.data?.error || '';
      if (err.response?.status === 400 && msg.toLowerCase().includes('pin')) {
        setNeedsPin(true);
        return;
      }
      toast.error(msg || 'Autentificare eșuată');
      setBadgeId('');
      bufferRef.current = '';
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) { toast.error('Introduceți PIN-ul'); return; }
    setLoading(true);
    try {
      const user = await login(badgeId, pin);
      toast.success(`Bun venit, ${user.name}`);
      navigate('/admin');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'PIN incorect');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4"
      onClick={() => { if (!needsPin) hiddenRef.current?.focus(); }}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">QualiTrace</h1>
            <p className="text-slate-500 text-sm mt-1">Autentificare Administratori</p>
          </div>

          {/* Hidden input — captures scanner input, never visible */}
          <input
            ref={hiddenRef}
            onKeyDown={handleHiddenKey}
            className="opacity-0 absolute w-0 h-0 pointer-events-none"
            tabIndex={-1}
            readOnly={false}
            autoComplete="off"
            aria-hidden="true"
          />

          {!needsPin ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${loading ? 'bg-blue-100' : 'bg-slate-100'}`}>
                {loading
                  ? <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  : <ScanLine className="w-8 h-8 text-slate-400" />}
              </div>
              <p className="text-slate-600 font-medium text-center">
                {loading ? 'Se verifică...' : 'Scanați badge-ul pentru autentificare'}
              </p>
              {badgeId && !loading && (
                <p className="text-xs text-slate-400 font-mono">{badgeId}</p>
              )}
            </div>
          ) : (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700 text-center font-medium">
                Badge: <span className="font-mono font-bold">{badgeId}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PIN Administrator</label>
                <input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="••••"
                  autoFocus
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Autentificare
              </button>
              <button type="button" onClick={() => { setNeedsPin(null); setBadgeId(''); setPin(''); }}
                className="w-full text-sm text-slate-500 hover:text-blue-600 py-1">
                ← Scanați alt badge
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <button onClick={() => navigate('/')} className="text-sm text-slate-500 hover:text-blue-600">
              ← Înapoi la zona auditor
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-4">
          Auditori: introduceți badge-ul direct în zona de inspecție.
        </p>
      </div>
    </div>
  );
}
