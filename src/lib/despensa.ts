import { formatCantidad } from './units';
import { formatFullDayLabel, parseISODate } from './week';
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
