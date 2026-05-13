import { useState, useCallback, useRef } from 'react';

export type CaliperStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseSerialOptions {
  baudRate?: number;
  onValue?: (value: number) => void;
}

// Parse common caliper ASCII formats:
// "  12.350\r\n", "+12.350\n", "12.35 mm\r\n", "  +12.3500 \r\n"
function parseCaliperValue(raw: string): number | null {
  const cleaned = raw.trim().replace(/[^\d.+\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 1000) / 1000;
}

export function useSerial({ baudRate = 9600, onValue }: UseSerialOptions = {}) {
  const [status, setStatus] = useState<CaliperStatus>('disconnected');
  const [lastValue, setLastValue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const portRef = useRef<any>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const bufferRef = useRef<string>('');

  const isSupported = 'serial' in navigator;

  const connect = useCallback(async () => {
    if (!isSupported) {
      setError('Web Serial API nu este suportat. Folosiți Chrome sau Edge.');
      setStatus('error');
      return;
    }
    try {
      setStatus('connecting');
      setError(null);
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none' });
      portRef.current = port;
      setStatus('connected');

      const reader = port.readable.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();

      // Read loop
      const readLoop = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            bufferRef.current += decoder.decode(value, { stream: true });
            // Process complete lines
            const lines = bufferRef.current.split(/\r?\n/);
            bufferRef.current = lines.pop() ?? '';
            for (const line of lines) {
              if (line.trim()) {
                const parsed = parseCaliperValue(line);
                if (parsed !== null) {
                  setLastValue(parsed);
                  onValue?.(parsed);
                }
              }
            }
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            setError('Conexiune pierdută cu sublerulul');
            setStatus('error');
          }
        } finally {
          setStatus('disconnected');
        }
      };

      readLoop();
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        // User cancelled port selection
        setStatus('disconnected');
      } else {
        setError(`Eroare conexiune: ${err.message}`);
        setStatus('error');
      }
    }
  }, [baudRate, onValue, isSupported]);

  const disconnect = useCallback(async () => {
    try {
      readerRef.current?.cancel();
      readerRef.current = null;
      await portRef.current?.close();
      portRef.current = null;
    } catch {}
    setStatus('disconnected');
    setLastValue(null);
  }, []);

  return { status, lastValue, error, isSupported, connect, disconnect };
}
