import { addDays, toISODate } from './week';
import {
  addToDespensa,
  consumirDeDespensa,
  getAllPlatos,
  getComidasEnRango,
  setComida,
  type Comida,
  type Plato,
  type PlatoIngrediente,
} from './db';

interface DecisionConsumo {
  comidaActualizada: Comida;
  aAplicar: PlatoIngrediente[]; // restar de la despensa (y abrir su lote si hace falta)
  aRevertir: PlatoIngrediente[]; // devolver a la despensa (lote abierto)
  cambia: boolean; // false = nada que hacer (ni setComida ni tocar despensa)
}

/**
 * Pura: decide qué hace falta ajustar en la despensa para que `comida.consumoAplicado` refleje
 * la realidad de hoy (¿toca ya, con qué plato?). No escribe nada — eso lo hace
 * `sincronizarConsumoComida`. Solo reacciona a *qué plato* tiene asignada la comida, no al
 * contenido de `Plato.ingredientes` en sí: si el plato ya asignado cambia su receta después de
 * haberse consumido, ese consumo pasado no se recalcula (alcance explícito de esta fase).
 */
function decidirConsumo(comida: Comida, plato: Plato | undefined, hoy: Date): DecisionConsumo {
  const toca = comida.platoId !== null && comida.fecha <= toISODate(hoy);
  const deseado = toca ? { platoId: comida.platoId!, ingredientes: plato?.ingredientes ?? [] } : null;
  const actual = comida.consumoAplicado;

  const sinCambios =
    (actual === null && deseado === null) ||
    (actual !== null && deseado !== null && actual.platoId === deseado.platoId);
  if (sinCambios) return { comidaActualizada: comida, aAplicar: [], aRevertir: [], cambia: false };

  return {
    comidaActualizada: { ...comida, consumoAplicado: deseado },
    aAplicar: deseado?.ingredientes ?? [],
    aRevertir: actual?.ingredientes ?? [],
    cambia: true,
  };
}

/**
 * Aplica `decidirConsumo` para una comida concreta: revierte lo del plato anterior si lo hubiera,
 * aplica lo del plato actual si toca, y guarda la comida con `consumoAplicado` al día. Devuelve la
 * comida actualizada si hubo cambios, o `null` si no hacía falta tocar nada (llamada barata,
 * segura de invocar siempre que se guarda/borra una comida).
 */
export async function sincronizarConsumoComida(
  comida: Comida,
  platoById: Map<string, Plato>,
  hoy: Date,
): Promise<Comida | null> {
  const decision = decidirConsumo(comida, comida.platoId ? platoById.get(comida.platoId) : undefined, hoy);
  if (!decision.cambia) return null;
  for (const pi of decision.aRevertir) await addToDespensa(pi.ingredienteId, pi.cantidad, true);
  for (const pi of decision.aAplicar) await consumirDeDespensa(pi.ingredienteId, pi.cantidad);
  await setComida(decision.comidaActualizada);
  return decision.comidaActualizada;
}

const VENTANA_DIAS = 60; // cuánto para atrás se revisa en el barrido de arranque

let enCurso: Promise<void> | null = null;

/**
 * Barrido de arranque: revisa las comidas de los últimos `VENTANA_DIAS` días hasta hoy y
 * sincroniza cada una (la mayoría son no-ops baratos: ya están al día). Deduplicado con un guard
 * en memoria para que un doble montaje del efecto que la llama (p. ej. React StrictMode) no
 * aplique el mismo consumo dos veces — misma lección que el bug de ids duplicados de Compra/F4.
 */
export function sincronizarConsumoPendiente(hoy: Date): Promise<void> {
  if (enCurso) return enCurso;
  enCurso = ejecutar(hoy).finally(() => {
    enCurso = null;
  });
  return enCurso;
}

async function ejecutar(hoy: Date): Promise<void> {
  const desde = toISODate(addDays(hoy, -VENTANA_DIAS));
  const hasta = toISODate(hoy);
  const [comidas, platos] = await Promise.all([getComidasEnRango(desde, hasta), getAllPlatos()]);
  const platoById = new Map(platos.map((p) => [p.id, p]));
  for (const comida of comidas) {
    await sincronizarConsumoComida(comida, platoById, hoy);
  }
}
