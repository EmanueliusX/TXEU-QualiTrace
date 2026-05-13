import React from 'react';
import { Usb, Unplug, Bluetooth, AlertCircle, Loader2 } from 'lucide-react';
import { CaliperStatus } from '../hooks/useSerial';

interface CaliperBarProps {
  status: CaliperStatus;
  lastValue: number | null;
  error: string | null;
  isSupported: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  activeFieldName?: string;
}

export default function CaliperBar({
  status, lastValue, error, isSupported, onConnect, onDisconnect, activeFieldName
}: CaliperBarProps) {
  const statusConfig = {
    disconnected: { color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', label: 'Subler deconectat' },
    connecting: { color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400', label: 'Se conectează...' },
    connected: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Subler conectat' },
    error: { color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500', label: 'Eroare conexiune' },
  };
  const cfg = statusConfig[status];

  return (
    <div className={`flex items-center gap-4 px-4 py-2.5 rounded-xl border text-sm font-medium ${cfg.color}`}>
      {/* Status dot + icon */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${cfg.dot} ${status === 'connecting' ? 'animate-pulse' : ''}`} />
        {status === 'connecting' ? <Loader2 size={16} className="animate-spin" /> : <Usb size={16} />}
        <span>{cfg.label}</span>
      </div>

      {/* Last value */}
      {status === 'connected' && lastValue !== null && (
        <div className="flex items-center gap-2 pl-3 border-l border-emerald-200">
          <span className="text-xs text-emerald-600">Ultima valoare:</span>
          <span className="font-bold text-emerald-800 text-base">{lastValue.toFixed(3)} mm</span>
          {activeFieldName && <span className="text-xs text-emerald-600">→ {activeFieldName}</span>}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1 pl-3 border-l border-red-200 text-red-600">
          <AlertCircle size={14} />
          <span className="text-xs">{error}</span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      {!isSupported && (
        <span className="text-xs text-slate-500">Chrome/Edge necesar pentru Web Serial</span>
      )}
      {isSupported && status === 'disconnected' && (
        <button
          onClick={onConnect}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs
            font-semibold rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Usb size={13} />
          Conectează Subler
        </button>
      )}
      {isSupported && status === 'connected' && (
        <button
          onClick={onDisconnect}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-600 text-xs
            font-semibold rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
        >
          <Unplug size={13} />
          Deconectează
        </button>
      )}
      {isSupported && status === 'error' && (
        <button
          onClick={onConnect}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-brand-600 text-xs
            font-semibold rounded-lg border border-brand-200 hover:bg-brand-50 transition-colors"
        >
          Reconectează
        </button>
      )}
    </div>
  );
}
