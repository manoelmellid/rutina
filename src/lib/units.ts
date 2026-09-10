import type { Unidad } from './db';

export const UNIDAD_LABEL: Record<Unidad, string> = { g: 'g', ml: 'ml', ud: 'ud' };

/** Typed suffixes → which base unit they belong to and their multiplier to it. */
const SUFFIXES: Record<string, { base: Unidad; factor: number }> = {
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  cl: { base: 'ml', factor: 10 },
  l: { base: 'ml', factor: 1000 },
  ud: { base: 'ud', factor: 1 },
  u: { base: 'ud', factor: 1 },
  uds: { base: 'ud', factor: 1 },
  unidad: { base: 'ud', factor: 1 },
  unidades: { base: 'ud', factor: 1 },
};

/**
 * Parse a user-typed quantity into a number in `unidadBase`.
 * - no suffix        → the number is already in the base unit
 * - matching suffix  → converted (e.g. "1kg" → 1000 when base is 'g')
 * - mismatched suffix (e.g. "200 ml" when base is 'g') → null
 * - unparseable / negative / NaN → null
 */
export function parseCantidad(input: string, unidadBase: Unidad): number | null {
  const s = input.trim().toLowerCase().replace(',', '.');
  if (!s) return null;
  const m = s.match(/^([0-9]*\.?[0-9]+)\s*([a-z]*)$/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!Number.isFinite(value) || value < 0) return null;
  const suffix = m[2];
  if (!suffix) return value;
  const entry = SUFFIXES[suffix];
  if (!entry || entry.base !== unidadBase) return null;
  return value * entry.factor;
}

function trimNum(n: number): string {
  return Number(n.toFixed(3)).toString();
}

/** Base-unit number → compact display string ("1000" g → "1 kg", "250" g → "250 g"). */
export function formatCantidad(value: number, unidadBase: Unidad): string {
  if (unidadBase === 'g' && value >= 1000) return `${trimNum(value / 1000)} kg`;
  if (unidadBase === 'ml' && value >= 1000) return `${trimNum(value / 1000)} l`;
  return `${trimNum(value)} ${UNIDAD_LABEL[unidadBase]}`;
}
