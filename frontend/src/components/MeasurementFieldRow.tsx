import React from 'react';
import { CheckCircle2, XCircle, Minus } from 'lucide-react';
import { Measurement } from '../types';

interface MeasurementFieldProps {
  measurement: Measurement;
  isActive: boolean;
  onActivate: () => void;
  onChange: (value: string) => void;
  onConfirm: () => void;
  inputValue: string;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export default function MeasurementFieldRow({
  measurement, isActive, onActivate, onChange, onConfirm, inputValue, inputRef
}: MeasurementFieldProps) {
  const { status, name, unit, nominal_value, min_value, max_value, description } = measurement;

  const borderClass =
    isActive ? 'border-brand-400 shadow-md ring-2 ring-brand-100' :
    status === 'pass' ? 'border-emerald-200 bg-emerald-50/30' :
    status === 'fail' ? 'border-red-200 bg-red-50/30' :
    'border-slate-200';

  const inputClass =
    isActive ? 'border-brand-400 focus:ring-brand-200 text-slate-800 text-lg font-semibold scan-pulse' :
    status === 'pass' ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold text-lg' :
    status === 'fail' ? 'border-red-300 bg-red-50 text-red-800 font-semibold text-lg animate-shake' :
    'border-slate-200 text-slate-500 text-lg';

  const tolerance = ((max_value - min_value) / 2).toFixed(3);

  return (
    <div
      className={`card p-4 border-2 transition-all duration-200 cursor-pointer ${borderClass}`}
      onClick={onActivate}
    >
      <div className="flex items-center gap-4">
        {/* Status icon */}
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full
          transition-all duration-300
          ${status === 'pass' ? 'bg-emerald-100' : status === 'fail' ? 'bg-red-100' : 'bg-slate-100'}">
          {status === 'pass' && <CheckCircle2 size={24} className="text-emerald-500 animate-fade-in" />}
          {status === 'fail' && <XCircle size={24} className="text-red-500 animate-fade-in" />}
          {status === 'pending' && <Minus size={24} className="text-slate-400" />}
        </div>

        {/* Field info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-slate-800">{name}</span>
            {description && <span className="text-xs text-slate-400 truncate">{description}</span>}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {nominal_value !== undefined && nominal_value !== null && (
              <span>Nominal: <span className="font-medium text-slate-700">{nominal_value} {unit}</span></span>
            )}
            <span>Min: <span className="font-medium text-slate-700">{min_value} {unit}</span></span>
            <span>Max: <span className="font-medium text-slate-700">{max_value} {unit}</span></span>
            <span className="text-slate-400">±{tolerance} {unit}</span>
          </div>
        </div>

        {/* Input */}
        <div className="flex-shrink-0 flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <div className="relative">
            <input
              ref={inputRef}
              type="number"
              step="0.001"
              value={inputValue}
              onChange={e => onChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onConfirm(); }}
              onFocus={onActivate}
              placeholder="0.000"
              className={`w-32 px-3 py-2 rounded-xl border-2 focus:outline-none focus:ring-2 
                transition-all duration-200 text-right ${inputClass}`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
              {/* unit shown in placeholder area */}
            </span>
          </div>
          <span className="text-sm font-medium text-slate-500 w-8">{unit}</span>
          {isActive && (
            <button
              onClick={onConfirm}
              className="px-3 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl
                hover:bg-brand-700 transition-colors active:scale-95"
            >
              OK
            </button>
          )}
        </div>
      </div>

      {/* Out of tolerance message */}
      {status === 'fail' && measurement.value !== undefined && measurement.value !== null && (
        <div className="mt-2 ml-14 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <XCircle size={12} />
          Valoare în afara toleranței — Valoare: {measurement.value} {unit}
          {' '}({measurement.value < min_value ? `sub minim cu ${(min_value - measurement.value).toFixed(3)}` : `peste maxim cu ${(measurement.value - max_value).toFixed(3)}`} {unit})
        </div>
      )}
    </div>
  );
}
