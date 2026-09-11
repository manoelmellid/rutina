import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  CATEGORIAS_SEED,
  CATEGORIA_FALLBACK_ID,
  PREFERENCIAS_DEFAULT,
  normalizeDespensaEntry,
  normalizeIngrediente,
  normalizeItemCompra,
  normalizePlato,
} from './migrations';

export type TipoComida = 'comida' | 'cena';
export type Especial = 'tupper' | 'fuera';

/** Which meal slots a plato can fill. Distinct from `Comida.tipo` (no 'ambas'). */
export type PlatoTipo = 'comida' | 'cena' | 'ambas';

/** Base unit a quantity of an ingrediente is stored in. */
export type Unidad = 'g' | 'ml' | 'ud';

export type AlcanceGenerador = 'semanaEnVista' | 'diasAdelante';

/** "General" characteristic of a plato (Pasta, Carne, Pescado…). Editable from Ajustes. */
export interface Categoria {
  id: string; // slug for seeded rows, newId() for user-created
  nombre: string;
}

/** Canonical ingredient catalog entry — shared across platos, referenced by id. */
export interface Ingrediente {
  id: string;
  nombre: string;
  unidad: Unidad; // required, fixed once chosen
  tamanoPaquete: number | null; // package size in the base unit; null = a granel (deli/butcher)
  diasAbierto: number | null; // shelf life (days) once opened; null = no expiry tracking
}

export interface PlatoIngrediente {
  ingredienteId: string;
  cantidad: number; // in the referenced ingrediente's base unit
}

export interface Plato {
  id: string;
  nombre: string;
  ingredientes: PlatoIngrediente[];
  notas: string; // free text — this is the "elaboración"
  categoriaIds: string[]; // stackable; [] = sin categoría. Stored + editable, no consumer yet.
  tipo: PlatoTipo;
}

/** One row per (fecha, tipo) slot. `id` is the deterministic key `${fecha}__${tipo}`. */
export interface Comida {
  id: string;
  fecha: string; // YYYY-MM-DD
  tipo: TipoComida;
  platoId: string | null;
  especial: Especial | null;
  /** Free-text tags for especiales (e.g. ["Empanada", "Croquetas"]). */
  tags: string[];
}

export interface ItemCompra {
  id: string;
  nombre: string; // para manuales, el texto libre; para catálogo, caché de creación / fallback
  cantidad: number; // 0 = sin especificar (manuales); unidad base del ingrediente si hay ingredienteId
  comprado: boolean;
  ingredienteId?: string; // referencia al catálogo; ausente = artículo suelto (manual)
  origenComidaIds: string[]; // comidas que lo piden; [] en manuales o cuando ya no hace falta
}

/**
 * Un agregado de un ingrediente en un estado. Modelo de 2 lotes: como mucho una
 * entrada "sin abrir" y una "abierta" por ingrediente (`addToDespensa` fusiona).
 * La caducidad-una-vez-abierto no se guarda aquí: vive en `Ingrediente.diasAbierto`
 * y se deriva de `abiertoEl` cuando la Fase 6 la necesite.
 */
export interface DespensaEntry {
  id: string;
  ingredienteId: string;
  cantidad: number; // en la unidad base del ingrediente
  abiertoEl: string | null; // fecha ISO en que se abrió, o null = sin abrir
}

/** Single-row store; key is always 'main'. */
export interface Preferencias {
  id: 'main';
  semanasAntiRepeticion: number; // 0 = off
  alcanceGenerador: AlcanceGenerador;
  alcanceDiaFin: number; // Date.getDay() convention (0 = domingo)
  alcanceDiasAdelante: number; // used when alcanceGenerador === 'diasAdelante'
}

interface RutinaDB extends DBSchema {
  platos: {
    key: string;
    value: Plato;
  };
  comidas: {
    key: string;
    value: Comida;
    indexes: { 'by-fecha': string };
  };
  listaCompra: {
    key: string;
    value: ItemCompra;
  };
  ingredientes: {
    key: string;
    value: Ingrediente;
  };
  categorias: {
    key: string;
    value: Categoria;
  };
  despensa: {
    key: string;
    value: DespensaEntry;
    indexes: { 'by-ingrediente': string };
  };
  preferencias: {
    key: string;
    value: Preferencias;
  };
}

