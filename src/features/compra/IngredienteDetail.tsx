import { useState } from 'react';
import sharedStyles from '../comidas/AsignarComidaPanel.module.css';
import styles from './IngredienteDetail.module.css';
import { SegmentedControl } from '../../components/SegmentedControl';
import { formatCantidad, parseCantidad } from '../../lib/units';
import type { Ingrediente, Unidad } from '../../lib/db';

interface IngredienteDetailProps {
  ingrediente: Ingrediente;
  usageCount: number;
  onSave: (updated: Ingrediente) => Promise<void>;
  onDelete: () => Promise<void>;
}

const UNIDAD_OPTIONS: { value: Unidad; label: string }[] = [
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'ud', label: 'ud' },
];

export function IngredienteDetail({
  ingrediente,
  usageCount,
  onSave,
  onDelete,
}: IngredienteDetailProps) {
  const [nombre, setNombre] = useState(ingrediente.nombre);
  const [unidad, setUnidad] = useState<Unidad>(ingrediente.unidad);
  const [aGranel, setAGranel] = useState(ingrediente.tamanoPaquete === null);
  const [paqueteInput, setPaqueteInput] = useState(
    ingrediente.tamanoPaquete !== null
      ? formatCantidad(ingrediente.tamanoPaquete, ingrediente.unidad)
      : '',
  );
  const [paqueteError, setPaqueteError] = useState(false);
  const [dias, setDias] = useState(
    ingrediente.diasAbierto !== null ? String(ingrediente.diasAbierto) : '',
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function normalizePaqueteOnBlur() {
    if (aGranel || !paqueteInput.trim()) return;
    const parsed = parseCantidad(paqueteInput, unidad);
    if (parsed !== null && parsed > 0) {
      setPaqueteInput(formatCantidad(parsed, unidad));
      setPaqueteError(false);
    } else {
      setPaqueteError(true);
    }
  }

  async function handleSave() {
    let tamanoPaquete: number | null = null;
    if (!aGranel) {
      const parsed = parseCantidad(paqueteInput, unidad);
      if (parsed === null || parsed <= 0) {
        setPaqueteError(true);
        return;
      }
      tamanoPaquete = parsed;
    }
    const diasNum = dias.trim() ? Math.round(Number(dias)) : NaN;
    await onSave({
      ...ingrediente,
      nombre: nombre.trim() || ingrediente.nombre,
      unidad,
      tamanoPaquete,
      diasAbierto: Number.isFinite(diasNum) && diasNum > 0 ? diasNum : null,
    });
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
        placeholder="Nombre del ingrediente…"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />

      <p className={styles.fieldLabel}>Unidad</p>
      <SegmentedControl<Unidad> options={UNIDAD_OPTIONS} value={unidad} onChange={setUnidad} />
      {usageCount > 0 && (
        <p className={styles.hint}>
          Cambiar la unidad no convierte las cantidades ya puestas en los platos.
        </p>
      )}

      <p className={styles.fieldLabel}>Tamaño del paquete</p>
      <div className={styles.paqueteRow}>
        <input
          className={styles.paqueteInput}
          placeholder={unidad === 'ud' ? 'ej. 12' : unidad === 'ml' ? 'ej. 1 l' : 'ej. 400 g'}
          value={paqueteInput}
          disabled={aGranel}
          onChange={(e) => {
            setPaqueteInput(e.target.value);
            setPaqueteError(false);
          }}
          onBlur={normalizePaqueteOnBlur}
        />
        <button
          type="button"
          className={`${styles.granelToggle} ${aGranel ? styles.granelToggleOn : ''}`}
          onClick={() => {
            setAGranel((v) => !v);
            setPaqueteError(false);
          }}
        >
          A granel
        </button>
      </div>
      {paqueteError && (
        <p className={styles.error}>No se entiende esa cantidad para la unidad elegida.</p>
      )}

      <p className={styles.fieldLabel}>Días que dura abierto (opcional)</p>
      <input
        className={styles.diasInput}
        type="number"
        inputMode="numeric"
        min="1"
        placeholder="ej. 7"
        value={dias}
        onChange={(e) => setDias(e.target.value)}
      />

      <button type="button" className={sharedStyles.saveButton} onClick={handleSave}>
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
              ? `¿Seguro? Está en ${usageCount} plato(s), quedará como "(eliminado)". Toca de nuevo`
              : '¿Seguro? Toca de nuevo para confirmar'
            : 'Eliminar ingrediente'}
        </button>
      </div>
    </div>
  );
}
