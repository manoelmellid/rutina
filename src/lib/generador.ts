import { comidaId, type Comida, type Plato, type Preferencias, type TipoComida } from './db';
import { addDays, formatRangeLabel, parseISODate, toISODate } from './week';

const TIPOS: TipoComida[] = ['comida', 'cena'];

export interface SlotObjetivo {
  fecha: string; // YYYY-MM-DD
  tipo: TipoComida;
}

export interface PropuestaSlot {
  fecha: string;
  tipo: TipoComida;
  platoId: string | null; // null = no había ningún plato candidato
  perecederoUrgente: boolean; // el plato elegido usa un ingrediente que caduca pronto (Fase 6)
}

export interface ResultadoGeneracion {
  propuestas: PropuestaSlot[];
  sinCandidato: number;
}

export interface GeneradorInput {
  slots: SlotObjetivo[]; // ya recortados al alcance (ver slotsObjetivo)
  platos: Plato[];
  comidas: Comida[]; // todas — para anti-repetición y para saltar huecos ya ocupados
  despensaIngredienteIds: Set<string>;
  perecederosUrgentesIds: Set<string>; // ingredientes con lote abierto que caduca pronto (Fase 6)
  semanasAntiRepeticion: number; // 0 = desactivado
  rango: { desde: string; hasta: string }; // fechas del alcance (para la ventana anti-rep)
  rng?: () => number; // por defecto Math.random
}

/**
 * Decide qué (fecha, tipo) entran en el sorteo según `Preferencias.alcanceGenerador`.
 * `semanaEnVista`: desde hoy hasta la PRÓXIMA fecha (incluido hoy) cuyo `getDay() ===
 * alcanceDiaFin` — puramente relativo a hoy, nunca a qué semana esté en vista en Comidas. Si ese
 * día de la semana ya pasó esta semana, salta a la semana siguiente (máx. 6 días por delante) en
 * vez de dar un rango vacío. `diasAdelante`: `alcanceDiasAdelante` días a partir de hoy.
 */
export function slotsObjetivo(prefs: Preferencias, hoy: Date): SlotObjetivo[] {
  let fechas: string[];

  if (prefs.alcanceGenerador === 'diasAdelante') {
    fechas = Array.from({ length: prefs.alcanceDiasAdelante }, (_, i) => toISODate(addDays(hoy, i)));
  } else {
    let dias = 0;
    while (addDays(hoy, dias).getDay() !== prefs.alcanceDiaFin && dias < 6) dias++;
    fechas = Array.from({ length: dias + 1 }, (_, i) => toISODate(addDays(hoy, i)));
  }

  return fechas.flatMap((fecha) => TIPOS.map((tipo) => ({ fecha, tipo })));
}

/** Slots de `slots` que todavía no tienen una `Comida` asignada (ni por el usuario ni por una generación previa). */
export function huecosVacios(slots: SlotObjetivo[], comidas: Comida[]): SlotObjetivo[] {
  const comidaByKey = new Map(comidas.map((c) => [c.id, c]));
  return slots.filter((s) => !comidaByKey.has(comidaId(s.fecha, s.tipo)));
}

/** Frase para el diálogo de confirmación, p. ej. "del 8 sept – 10 sept" / "de los próximos 3 días (…)". */
export function describirAlcance(prefs: Preferencias, slots: SlotObjetivo[]): string {
  const fechas = [...new Set(slots.map((s) => s.fecha))].sort();
  if (fechas.length === 0) return '';
  const rango = formatRangeLabel(parseISODate(fechas[0]), parseISODate(fechas[fechas.length - 1]));
  return prefs.alcanceGenerador === 'diasAdelante'
    ? `de los próximos ${prefs.alcanceDiasAdelante} días (${rango})`
    : `del ${rango}`;
}

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Fisher–Yates in place, con `rng` inyectable. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Construye el sorteador para un `input` dado: candidatos filtrados por tipo, anti-repetición
 * (con degradación) y el sesgo caducidad-pronto > despensa > pool tal cual. `usadosEstaTanda` se
 * pasa por referencia — el llamador decide cuándo añadir un plato elegido (para que la ventana de
 * "ya usado esta tanda" se pueda componer de comidas reales, de otras filas de una propuesta ya
 * generada, o de ambas — ver `planificar` y `rehacerSlot`). Compartido para no duplicar la lógica.
 */