const DB_NAME = 'rutina-db';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<RutinaDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<RutinaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RutinaDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        // v1 / v2 stores (still guarded, additive)
        if (!db.objectStoreNames.contains('platos')) {
          db.createObjectStore('platos', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('comidas')) {
          const store = db.createObjectStore('comidas', { keyPath: 'id' });
          store.createIndex('by-fecha', 'fecha');
        }
        if (!db.objectStoreNames.contains('listaCompra')) {
          db.createObjectStore('listaCompra', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('ingredientes')) {
          db.createObjectStore('ingredientes', { keyPath: 'id' });
        }

        // v3 stores
        if (!db.objectStoreNames.contains('categorias')) {
          const store = db.createObjectStore('categorias', { keyPath: 'id' });
          for (const c of CATEGORIAS_SEED) await store.put(c);
        }
        if (!db.objectStoreNames.contains('despensa')) {
          const store = db.createObjectStore('despensa', { keyPath: 'id' });
          store.createIndex('by-ingrediente', 'ingredienteId');
        }
        if (!db.objectStoreNames.contains('preferencias')) {
          db.createObjectStore('preferencias', { keyPath: 'id' });
        }

        // v3 field backfill on existing rows (skips fresh installs, where oldVersion === 0)
        if (oldVersion > 0 && oldVersion < 3) {
          for await (const cursor of tx.objectStore('platos')) {
            await cursor.update(normalizePlato(cursor.value));
          }
          for await (const cursor of tx.objectStore('ingredientes')) {
            await cursor.update(normalizeIngrediente(cursor.value));
          }
        }
      },
    });
  }
  return dbPromise;
}

export function comidaId(fecha: string, tipo: TipoComida): string {
  return `${fecha}__${tipo}`;
}

export function newId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Platos
// ---------------------------------------------------------------------------

export async function getAllPlatos(): Promise<Plato[]> {
  const db = await getDB();
  return db.getAll('platos');
}

export async function savePlato(plato: Plato): Promise<void> {
  const db = await getDB();
  await db.put('platos', normalizePlato(plato));
}

export async function deletePlato(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('platos', id);
}

// ---------------------------------------------------------------------------
// Ingredientes (catálogo compartido, referenciado por Plato.ingredientes)
// ---------------------------------------------------------------------------

export async function getAllIngredientes(): Promise<Ingrediente[]> {
  const db = await getDB();
  return db.getAll('ingredientes');
}

export async function saveIngrediente(ingrediente: Ingrediente): Promise<void> {
  const db = await getDB();
  await db.put('ingredientes', normalizeIngrediente(ingrediente));
}

/**
 * Deletes from `ingredientes` only. `PlatoIngrediente` rows keep the dangling id —
 * the UI renders '(eliminado)' via the existing `ing?.nombre ?? '(eliminado)'` fallback.
 * No cascade, consistent with `deletePlato`.
 */
export async function deleteIngrediente(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('ingredientes', id);
}

