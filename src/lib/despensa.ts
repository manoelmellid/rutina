import { formatCantidad } from './units';
import { addDays, formatFullDayLabel, parseISODate } from './week';
import type { Comida, DespensaEntry, Ingrediente, Plato } from './db';

/** Los lotes de un ingrediente en la despensa. Modelo de 2 lotes: sin abrir + abierto. */
export interface LotesDeIngrediente {
  ingredienteId: string;
  sinAbrir: DespensaEntry | null;
  abierto: DespensaEntry | null;
  total: number;
}

/**
 * Agrupa entradas planas en `{ sinAbrir, abierto }` por ingrediente, ordenado por
 * nombre de ingrediente (los que no están en el catálogo van al final).
 */
export function agruparDespensa(
  entries: DespensaEntry[],
  ingredientes: Map<string, Ingrediente>,
): LotesDeIngrediente[] {
  const porIngrediente = new Map<string, LotesDeIngrediente>();
  for (const e of entries) {
    let grupo = porIngrediente.get(e.ingredienteId);
    if (!grupo) {
      grupo = { ingredienteId: e.ingredienteId, sinAbrir: null, abierto: null, total: 0 };
      porIngrediente.set(e.ingredienteId, grupo);
    }
    if (e.abiertoEl !== null) grupo.abierto = e;
    else grupo.sinAbrir = e;
    grupo.total += e.cantidad;
  }

  return [...porIngrediente.values()].sort((a, b) => {
    const na = ingredientes.get(a.ingredienteId)?.nombre ?? '￿';
    const nb = ingredientes.get(b.ingredienteId)?.nombre ?? '￿';
    return na.localeCompare(nb, 'es');
  });
}

/**
 * Texto de resumen para la fila de lista:
 *   solo sin abrir → "1 kg"
 *   solo abierto    → "320 g abierto"
 *   los dos         → "1 kg + 320 g abierto"
 *   sin catálogo    → cantidad total en crudo
 */
export function resumenLotes(l: LotesDeIngrediente, ing: Ingrediente | undefined): string {
  if (!ing) return String(l.total);
  const partes: string[] = [];
  if (l.sinAbrir) partes.push(formatCantidad(l.sinAbrir.cantidad, ing.unidad));
  if (l.abierto) partes.push(`${formatCantidad(l.abierto.cantidad, ing.unidad)} abierto`);
  return partes.join(' + ');
}

/** "Abierto el viernes 12 sept" / "Sin abrir" para el detalle. */
export function etiquetaLote(e: DespensaEntry): string {
  if (!e.abiertoEl) return 'Sin abrir';
  return `Abierto el ${formatFullDayLabel(parseISODate(e.abiertoEl)).toLowerCase()}`;
}

/**
 * ingredienteIds que usan los platos ya asignados (con `platoId`) en esas comidas — para
 * resaltar en la Despensa "esto lo usa un plato planificado esta semana". Tupper/Fuera y
 * huecos vacíos no aportan nada; un plato borrado (`platoId` colgante) tampoco.
 */
export function ingredientesEnPlan(comidas: Comida[], platos: Map<string, Plato>): Set<string> {
  const ids = new Set<string>();
  for (const c of comidas) {
    if (!c.platoId) continue;
    const plato = platos.get(c.platoId);
    if (!plato) continue;
    for (const pi of plato.ingredientes) ids.add(pi.ingredienteId);
  }
  return ids;
}

/** "Caduca pronto" si quedan ≤ N días (o ya caducó). Fijo, sin UI para cambiarlo (decisión F6). */
export const UMBRAL_CADUCIDAD_DIAS = 3;

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Días hasta que caduque un lote, o `null` si no aplica: sin abrir (nunca tiene fecha,
 * `abiertoEl === null`) o el ingrediente no trackea vida útil (`diasAbierto === null`). Negativo
 * = ya caducado hace ese número de días. No hay tope superior: un lote olvidado hace meses
 * simplemente da un número negativo grande — misma filosofía tolerante que el resto de Despensa
 * (no es una fuente de verdad estricta, se corrige a mano cuando hace falta).
 */
export function diasHastaCaducar(
  entry: DespensaEntry,
  ing: Ingrediente | undefined,
  hoy: Date,
): number | null {
  if (!ing || entry.abiertoEl === null || ing.diasAbierto === null) return null;
  const caduca = addDays(parseISODate(entry.abiertoEl), ing.diasAbierto);
  return Math.round((atMidnight(caduca).getTime() - atMidnight(hoy).getTime()) / 86_400_000);
}

/** "Caducado hace 2 días" / "Caduca hoy" / "Caduca mañana" / "Caduca en 5 días". */
export function etiquetaCaducidad(dias: number): string {
  if (dias < 0) return `Caducado hace ${-dias} día${-dias === 1 ? '' : 's'}`;
  if (dias === 0) return 'Caduca hoy';
  if (dias === 1) return 'Caduca mañana';
  return `Caduca en ${dias} días`;
}

export function esUrgente(dias: number | null): boolean {
  return dias !== null && dias <= UMBRAL_CADUCIDAD_DIAS;
}

/** ingredienteIds cuyo lote abierto caduca pronto (o ya caducó) — para sesgar el generador. */
export function ingredientesUrgentes(
  despensa: DespensaEntry[],
  ingredientes: Map<string, Ingrediente>,
  hoy: Date,
): Set<string> {
  const ids = new Set<string>();
  for (const e of despensa) {
    if (esUrgente(diasHastaCaducar(e, ingredientes.get(e.ingredienteId), hoy))) ids.add(e.ingredienteId);
  }
  return ids;
}
