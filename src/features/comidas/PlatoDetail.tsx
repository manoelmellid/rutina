import { useMemo, useState } from 'react';
import sharedStyles from './AsignarComidaPanel.module.css';
import styles from './PlatoDetail.module.css';
import { SegmentedControl } from '../../components/SegmentedControl';
import { CategoriaPicker } from './CategoriaPicker';
import { parseCantidad, UNIDAD_LABEL } from '../../lib/units';
import type { Categoria, Ingrediente, Plato, PlatoIngrediente, PlatoTipo, Unidad } from '../../lib/db';

interface PlatoDetailProps {
  plato: Plato;
  ingredientes: Ingrediente[];
  categorias: Categoria[];
  usageCount: number;
  onSave: (updated: Plato) => Promise<void>;
  onDelete: () => Promise<void>;
  onCreateIngrediente: (data: {
    nombre: string;
    unidad: Unidad;
    tamanoPaquete: number | null;
  }) => Promise<string>;
  onRenameIngrediente: (id: string, nombre: string) => Promise<void>;
}

const TIPO_OPTIONS: { value: PlatoTipo; label: string }[] = [
  { value: 'comida', label: 'Comida' },
  { value: 'cena', label: 'Cena' },
  { value: 'ambas', label: 'Ambas' },
];

const UNIDAD_OPTIONS: { value: Unidad; label: string }[] = [
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'ud', label: 'ud' },
];

export function PlatoDetail({
  plato,
  ingredientes,
  categorias,
  usageCount,
  onSave,
  onDelete,
  onCreateIngrediente,
  onRenameIngrediente,
}: PlatoDetailProps) {
  const [nombre, setNombre] = useState(plato.nombre);
  const [notas, setNotas] = useState(plato.notas);
  const [tipo, setTipo] = useState<PlatoTipo>(plato.tipo);
  const [categoriaIds, setCategoriaIds] = useState<string[]>(plato.categoriaIds);
  const [items, setItems] = useState<PlatoIngrediente[]>(plato.ingredientes);
  const [addQuery, setAddQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // inline "crear ingrediente" form
  const [newUnidad, setNewUnidad] = useState<Unidad>('ud');
  const [newPaquete, setNewPaquete] = useState('');
  const [newGranel, setNewGranel] = useState(false);
  const [newError, setNewError] = useState(false);

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

  function resetNewForm() {
    setAddQuery('');
    setNewUnidad('ud');
    setNewPaquete('');
    setNewGranel(false);
    setNewError(false);
  }

  function addExisting(ingredienteId: string) {
    setItems((prev) => [...prev, { ingredienteId, cantidad: 0 }]);
    setAddQuery('');
  }

  async function handleCreateIngrediente() {
    const nombreNuevo = addQuery.trim();
    if (!nombreNuevo) return;
    let tamanoPaquete: number | null = null;
    if (!newGranel) {
      const parsed = parseCantidad(newPaquete, newUnidad);
      if (parsed === null || parsed <= 0) {
        setNewError(true);
        return;
      }
      tamanoPaquete = parsed;
    }
    const id = await onCreateIngrediente({ nombre: nombreNuevo, unidad: newUnidad, tamanoPaquete });
    addExisting(id);
    resetNewForm();
  }

  function updateCantidad(ingredienteId: string, cantidad: number) {
    setItems((prev) =>
      prev.map((i) => (i.ingredienteId === ingredienteId ? { ...i, cantidad } : i)),
    );
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

      <p className={styles.sectionLabel}>Tipo</p>
      <div className={styles.tipoRow}>
        <SegmentedControl<PlatoTipo> options={TIPO_OPTIONS} value={tipo} onChange={setTipo} />
      </div>

      <p className={styles.sectionLabel}>Categorías</p>
      <CategoriaPicker
        categorias={categorias}
        selected={categoriaIds}
        onToggle={(id) =>
          setCategoriaIds((prev) =>
            prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
          )
        }
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
                  type="number"
                  inputMode="decimal"
                  min="0"
                  placeholder="0"
                  value={item.cantidad || ''}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    updateCantidad(item.ingredienteId, Number.isFinite(n) && n >= 0 ? n : 0);
                  }}
                />
                <span className={styles.unitSuffix}>{ing ? UNIDAD_LABEL[ing.unidad] : ''}</span>
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
        onChange={(e) => {
          setAddQuery(e.target.value);
          setNewError(false);
        }}
      />

      {addQuery.trim() && (
        <>
          {availableFiltered.length > 0 && (
            <div className={sharedStyles.group}>
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

          {!exactIngredienteMatch && (
            <div className={styles.inlineCreate}>
              <p className={styles.inlineCreateTitle}>Crear "{addQuery.trim()}"</p>
              <SegmentedControl<Unidad>
                options={UNIDAD_OPTIONS}
                value={newUnidad}
                onChange={setNewUnidad}
              />
              <div className={styles.inlineCreateRow}>
                <input
                  className={styles.inlineCreateInput}
                  placeholder={newUnidad === 'ud' ? 'paquete: 12' : 'paquete: 400 g'}
                  value={newPaquete}
                  disabled={newGranel}
                  onChange={(e) => {
                    setNewPaquete(e.target.value);
                    setNewError(false);
                  }}
                />
                <button
                  type="button"
                  className={`${styles.granelToggle} ${newGranel ? styles.granelToggleOn : ''}`}
                  onClick={() => {
                    setNewGranel((v) => !v);
                    setNewError(false);
                  }}
                >
                  A granel
                </button>
              </div>
              {newError && (
                <p className={styles.inlineCreateError}>
                  No se entiende esa cantidad para la unidad elegida.
                </p>
              )}
              <button
                type="button"
                className={styles.inlineCreateButton}
                onClick={handleCreateIngrediente}
              >
                Crear y añadir
              </button>
            </div>
          )}
        </>
      )}

      <p className={styles.sectionLabel}>Elaboración</p>
      <textarea
        className={styles.notas}
        placeholder="Pasos, notas…"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
      />

      <button
        type="button"
        className={sharedStyles.saveButton}
        onClick={() =>
          onSave({
            ...plato,
            nombre: nombre.trim() || plato.nombre,
            ingredientes: items,
            notas,
            tipo,
            categoriaIds,
          })
        }
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