export async function countPlatosConIngrediente(id: string): Promise<number> {
  const platos = await getAllPlatos();
  return platos.filter((p) => p.ingredientes.some((pi) => pi.ingredienteId === id)).length;
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

export async function getAllCategorias(): Promise<Categoria[]> {
  const db = await getDB();
  return db.getAll('categorias');
}

/** Create or rename (put by id). */
export async function saveCategoria(categoria: Categoria): Promise<void> {
  const db = await getDB();
  await db.put('categorias', categoria);
}

/** Low-level delete. Throws for the fallback id. Callers must use `mergeCategoria` when in use. */
export async function deleteCategoria(id: string): Promise<void> {
  if (id === CATEGORIA_FALLBACK_ID) {
    throw new Error('No se puede eliminar la categoría de reserva');
  }
  const db = await getDB();
  await db.delete('categorias', id);
}

export async function countPlatosConCategoria(id: string): Promise<number> {
  const platos = await getAllPlatos();
  return platos.filter((p) => p.categoriaIds.includes(id)).length;
}

/**
 * Reassigns every `Plato.categoriaIds` entry `fromId` → `toId` (deduped), then deletes `fromId`.
 * Single readwrite transaction over ['platos', 'categorias'].
 */
export async function mergeCategoria(fromId: string, toId: string): Promise<void> {
  if (fromId === CATEGORIA_FALLBACK_ID) {
    throw new Error('No se puede eliminar la categoría de reserva');
  }
  if (fromId === toId) return;
  const db = await getDB();
  const tx = db.transaction(['platos', 'categorias'], 'readwrite');
  for await (const cursor of tx.objectStore('platos')) {
    const p = cursor.value;
    if (p.categoriaIds.includes(fromId)) {
      const next = Array.from(
        new Set(p.categoriaIds.map((c) => (c === fromId ? toId : c))),
      );
      await cursor.update({ ...p, categoriaIds: next });
    }
  }
  await tx.objectStore('categorias').delete(fromId);
  await tx.done;
}

// ---------------------------------------------------------------------------
// Preferencias (fila única 'main')
// ---------------------------------------------------------------------------

export async function getPreferencias(): Promise<Preferencias> {
  const db = await getDB();
  const row = await db.get('preferencias', 'main');
  return { ...PREFERENCIAS_DEFAULT, ...(row ?? {}), id: 'main' };
}

export async function setPreferencias(p: Preferencias): Promise<void> {
  const db = await getDB();
  await db.put('preferencias', { ...PREFERENCIAS_DEFAULT, ...p, id: 'main' });
}

// ---------------------------------------------------------------------------
// Despensa
//   Fase 2: CRUD manual + fusión por ingrediente. El auto-descuento al pasar
//   los días planificados es Fase 5; el resaltado de "planificado esta semana"
//   necesita el generador (Fase 3). Aquí solo lo que no depende de eso.
// ---------------------------------------------------------------------------

export async function getDespensa(): Promise<DespensaEntry[]> {
  const db = await getDB();
  const rows = await db.getAll('despensa');
  return rows.map(normalizeDespensaEntry);
}

export async function saveDespensaEntry(entry: DespensaEntry): Promise<void> {
  const db = await getDB();
  await db.put('despensa', normalizeDespensaEntry(entry));
}

export async function deleteDespensaEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('despensa', id);
}

/**
 * Añade una entrada a la despensa. Si ya hay una entrada del mismo ingrediente
 * con el mismo estado de apertura, le suma la cantidad (un bote más = "2 botes,
 * N g"); si no, crea una entrada nueva.
 */
export async function addToDespensa(
  ingredienteId: string,
  cantidad: number,
  abierto: boolean,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('despensa', 'readwrite');
  const store = tx.objectStore('despensa');
  const existing = await store.index('by-ingrediente').getAll(ingredienteId);
  const match = existing.find((e) => (e.abiertoEl !== null) === abierto);
  if (match) {
    await store.put({ ...match, cantidad: match.cantidad + cantidad });
  } else {
    await store.put({
      id: newId(),
      ingredienteId,
      cantidad,
      abiertoEl: abierto ? toISODateString(new Date()) : null,
    });
  }
  await tx.done;
}

function toISODateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Comidas (asignación de platos a fechas)
// ---------------------------------------------------------------------------

export async function getComidasEnRango(fechaInicio: string, fechaFin: string): Promise<Comida[]> {
  const db = await getDB();
  const range = IDBKeyRange.bound(fechaInicio, fechaFin);
  return db.getAllFromIndex('comidas', 'by-fecha', range);
}

export async function getAllComidas(): Promise<Comida[]> {
  const db = await getDB();
  return db.getAll('comidas');
}

export async function setComida(comida: Comida): Promise<void> {
  const db = await getDB();
  await db.put('comidas', comida);
}

export async function clearComida(fecha: string, tipo: TipoComida): Promise<void> {
  const db = await getDB();
  await db.delete('comidas', comidaId(fecha, tipo));
}

// ---------------------------------------------------------------------------
// Lista de la compra
// ---------------------------------------------------------------------------

export async function getListaCompra(): Promise<ItemCompra[]> {
  const db = await getDB();
  const rows = await db.getAll('listaCompra');
  return rows.map(normalizeItemCompra);
}

export async function saveItemCompra(item: ItemCompra): Promise<void> {
  const db = await getDB();
  await db.put('listaCompra', normalizeItemCompra(item));
}

export async function deleteItemCompra(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('listaCompra', id);
}

// ---------------------------------------------------------------------------
// Borrar todos los datos
// ---------------------------------------------------------------------------

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear('platos'),
    db.clear('comidas'),
    db.clear('listaCompra'),
    db.clear('ingredientes'),
    db.clear('despensa'),
    db.clear('preferencias'),
    db.clear('categorias'),
  ]);
  // Re-seed the category catalog — losing it would break PlatoDetail/Ajustes until reload.
  const tx = db.transaction('categorias', 'readwrite');
  for (const c of CATEGORIAS_SEED) await tx.store.put(c);
  await tx.done;
}
