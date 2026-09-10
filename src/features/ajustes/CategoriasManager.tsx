import { useMemo, useState } from 'react';
import sharedStyles from '../comidas/AsignarComidaPanel.module.css';
import styles from './CategoriasManager.module.css';
import {
  countPlatosConCategoria,
  deleteCategoria,
  mergeCategoria,
  newId,
  saveCategoria,
  type Categoria,
} from '../../lib/db';
import { CATEGORIA_FALLBACK_ID } from '../../lib/migrations';

interface CategoriasManagerProps {
  categorias: Categoria[];
  onChange: () => void;
}

interface DeleteState {
  id: string;
  count: number;
  target: string;
}

export function CategoriasManager({ categorias, onChange }: CategoriasManagerProps) {
  const [nombre, setNombre] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);

  const sorted = useMemo(
    () => [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [categorias],
  );

  async function handleCreate() {
    const n = nombre.trim();
    if (!n) return;
    await saveCategoria({ id: newId(), nombre: n });
    setNombre('');
    onChange();
  }

  function startRename(c: Categoria) {
    setRenamingId(c.id);
    setRenameDraft(c.nombre);
    setDeleteState(null);
  }

  async function commitRename() {
    if (renamingId === null) return;
    const n = renameDraft.trim();
    const id = renamingId;
    setRenamingId(null);
    if (n) {
      await saveCategoria({ id, nombre: n });
      onChange();
    }
  }

  async function startDelete(id: string) {
    const count = await countPlatosConCategoria(id);
    if (count === 0) {
      await deleteCategoria(id);
      onChange();
      return;
    }
    const firstOther = sorted.find((c) => c.id !== id);
    setDeleteState({ id, count, target: firstOther?.id ?? CATEGORIA_FALLBACK_ID });
    setRenamingId(null);
  }

  async function confirmMerge() {
    if (!deleteState) return;
    const { id, target } = deleteState;
    setDeleteState(null);
    await mergeCategoria(id, target);
    onChange();
  }

  return (
    <div>
      <div className={styles.addRow}>
        <input
          className={styles.addInput}
          placeholder="Nueva categoría…"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
          }}
        />
        <button type="button" className={styles.addButton} onClick={handleCreate}>
          Añadir
        </button>
      </div>

      <div className={sharedStyles.group}>
        {sorted.map((c) => {
          const isFallback = c.id === CATEGORIA_FALLBACK_ID;
          const merging = deleteState?.id === c.id;
          return (
            <div key={c.id} className={styles.rowWrap}>
              <div className={sharedStyles.row}>
                {renamingId === c.id ? (
                  <input
                    className={styles.renameInput}
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                    }}
                    autoFocus
                  />
                ) : (
                  <button type="button" className={styles.name} onClick={() => startRename(c)}>
                    {c.nombre}
                  </button>
                )}
                {!isFallback && !merging && (
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => startDelete(c.id)}
                    aria-label={`Eliminar ${c.nombre}`}
                  >
                    Eliminar
                  </button>
                )}
              </div>

              {merging && deleteState && (
                <div className={styles.mergeRow}>
                  <p className={styles.mergeText}>
                    En {deleteState.count} plato(s). Mover a:
                  </p>
                  <select
                    className={styles.select}
                    value={deleteState.target}
                    onChange={(e) => setDeleteState({ ...deleteState, target: e.target.value })}
                  >
                    {sorted
                      .filter((o) => o.id !== c.id)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nombre}
                        </option>
                      ))}
                  </select>
                  <div className={styles.mergeActions}>
                    <button type="button" className={styles.cancelButton} onClick={() => setDeleteState(null)}>
                      Cancelar
                    </button>
                    <button type="button" className={styles.confirmButton} onClick={confirmMerge}>
                      Mover y eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
