import { type Comida, type DespensaEntry, type Ingrediente, type ItemCompra, type Plato } from './db';
import { addDays, parseISODate, toISODate } from './week';

export interface VentanaCompra {
  desde: string;
  hasta: string;
}

/** Ventana rodante: hoy + 7 días (8 días en total). Avanza un día cada día. */
export function ventanaCompra(hoy: Date): VentanaCompra {
  return { desde: toISODate(hoy), hasta: toISODate(addDays(hoy, 7)) };
}

export interface ReconciliarInput {
  items: ItemCompra[]; // lista actual completa (manuales + de catálogo)
  comidas: Comida[]; // ya recortadas a la ventana (getComidasEnRango)
  platos: Plato[];
  despensa: DespensaEntry[];
  ingredientes: Ingrediente[];
}

export interface ReconciliarResultado {
  items: ItemCompra[]; // lista final a pintar/guardar en estado
  aGuardar: ItemCompra[]; // subconjunto nuevo o modificado respecto a la entrada
  aBorrar: string[]; // ids a eliminar (no comprados que ya no hacen falta)
}

function origenCambio(a: string[], b: string[]): boolean {
  return a.length !== b.length || a.some((v, i) => v !== b[i]);
}

/**
 * Recalcula los artículos de catálogo (con `ingredienteId`) contra el plan de la ventana
 * y la despensa. No toca los artículos manuales.
 *
 * Reglas:
 * - necesario(ingrediente) = suma de `PlatoIngrediente.cantidad` de los platos asignados en
 *   `comidas` que lo usan **y que aún no se hayan consumido** (`consumoAplicado === null`) — una
 *   comida ya consumida ya restó su ingrediente de la despensa (F5), así que su necesidad ya está
 *   reflejada ahí (como saldo bajo, o como déficit en negativo); sumar también su cantidad aquí la
 *   contaría dos veces. Pero SÍ se sigue registrando el ingrediente (con cantidad 0 si todas las
 *   comidas que lo tocan ya se consumieron) para que una deuda existente en la despensa por ese
 *   ingrediente no quede fuera del cálculo — solo se evita sumar la cantidad de más, no ignorar el
 *   ingrediente entero. 2026-09-15, dos bugs reales seguidos: (1) la comida de HOY (la única fecha
 *   de la ventana que puede estar ya consumida y a la vez seguir dentro del rango) se sumaba dos
 *   veces — ej. una pizza ya cocinada hoy pedía comprar 2 masas de pizza en vez de 1; (2) el primer
 *   arreglo de (1) se pasó de frenada y excluía la comida entera en vez de solo su cantidad, así
 *   que un ingrediente que SOLO tocaba una comida ya consumida (sin ninguna otra comida pendiente
 *   que lo pidiera) dejaba de aparecer aunque la despensa tuviera una deuda real por él.
 *   Déficit = necesario − disponible en despensa.
 * - déficit <= 0 → el ingrediente no entra en la lista (la despensa ya lo cubre), salvo que ya
 *   hubiera un artículo comprado para él, que se conserva con `origenComidaIds: []` (aviso "ya no
 *   hace falta" en la UI).
 * - déficit > 0 → cantidad a comprar = paquete completo redondeado hacia arriba
 *   (`Ingrediente.tamanoPaquete`), o el déficit exacto si es a granel (`tamanoPaquete: null`).
 * - un artículo de catálogo que ya no aparece en `necesario` (nadie lo pide esta vez): se borra si
 *   no está comprado; si está comprado se conserva con el mismo aviso de "ya no hace falta".
 */
