import type {
  Categoria,
  DespensaEntry,
  Ingrediente,
  ItemCompra,
  Plato,
  PlatoTipo,
  Preferencias,
  Unidad,
} from './db';

/** Fallback category — used as a read-time default and protected from deletion. */
export const CATEGORIA_FALLBACK_ID = 'otros';

/** Seeded once when the `categorias` store is first created. Slug ids are stable. */
export const CATEGORIAS_SEED: Categoria[] = [
  { id: 'pasta', nombre: 'Pasta' },
  { id: 'arroz', nombre: 'Arroz' },
  { id: 'carne', nombre: 'Carne' },
  { id: 'pescado', nombre: 'Pescado' },
  { id: 'marisco', nombre: 'Marisco' },
  { id: 'verdura', nombre: 'Verdura' },
  { id: 'legumbre', nombre: 'Legumbre' },
  { id: 'huevo', nombre: 'Huevo' },
  { id: 'sopa-crema', nombre: 'Sopa/Crema' },
  { id: CATEGORIA_FALLBACK_ID, nombre: 'Otros' },
];

export const PREFERENCIAS_DEFAULT: Preferencias = {
  id: 'main',
  semanasAntiRepeticion: 1,
  alcanceGenerador: 'semanaEnVista',
  alcanceDiaFin: 0, // Date.getDay() — 0 = domingo
  alcanceDiasAdelante: 7,
};

const UNIDADES: Unidad[] = ['g', 'ml', 'ud'];
const TIPOS: PlatoTipo[] = ['comida', 'cena', 'ambas'];

/** Lenient number parse: accepts number or string, Spanish comma, returns a finite >= 0 number or 0. */
function toNumberOrZero(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return 0;
}

/** Backfills an ingrediente row to the current shape. Shared by `upgrade()` and `importBackup()`. */
export function normalizeIngrediente(raw: Partial<Ingrediente> & { id: string }): Ingrediente {
  return {
    id: raw.id,
    nombre: String(raw.nombre ?? ''),
    unidad: raw.unidad && UNIDADES.includes(raw.unidad) ? raw.unidad : 'ud',
    tamanoPaquete:
      typeof raw.tamanoPaquete === 'number' && raw.tamanoPaquete > 0 ? raw.tamanoPaquete : null,
    diasAbierto:
      typeof raw.diasAbierto === 'number' && raw.diasAbierto > 0 ? raw.diasAbierto : null,
  };
}

/**
 * Backfills a despensa row to the current shape. Shared by `getDespensa()` and
 * `importBackup()`. Drops the legacy `caducidad` field (now derived from the
 * ingrediente, not stored).
 */
export function normalizeDespensaEntry(
  raw: Partial<DespensaEntry> & { id: string },
): DespensaEntry {
  return {
    id: raw.id,
    ingredienteId: String(raw.ingredienteId ?? ''),
    cantidad: toNumberOrZero(raw.cantidad),
    abiertoEl: typeof raw.abiertoEl === 'string' && raw.abiertoEl ? raw.abiertoEl : null,
  };
}

/** Backfills a plato row to the current shape. Shared by `upgrade()` and `importBackup()`. */
export function normalizePlato(
  raw: Partial<Omit<Plato, 'ingredientes'>> & { id: string; ingredientes?: unknown },
): Plato {
  const ingredientes = Array.isArray(raw.ingredientes)
    ? raw.ingredientes
        .filter((pi): pi is { ingredienteId: string; cantidad?: unknown } =>
          Boolean(pi) && typeof (pi as { ingredienteId?: unknown }).ingredienteId === 'string',
        )
        .map((pi) => ({ ingredienteId: pi.ingredienteId, cantidad: toNumberOrZero(pi.cantidad) }))
    : [];

  return {
    id: raw.id,
    nombre: String(raw.nombre ?? ''),
    notas: String(raw.notas ?? ''),
    tipo: raw.tipo && TIPOS.includes(raw.tipo) ? raw.tipo : 'ambas',
    categoriaIds: Array.isArray(raw.categoriaIds)
      ? raw.categoriaIds.filter((c): c is string => typeof c === 'string')
      : [],
    ingredientes,
  };
}

/** Backfills un artículo de compra a la forma actual. Compartido por `saveItemCompra`/
 * `getListaCompra` y `importBackup()`. Las filas antiguas traían `cantidad: ''` (string) y
 * `origenComidaId` (singular, nunca usado) — `toNumberOrZero('')` da 0 sin más esfuerzo. */
export function normalizeItemCompra(raw: Partial<ItemCompra> & { id: string }): ItemCompra {
  return {
    id: raw.id,
    nombre: String(raw.nombre ?? ''),
    cantidad: toNumberOrZero(raw.cantidad),
    comprado: Boolean(raw.comprado),
    ingredienteId:
      typeof raw.ingredienteId === 'string' && raw.ingredienteId ? raw.ingredienteId : undefined,
    origenComidaIds: Array.isArray(raw.origenComidaIds)
      ? raw.origenComidaIds.filter((c): c is string => typeof c === 'string')
      : [],
  };
}
