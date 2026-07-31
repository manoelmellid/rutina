import { useMemo, useState } from 'react';
import sharedStyles from './AsignarComidaSheet.module.css';
import styles from './PlatoDetail.module.css';
import type { Ingrediente, Plato, PlatoIngrediente } from '../../lib/db';

interface PlatoDetailProps {
  plato: Plato;
  ingredientes: Ingrediente[];
  usageCount: number;
  onSave: (updated: Plato) => Promise<void>;
  onDelete: () => Promise<void>;
  onCreateIngrediente: (nombre: string) => Promise<string>;
  onRenameIngrediente: (id: string, nombre: string) => Promise<void>;
}

export function PlatoDetail({
  plato,
  ingredientes,
  usageCount,
  onSave,
  onDelete,
  onCreateIngrediente,
  onRenameIngrediente,
}: PlatoDetailProps) {
  const [nombre, setNombre] = useState(plato.nombre);
  const [notas, setNotas] = useState(plato.notas);
  const [items, setItems] = useState<PlatoIngrediente[]>(plato.ingredientes);
  const [addQuery, setAddQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const availableFiltered = useMemo(() => {
    const addedIds = new Set(items.map((i) => i.ingredienteId));
    const q = addQuery.trim().toLowerCase();
    return ingredientes
      .filter((ing) => !addedIds.has(ing.id))
      .filter((ing) => !q || ing.nombre.toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [ingredientes, items, addQuery]);

  const exactIngredienteMatch = ingredientes.some(
    (ing) => ing.nombre.toLowerCase() === addQuery.trim().toLowerCase(),
  );

  function addExisting(ingredienteId: string) {
    setItems((prev) => [...prev, { ingredienteId, cantidad: '' }]);
    setAddQuery('');
  }

  async function handleCreateIngrediente() {
    const nombreNuevo = addQuery.trim();
    if (!nombreNuevo) return;
    const id = await onCreateIngrediente(nombreNuevo);
    addExisting(id);
  }

  function updateCantidad(ingredienteId: string, cantidad: string) {
    setItems((prev) => prev.map((i) => (i.ingredienteId === ingredienteId ? { ...i, cantidad } : i)));
  }

  function removeItem(ingredienteId: string) {
    setItems((prev) => prev.filter((i) => i.ingredienteId !== ingredienteId));
  }

  function startRename(ing: Ingrediente) {
    setRenamingId(ing.id);
    setRenameDraft(ing.nombre);
  }

  async function commitRename() {
    if (renamingId === null) return;
    const nombreNuevo = renameDraft.trim();
    if (nombreNuevo) await onRenameIngrediente(renamingId, nombreNuevo);
    setRenamingId(null);
  }

  function handleDeleteClick() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    onDelete();
  }

  return (
    <div>
      <input
        className={sharedStyles.search}
        placeholder="Nombre del plato…"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />

      <p className={styles.sectionLabel}>Ingredientes</p>

      {items.length > 0 && (
        <div className={styles.ingredienteList}>
          {items.map((item) => {
            const ing = ingredientes.find((i) => i.id === item.ingredienteId);
            return (
              <div key={item.ingredienteId} className={styles.ingredienteRow}>
                {renamingId === item.ingredienteId ? (
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
                  <button
                    type="button"
                    className={styles.ingredienteNombre}
                    onClick={() => ing && startRename(ing)}
                  >
                    {ing?.nombre ?? '(eliminado)'}
                  </button>
                )}
                <input
                  className={styles.cantidadInput}
                  placeholder="Cantidad"
                  value={item.cantidad}
                  onChange={(e) => updateCantidad(item.ingredienteId, e.target.value)}
                />
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => removeItem(item.ingredienteId)}
                  aria-label="Quitar ingrediente"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <input
        className={sharedStyles.search}
        placeholder="Añadir ingrediente…"
        value={addQuery}
        onChange={(e) => setAddQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && addQuery.trim() && !exactIngredienteMatch) handleCreateIngrediente();
        }}
      />

      {addQuery.trim() && (
        <div className={sharedStyles.group}>
          {!exactIngredienteMatch && (
            <button
              type="button"
              className={`${sharedStyles.row} ${sharedStyles.rowAccent}`}
              onClick={handleCreateIngrediente}
            >
              + Crear "{addQuery.trim()}"
            </button>
          )}
          {availableFiltered.map((ing) => (
            <button
              key={ing.id}
              type="button"
              className={sharedStyles.row}
              onClick={() => addExisting(ing.id)}
            >
              {ing.nombre}
            </button>
          ))}
        </div>
      )}

      <p className={styles.sectionLabel}>Notas</p>
      <textarea
        className={styles.notas}
        placeholder="Notas…"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
      />

      <button
        type="button"
        className={sharedStyles.saveButton}
        onClick={() => onSave({ ...plato, nombre: nombre.trim() || plato.nombre, ingredientes: items, notas })}
      >
        Guardar cambios
      </button>

      <div className={sharedStyles.group}>
        <button
          type="button"
          className={`${sharedStyles.row} ${sharedStyles.rowDanger}`}
          onClick={handleDeleteClick}
        >
          {confirmingDelete
            ? usageCount > 0
              ? `¿Seguro? Está en ${usageCount} día(s), quedarán como "(eliminado)". Toca de nuevo para confirmar`
              : '¿Seguro? Toca de nuevo para confirmar'
            : 'Eliminar plato'}
        </button>
      </div>
    </div>
  );
}