function crearElegidor(input: GeneradorInput, usadosEstaTanda: Set<string>) {
  const rng = input.rng ?? Math.random;
  const platoById = new Map(input.platos.map((p) => [p.id, p]));

  const usadosRecientes = new Set<string>();
  if (input.semanasAntiRepeticion > 0) {
    const desde = toISODate(addDays(parseISODate(input.rango.desde), -7 * input.semanasAntiRepeticion));
    const hasta = toISODate(addDays(parseISODate(input.rango.desde), -1));
    for (const c of input.comidas) {
      if (c.platoId && c.fecha >= desde && c.fecha <= hasta) usadosRecientes.add(c.platoId);
    }
  }

  function usaDespensa(platoId: string): boolean {
    const plato = platoById.get(platoId);
    if (!plato) return false;
    return plato.ingredientes.some((pi) => input.despensaIngredienteIds.has(pi.ingredienteId));
  }

  function usaPerecederoUrgente(platoId: string): boolean {
    const plato = platoById.get(platoId);
    if (!plato) return false;
    return plato.ingredientes.some((pi) => input.perecederosUrgentesIds.has(pi.ingredienteId));
  }

  function elegir(tipo: TipoComida): string | null {
    const base = input.platos.filter((p) => p.tipo === 'ambas' || p.tipo === tipo).map((p) => p.id);
    if (base.length === 0) return null;

    const escalones = [
      base.filter((id) => !usadosRecientes.has(id) && !usadosEstaTanda.has(id)),
      base.filter((id) => !usadosEstaTanda.has(id)),
      base,
    ];
    const pool = escalones.find((e) => e.length > 0) ?? base;

    // Prioridad: lo que caduca pronto > lo que ya hay en la despensa > el pool tal cual.
    const conUrgente = pool.filter(usaPerecederoUrgente);
    const conDespensa = pool.filter(usaDespensa);
    const candidatos = conUrgente.length > 0 ? conUrgente : conDespensa.length > 0 ? conDespensa : pool;
    return pickRandom(candidatos, rng);
  }

  return { elegir, usaPerecederoUrgente };
}

/**
 * Sorteo aleatorio y sencillo: filtra por tipo de plato, evita repetir lo usado recientemente
 * (degradando si hace falta), y dentro de eso sesga hacia platos con algún ingrediente ya en
 * la despensa. Puro — no lee ni escribe la base de datos.
 */
export function planificar(input: GeneradorInput): ResultadoGeneracion {
  const rng = input.rng ?? Math.random;
  const huecos = huecosVacios(input.slots, input.comidas);

  const usadosEstaTanda = new Set<string>();
  for (const c of input.comidas) {
    if (c.platoId && c.fecha >= input.rango.desde && c.fecha <= input.rango.hasta) {
      usadosEstaTanda.add(c.platoId);
    }
  }

  const { elegir, usaPerecederoUrgente } = crearElegidor(input, usadosEstaTanda);

  const propuestas: PropuestaSlot[] = [];
  for (const slot of shuffle(huecos, rng)) {
    const platoId = elegir(slot.tipo);
    if (platoId) usadosEstaTanda.add(platoId);
    propuestas.push({
      fecha: slot.fecha,
      tipo: slot.tipo,
      platoId,
      perecederoUrgente: platoId !== null && usaPerecederoUrgente(platoId),
    });
  }

  propuestas.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    if (a.tipo === b.tipo) return 0;
    return a.tipo === 'comida' ? -1 : 1;
  });

  return { propuestas, sinCandidato: propuestas.filter((p) => p.platoId === null).length };
}

/**
 * Vuelve a sortear UNA fila de una propuesta ya generada (botón "volver a tirar" por fila en
 * `PropuestaGeneradorPanel`), dejando el resto igual. `usadosEstaTanda` se reconstruye con las
 * comidas reales del rango más los platos de las OTRAS filas de `propuestaActual` (para no
 * duplicar lo que ya salió en la misma tanda), excluyendo la fila que se está rehaciendo.
 */
export function rehacerSlot(
  input: GeneradorInput,
  propuestaActual: PropuestaSlot[],
  index: number,
): PropuestaSlot {
  const slot = propuestaActual[index];
  const usadosEstaTanda = new Set<string>();
  for (const c of input.comidas) {
    if (c.platoId && c.fecha >= input.rango.desde && c.fecha <= input.rango.hasta) {
      usadosEstaTanda.add(c.platoId);
    }
  }
  propuestaActual.forEach((p, i) => {
    if (i !== index && p.platoId) usadosEstaTanda.add(p.platoId);
  });

  const { elegir, usaPerecederoUrgente } = crearElegidor(input, usadosEstaTanda);
  const platoId = elegir(slot.tipo);
  return { ...slot, platoId, perecederoUrgente: platoId !== null && usaPerecederoUrgente(platoId) };
}
