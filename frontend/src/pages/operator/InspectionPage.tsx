import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, XCircle, ScanLine, RotateCcw, ChevronLeft,
  Loader2, BadgeCheck, AlertTriangle, Package, Layers, Wrench
} from 'lucide-react';
import { inspectionsApi } from '../../services/api';
import { InspectionSession, Measurement } from '../../types';
import MeasurementFieldRow from '../../components/MeasurementFieldRow';
import CaliperBar from '../../components/CaliperBar';
import { useSerial } from '../../hooks/useSerial';
import { useScannerOnly } from '../../hooks/useScannerOnly';
import toast from 'react-hot-toast';

export default function InspectionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<InspectionSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFieldId, setActiveFieldId] = useState<number | null>(null);
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [badgeInput, setBadgeInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [validatedBy, setValidatedBy] = useState('');
  const badgeRef = useRef<HTMLInputElement>(null);

  // Ref to avoid stale closure in confirmMeasurement
  const sessionRef = useRef<InspectionSession | null>(null);
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Map of field_id → input DOM element for auto-focus after pass
  const fieldInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Block manual keyboard input; allow scanner bursts and caliper (Web Serial)
  useScannerOnly();

  const handleCaliperValue = useCallback((value: number) => {
    if (activeFieldId !== null) {
      setInputValues(prev => ({ ...prev, [activeFieldId]: value.toString() }));
      // Auto-confirm the value
      setTimeout(() => confirmMeasurement(activeFieldId, value), 300);
    }
  }, [activeFieldId]);

  const { status: serialStatus, lastValue, error: serialError, isSupported, connect, disconnect } = useSerial({
    onValue: handleCaliperValue,
  });

  useEffect(() => {
    if (!id) return;
    inspectionsApi.get(parseInt(id)).then(data => {
      setSession(data);
      // Set first pending field as active and focus its input
      const firstPending = data.measurements.find((m: Measurement) => m.status === 'pending');
      if (firstPending) {
        setActiveFieldId(firstPending.field_id);
        setTimeout(() => fieldInputRefs.current[firstPending.field_id]?.focus(), 150);
      }
    }).catch(() => {
      toast.error('Inspecție negăsită');
      navigate('/');
    }).finally(() => setLoading(false));
  }, [id]);

  const confirmMeasurement = async (fieldId: number, valueOverride?: number) => {
    if (!id || !sessionRef.current) return;
    const sess = sessionRef.current;
    const rawVal = valueOverride !== undefined ? valueOverride.toString() : inputValues[fieldId];
    if (rawVal === undefined || rawVal === '') return;
    const numVal = parseFloat(rawVal);
    if (isNaN(numVal)) { toast.error('Valoare invalidă'); return; }

    try {
      const { measurement } = await inspectionsApi.measure(parseInt(id), fieldId, numVal);
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          measurements: prev.measurements.map(m =>
            m.field_id === fieldId ? { ...m, value: numVal, status: measurement.status } : m
          )
        };
      });

      if (measurement.status === 'pass') {
        // Build updated measurements to correctly find next pending
        const updatedMeasurements = sess.measurements.map(m =>
          m.field_id === fieldId ? { ...m, status: 'pass' as const } : m
        );
        const currentIdx = updatedMeasurements.findIndex(m => m.field_id === fieldId);
        const nextPending = updatedMeasurements.find((m, i) => i > currentIdx && m.status === 'pending');
        if (nextPending) {
          setActiveFieldId(nextPending.field_id);
          // Auto-focus the next field's input (caliper / keyboard auto-advance)
          setTimeout(() => fieldInputRefs.current[nextPending.field_id]?.focus(), 80);
        } else {
          setActiveFieldId(null);
          // All pending done — focus badge validation input
          setTimeout(() => badgeRef.current?.focus(), 200);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Eroare la salvarea măsurătorii');
    }
  };

  const handleValidate = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const badge = (e.target as HTMLInputElement).value.trim().toUpperCase();
    if (!badge || !id) return;
    setValidating(true);
    try {
      const res = await inspectionsApi.validate(parseInt(id), badge);
      setValidated(true);
      setValidatedBy(res.validated_by);
      toast.success('Inspecție validată cu succes!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Validare eșuată');
      setBadgeInput('');
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-600" />
      </div>
    );
  }

  if (!session) return null;

  const { inspection, measurements, operation } = session;
  const passCount = measurements.filter(m => m.status === 'pass').length;
  const failCount = measurements.filter(m => m.status === 'fail').length;
  const totalCount = measurements.length;
  const allPass = passCount === totalCount && failCount === 0;
  const progressPct = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

  const activeField = measurements.find(m => m.field_id === activeFieldId);

  // Validated success screen
  if (validated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-6">
        <div className="card p-12 text-center max-w-md w-full animate-slide-up">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <BadgeCheck size={48} className="text-emerald-500" />
          </div>
          <h2 className="text-3xl font-bold text-emerald-700 mb-2">Validat!</h2>
          <p className="text-slate-600 mb-1">Inspecție finalizată cu succes</p>
          <p className="text-sm text-slate-500 mb-6">Validat de: <span className="font-semibold text-slate-700">{validatedBy}</span></p>
          <div className="bg-emerald-50 rounded-xl p-4 mb-8 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Job:</span><span className="font-semibold">{inspection.job_number}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Part:</span><span className="font-semibold">{inspection.part_number}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Operație:</span><span className="font-semibold">{operation.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Rezultat:</span><span className="font-bold text-emerald-600">{passCount}/{totalCount} OK</span></div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="btn-primary w-full justify-center py-3"
          >
            Inspecție Nouă
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                <span className="flex items-center gap-1"><Package size={11} />{inspection.job_number}</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Layers size={11} />{inspection.part_number}</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Wrench size={11} />{operation.code} — {operation.name}</span>
              </div>
            </div>
          </div>
          {/* Progress summary */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {failCount > 0 && (
              <span className="badge-fail">{failCount} eșuat</span>
            )}
            <span className={passCount === totalCount && totalCount > 0 ? 'badge-pass' : 'badge-pending'}>
              {passCount}/{totalCount} OK
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="max-w-3xl mx-auto mt-3 ml-14">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allPass ? 'bg-emerald-500' : failCount > 0 ? 'bg-red-400' : 'bg-brand-500'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      {/* Caliper bar */}
      <div className="max-w-3xl mx-auto w-full px-6 pt-4">
        <CaliperBar
          status={serialStatus}
          lastValue={lastValue}
          error={serialError}
          isSupported={isSupported}
          onConnect={connect}
          onDisconnect={disconnect}
          activeFieldName={activeField?.name}
        />
      </div>

      {/* Measurements */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-4 space-y-3">
        {measurements.map(m => (
          <MeasurementFieldRow
            key={m.field_id}
            measurement={m}
            isActive={activeFieldId === m.field_id}
            onActivate={() => setActiveFieldId(m.field_id)}
            inputValue={inputValues[m.field_id] ?? (m.value !== undefined && m.value !== null ? m.value.toString() : '')}
            onChange={val => setInputValues(prev => ({ ...prev, [m.field_id]: val }))}
            onConfirm={() => confirmMeasurement(m.field_id)}
            inputRef={{
              get current() { return fieldInputRefs.current[m.field_id] ?? null; },
              set current(el) { fieldInputRefs.current[m.field_id] = el; }
            } as React.RefObject<HTMLInputElement>}
          />
        ))}
      </div>

      {/* Validation panel */}
      {allPass && (
        <div className="max-w-3xl mx-auto w-full px-6 pb-6 animate-slide-up">
          <div className="card p-6 border-2 border-emerald-200 bg-emerald-50/50">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <BadgeCheck size={24} className="text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-emerald-800 text-lg mb-1">Toate măsurătorile sunt în toleranță!</h3>
                <p className="text-sm text-emerald-700 mb-4">Scanați badge-ul pentru a valida inspecția</p>
                <div className="relative">
                  <ScanLine size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" />
                  <input
                    ref={badgeRef}
                    type="text"
                    value={badgeInput}
                    onChange={e => setBadgeInput(e.target.value)}
                    onKeyDown={handleValidate}
                    placeholder="Scanați badge-ul de validare..."
                    autoFocus
                    disabled={validating}
                    className="w-full pl-11 pr-4 py-3 bg-white border-2 border-emerald-300 rounded-xl
                      text-slate-800 font-semibold uppercase tracking-widest text-center
                      focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent
                      scan-pulse transition-all"
                  />
                  {validating && (
                    <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-emerald-500" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fail warning */}
      {failCount > 0 && (
        <div className="max-w-3xl mx-auto w-full px-6 pb-6">
          <div className="card p-4 border-2 border-red-200 bg-red-50/50">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-700">
                  {failCount} câmp{failCount > 1 ? 'uri' : ''} în afara toleranței
                </p>
                <p className="text-sm text-red-600">Piesa nu poate fi validată. Verificați și remăsurați valorile marcate cu roșu.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
