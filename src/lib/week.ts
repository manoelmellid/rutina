export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow; // Monday as first day
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function getWeekDays(weekOffset: number): Date[] {
  const monday = addDays(startOfWeek(new Date()), weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const DAY_FORMATTER = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric' });
const RANGE_FORMATTER = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

export function formatDayLabel(d: Date): string {
  const label = DAY_FORMATTER.format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatWeekRangeLabel(days: Date[]): string {
  const first = RANGE_FORMATTER.format(days[0]);
  const last = RANGE_FORMATTER.format(days[6]);
  return `${first} – ${last}`;
}

export function isSameDate(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b);
}
