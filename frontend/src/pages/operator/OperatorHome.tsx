import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck, ScanLine, Briefcase, Package, Wrench,
  Loader2, CheckCircle2, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi, operationsApi, inspectionsApi } from '../../services/api';
import { Operation, User } from '../../types';
import { useScannerOnly } from '../../hooks/useScannerOnly';

export default function OperatorHome() {
  const navigate = useNavigate();
  const [operations, setOperations] = useState<Operation[]>([]);

  // Block manual keyboard typing; only scanner bursts are accepted
  useScannerOnly();

  const [badgeInput, setBadgeInput] = useState('');
  const [jobInput, setJobInput] = useState('');
  const [partInput, setPartInput] = useState('');
  const [opInput, setOpInput] = useState('');

  const [auditor, setAuditor] = useState<User | null>(null);
  const [validatingBadge, setValidatingBadge] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startingOpId, setStartingOpId] = useState<number | null>(null);

  // Prevents double-fire when both onKeyDown(Enter) and onBlur fire together
  const isValidatingBadge = useRef(false);

  const badgeRef = useRef<HTMLInputElement>(null);
  const jobRef = useRef<HTMLInputElement>(null);
  const partRef = useRef<HTMLInputElement>(null);
  const opRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    operationsApi.list().then(setOperations);
    setTimeout(() => badgeRef.current?.focus(), 100);
  }, []);

  const tryValidateBadge = async () => {
    if (isValidatingBadge.current) return;
    const val = badgeInput.trim().toUpperCase();
    if (!val) return;
    isValidatingBadge.current = true;
    setValidatingBadge(true);
    try {
      const { user } = await authApi.validateBadge(val);
      setAuditor(user);
      toast.success(user.name, { duration: 2000 });
      setTimeout(() => jobRef.current?.focus(), 50);
    } catch {
      toast.error('Badge necunoscut');
      setBadgeInput('');
      setTimeout(() => badgeRef.current?.focus(), 50);
    } finally {
      isValidatingBadge.current = false;
      setValidatingBadge(false);
    }
  };

  const startInspection = async (op: Operation) => {
    if (!auditor) { toast.error('Scanați badge-ul mai întâi'); badgeRef.current?.focus(); return; }
    if (!jobInput.trim()) { toast.error('Introduceți Job Number'); jobRef.current?.focus(); return; }
    if (!partInput.trim()) { toast.error('Introduceți Part Number'); partRef.current?.focus(); return; }
    setStarting(true);
    setStartingOpId(op.id);
    try {
      const data = await inspectionsApi.start({
        job_number: jobInput.trim().toUpperCase(),
        part_number: partInput.trim().toUpperCase(),
        operation_id: op.id,
        operator_badge: auditor.badge_id,
      });
      navigate(`/inspect/${data.inspection.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Eroare la pornire', { duration: 6000 });
      setStarting(false);
      setStartingOpId(null);
    }
  };

  const handleOpScanEnter = () => {
    const val = opInput.trim().toUpperCase();
    if (!val) return;
    const op = operations.find(o => o.active && o.code.toUpperCase() === val);
    if (op) {
      startInspection(op);
    } else {
      toast.error(`Operația "${val}" nu a fost găsită`);
      setOpInput('');
      opRef.current?.focus();
    }
  };

  const reset = () => {
    setBadgeInput(''); setJobInput(''); setPartInput(''); setOpInput('');
    setAuditor(null); setStarting(false); setStartingOpId(null);
    setTimeout(() => badgeRef.current?.focus(), 50);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            <div>
              <div className="font-bold text-slate-800 leading-tight">QualiTrace</div>
              <div className="text-xs text-slate-500">Stație Auditor Calitate</div>
            </div>
          </div>
          <Link to="/login" className="text-sm text-blue-600 hover:underline">Acces administrare →</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Card header */}
          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Pornire Inspecție</h2>
            {auditor && (
              <button onClick={reset} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition">
                <X className="w-3 h-3" /> Resetează
              </button>
            )}
          </div>

          {/* ── 1. Badge ── */}
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-start gap-3">
              <StepDot n={1} done={!!auditor} />
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Badge Auditor</div>
                {auditor ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="font-semibold text-emerald-700">{auditor.name}</span>
                    <span className="text-xs text-slate-400 font-mono">{auditor.badge_id}</span>
                  </div>
                ) : (
                  <div className="relative">
                    <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      ref={badgeRef}
                      type="text"
                      value={badgeInput}
                      onChange={e => setBadgeInput(e.target.value.toUpperCase())}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); tryValidateBadge(); } }}
                      onBlur={() => { if (badgeInput && !auditor) tryValidateBadge(); }}
                      placeholder="Scanați badge-ul..."
                      disabled={validatingBadge}
                      className="w-full pl-9 pr-9 py-2.5 border-2 border-slate-200 rounded-xl text-sm uppercase focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-100 transition disabled:opacity-60"
                      autoComplete="off"
                    />
                    {validatingBadge && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── 2. Job Number ── */}
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-start gap-3">
              <StepDot n={2} done={!!jobInput.trim()} />
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Număr Job</div>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    ref={jobRef}
                    type="text"
                    value={jobInput}
                    onChange={e => setJobInput(e.target.value.toUpperCase())}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && jobInput.trim()) { e.preventDefault(); partRef.current?.focus(); }
                    }}
                    placeholder="Scanați sau introduceți Job Number..."
                    className="w-full pl-9 py-2.5 border-2 border-slate-200 rounded-xl text-sm uppercase focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-100 transition"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── 3. Part Number ── */}
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-start gap-3">
              <StepDot n={3} done={!!partInput.trim()} />
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Part Number</div>
                <div className="relative">
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    ref={partRef}
                    type="text"
                    value={partInput}
                    onChange={e => setPartInput(e.target.value.toUpperCase())}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && partInput.trim()) { e.preventDefault(); opRef.current?.focus(); }
                    }}
                    placeholder="Scanați Part Number..."
                    className="w-full pl-9 py-2.5 border-2 border-slate-200 rounded-xl text-sm uppercase focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-100 transition"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── 4. Operație ── */}
          <div className="px-6 py-5">
            <div className="flex items-start gap-3">
              <StepDot n={4} done={false} />
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Operație</div>

                  {/* Scan input for operation code */}
                  <div className="relative">
                    <Wrench className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      ref={opRef}
                      type="text"
                      value={opInput}
                      onChange={e => setOpInput(e.target.value.toUpperCase())}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && opInput.trim()) { e.preventDefault(); handleOpScanEnter(); }
                      }}
                      placeholder="Scanați codul operației (ex: OP-D01)..."
                      disabled={starting}
                      className="w-full pl-9 py-2.5 border-2 border-slate-200 rounded-xl text-sm uppercase focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-100 transition disabled:opacity-50"
                      autoComplete="off"
                    />
                  </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StepDot({ n, done }: { n: number; done: boolean }) {
  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1 transition-colors ${
      done ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'
    }`}>
      {done ? '✓' : n}
    </div>
  );
}
