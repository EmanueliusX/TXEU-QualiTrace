const INSPECTION_TIME_ZONE = 'Europe/Bucharest';

function parseInspectionTimestamp(value?: string | null): Date | null {
  if (!value) return null;
  const iso = value.replace(' ', 'T');
  // Legacy SQLite timestamps are UTC even though they have no zone suffix.
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatInspectionTime(value: string, options?: Intl.DateTimeFormatOptions): string {
  const date = parseInspectionTimestamp(value);
  return date?.toLocaleString('ro-RO', { ...options, timeZone: INSPECTION_TIME_ZONE }) ?? '—';
}