export function reconciliarListaCompra(input: ReconciliarInput): ReconciliarResultado {
  const platoById = new Map(input.platos.map((p) => [p.id, p]));
  const ingredienteById = new Map(input.ingredientes.map((i) => [i.id, i]));

  const necesario = new Map<string, { cantidad: number; comidaIds: Set<string> }>();
  for (const c of input.comidas) {
    if (!c.platoId) continue;
    const plato = platoById.get(c.platoId);
    if (!plato) continue;
    for (const pi of plato.ingredientes) {
      const entry = necesario.get(pi.ingredienteId) ?? { cantidad: 0, comidaIds: new Set<string>() };
      if (c.consumoAplicado === null) entry.cantidad += pi.cantidad;
      entry.comidaIds.add(c.id);
      necesario.set(pi.ingredienteId, entry);
    }
  }

  const disponible = new Map<string, number>();
  for (const e of input.despensa) {
    disponible.set(e.ingredienteId, (disponible.get(e.ingredienteId) ?? 0) + e.cantidad);
  }

  const existentesPorIngrediente = new Map<string, ItemCompra>();
  const manuales: ItemCompra[] = [];
  for (const item of input.items) {
    if (item.ingredienteId) existentesPorIngrediente.set(item.ingredienteId, item);
    else manuales.push(item);
  }

  const items: ItemCompra[] = [...manuales];
  const aGuardar: ItemCompra[] = [];
  const aBorrar: string[] = [];
  const vistos = new Set<string>();

  for (const [ingredienteId, { cantidad, comidaIds }] of necesario) {
    vistos.add(ingredienteId);
    const existente = existentesPorIngrediente.get(ingredienteId);
    const ing = ingredienteById.get(ingredienteId);
    const deficit = cantidad - (disponible.get(ingredienteId) ?? 0);
    const origenComidaIds = [...comidaIds];

    if (deficit <= 0) {
      if (existente?.comprado) {
        const actualizado = { ...existente, origenComidaIds: [] };
        items.push(actualizado);
        if (origenCambio(existente.origenComidaIds, [])) aGuardar.push(actualizado);
      } else if (existente) {
        // Sigue apareciendo en `necesario` pero ya no en déficit (p. ej. la despensa lo cubre
        // de sobra tras quitar el doble conteo de arriba) — sin esto, la fila existente se queda
        // huérfana en el store para siempre (invisible, `vistos` la protege de la limpieza de
        // más abajo).
        aBorrar.push(existente.id);
      }
      continue; // cubierto por la despensa: no entra a la lista
    }

    const cantidadAComprar = ing?.tamanoPaquete
      ? Math.ceil(deficit / ing.tamanoPaquete) * ing.tamanoPaquete
      : deficit;

    if (existente) {
      const actualizado = { ...existente, cantidad: cantidadAComprar, origenComidaIds };
      items.push(actualizado);
      if (
        actualizado.cantidad !== existente.cantidad ||
        origenCambio(existente.origenComidaIds, origenComidaIds)
      ) {
        aGuardar.push(actualizado);
      }
    } else {
      // id determinista (= ingredienteId, único por catálogo): si dos reconciliaciones se
      // solapan (p. ej. doble montaje en StrictMode) ambas escriben el mismo registro en vez
      // de crear artículos duplicados con ids al azar.
      const nuevo: ItemCompra = {
        id: ingredienteId,
        nombre: ing?.nombre ?? '(eliminado)',
        ingredienteId,
        cantidad: cantidadAComprar,
        origenComidaIds,
        comprado: false,
      };
      items.push(nuevo);
      aGuardar.push(nuevo);
    }
  }

  for (const [ingredienteId, existente] of existentesPorIngrediente) {
    if (vistos.has(ingredienteId)) continue; // ya tratado arriba
    if (existente.comprado) {
      const actualizado = { ...existente, origenComidaIds: [] };
      items.push(actualizado);
      if (existente.origenComidaIds.length > 0) aGuardar.push(actualizado);
    } else {
      aBorrar.push(existente.id);
    }
  }

  return { items, aGuardar, aBorrar };
}

/** Días de margen antes de considerar urgente ir a la compra (para Hoy). Fijo, no configurable. */
export const UMBRAL_COMPRA_DIAS = 3;

export interface EstadoCompra {
  pendientes: number; // artículos sin comprar (catálogo + manuales)
  diasHastaNecesario: number | null; // días hasta la comida más próxima que los necesita, o null
}

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Estado de la lista de la compra para el resumen de Hoy: cuántos artículos faltan y cuándo. */
export function estadoCompra(
  items: ItemCompra[],
  comidasPorId: Map<string, Comida>,
  hoy: Date,
): EstadoCompra {
  const pendientes = items.filter((i) => !i.comprado);
  let diasHastaNecesario: number | null = null;
  for (const item of pendientes) {
    for (const comidaId of item.origenComidaIds) {
      const comida = comidasPorId.get(comidaId);
      if (!comida) continue;
      const dias = Math.round(
        (atMidnight(parseISODate(comida.fecha)).getTime() - atMidnight(hoy).getTime()) / 86_400_000,
      );
      if (diasHastaNecesario === null || dias < diasHastaNecesario) diasHastaNecesario = dias;
    }
  }
  return { pendientes: pendientes.length, diasHastaNecesario };
}

export function esCompraUrgente(estado: EstadoCompra): boolean {
  return (
    estado.pendientes > 0 &&
    estado.diasHastaNecesario !== null &&
    estado.diasHastaNecesario <= UMBRAL_COMPRA_DIAS
  );
}

const DIA_CORTO = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });

/** "Tortitas (lun), Bizcocho (mié)" — qué plato/día pide un artículo de catálogo. */
export function etiquetaOrigen(
  origenComidaIds: string[],
  comidasPorId: Map<string, Comida>,
  platoById: Map<string, Plato>,
): string {
  return origenComidaIds
    .map((id) => comidasPorId.get(id))
    .filter((c): c is Comida => c !== undefined)
    .sort((a, b) => (a.fecha === b.fecha ? 0 : a.fecha < b.fecha ? -1 : 1))
    .map((c) => {
      const dia = DIA_CORTO.format(parseISODate(c.fecha));
      const diaCap = dia.charAt(0).toUpperCase() + dia.slice(1);
      const nombrePlato = c.platoId ? (platoById.get(c.platoId)?.nombre ?? '(eliminado)') : '';
      return nombrePlato ? `${nombrePlato} (${diaCap})` : diaCap;
    })
    .join(', ');
}
