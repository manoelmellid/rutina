import {
  getDB,
  mergeDespensaEntryInto,
  type Categoria,
  type Comida,
  type DespensaEntry,
  type Ingrediente,
  type ItemCompra,
  type Plato,
  type Preferencias,
} from './db';
import {
  CATEGORIAS_SEED,
  PREFERENCIAS_DEFAULT,
  normalizeComida,
  normalizeDespensaEntry,
  normalizeIngrediente,
  normalizeItemCompra,
  normalizePlato,
} from './migrations';

interface BackupData {
  formatVersion: 1 | 2 | 3;
  exportedAt: string;
  platos: Plato[];
  comidas: Comida[];
  listaCompra: ItemCompra[];
  ingredientes?: Ingrediente[];
  categorias?: Categoria[];
  despensa?: DespensaEntry[];
  preferencias?: Preferencias | null;
}

export async function exportBackup(): Promise<void> {
  const db = await getDB();
  const data: BackupData = {
    formatVersion: 3,
    exportedAt: new Date().toISOString(),
    platos: await db.getAll('platos'),
    comidas: await db.getAll('comidas'),
    listaCompra: await db.getAll('listaCompra'),
    ingredientes: await db.getAll('ingredientes'),
    categorias: await db.getAll('categorias'),
    despensa: await db.getAll('despensa'),
    preferencias: (await db.get('preferencias', 'main')) ?? null,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fecha = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `rutina-backup-${fecha}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export type ImportMode = 'reemplazar' | 'fusionar';

/**
 * Restaura un backup. `'reemplazar'` (por defecto) borra todo antes de meter el contenido del
 * fichero — comportamiento original. `'fusionar'` no borra nada: cada `plato`/`ingrediente`/
 * `comida`/`item`/`categoria` se inserta o actualiza por `id` (upsert), y cada entrada de
 * `despensa` se fusiona por `(ingredienteId, abierto)` vía `mergeDespensaEntryInto` (misma lógica
 * que `addToDespensa`, sumando cantidad si ya había una entrada equivalente) para no romper el
 * modelo de 2 lotes. Pensado para meter datos predefinidos (platos de prueba, seeds) sin perder lo
 * que ya hubiera en la app.
 */
export async function importBackup(file: File, mode: ImportMode = 'reemplazar'): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text) as Partial<BackupData>;

  if (data.formatVersion !== 1 && data.formatVersion !== 2 && data.formatVersion !== 3) {
    throw new Error('Formato de backup no reconocido');
  }

  const db = await getDB();
  const tx = db.transaction(
    ['platos', 'comidas', 'listaCompra', 'ingredientes', 'categorias', 'despensa', 'preferencias'],
    'readwrite',
  );

  if (mode === 'reemplazar') {
    await Promise.all([
      tx.objectStore('platos').clear(),
      tx.objectStore('comidas').clear(),
      tx.objectStore('listaCompra').clear(),
      tx.objectStore('ingredientes').clear(),
      tx.objectStore('categorias').clear(),
      tx.objectStore('despensa').clear(),
      tx.objectStore('preferencias').clear(),
    ]);
  }

  for (const plato of data.platos ?? []) {
    await tx.objectStore('platos').put(normalizePlato(plato));
  }
  for (const ingrediente of data.ingredientes ?? []) {
    await tx.objectStore('ingredientes').put(normalizeIngrediente(ingrediente));
  }
  for (const comida of data.comidas ?? []) {
    await tx.objectStore('comidas').put(normalizeComida(comida));
  }
  for (const item of data.listaCompra ?? []) {
    await tx.objectStore('listaCompra').put(normalizeItemCompra(item));
  }
  for (const entry of data.despensa ?? []) {
    const normalized = normalizeDespensaEntry(entry);
    if (mode === 'fusionar') {
      await mergeDespensaEntryInto(tx.objectStore('despensa'), normalized);
    } else {
      await tx.objectStore('despensa').put(normalized);
    }
  }

  const categorias = data.categorias?.length ? data.categorias : CATEGORIAS_SEED;
  for (const categoria of categorias) {
    await tx.objectStore('categorias').put(categoria);
  }

  if (data.preferencias) {
    await tx.objectStore('preferencias').put({
      ...PREFERENCIAS_DEFAULT,
      ...data.preferencias,
      id: 'main',
    });
  }

  await tx.done;
}
