import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import styles from './AsignarComidaPanel.module.css';
import { formatFullDayLabel, parseISODate } from '../../lib/week';
import type { LayoutContext } from '../../lib/layoutContext';
import type { Comida, Especial, Plato, TipoComida } from '../../lib/db';

interface AsignarComidaPanelProps {
  fecha: string;
  tipo: TipoComida;
  platos: Plato[];
  currentComida: Comida | undefined;
  onClose: () => void;
  onAssignPlato: (platoId: string) => void;
  onAssignEspecial: (especial: Especial, tags: string[]) => void;
  onCreatePlato: (nombre: string) => Promise<string>;
  onClear: () => void;
}

type Mode = 'list' | 'tupper' | 'fuera';

export function AsignarComidaPanel({
  fecha,
  tipo,
  platos,
  currentComida,
  onClose,
  onAssignPlato,
  onAssignEspecial,
  onCreatePlato,
  onClear,
}: AsignarComidaPanelProps) {
  const { setTopLeftBack, setTitle } = useOutletContext<LayoutContext>();
  const dateLabel = formatFullDayLabel(parseISODate(fecha));
  const tipoLabel = tipo === 'comida' ? 'comida' : 'cena';
  const [mode, setMode] = useState<Mode>('list');
  const [query, setQuery] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(currentComida?.tags ?? []);

  useEffect(() => {
    if (mode === 'list') {
      setTitle(`Asignar ${tipoLabel}`);
      setTopLeftBack({ label: 'Comidas', onClick: onClose });
    } else {
      setTitle(mode === 'tupper' ? 'Tupper' : 'Fuera');
      setTopLeftBack({ label: 'Atrás', onClick: () => setMode('list') });
    }
    return () => {
      setTitle(null);
      setTopLeftBack(null);
    };
  }, [mode, tipoLabel, onClose, setTitle, setTopLeftBack]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return platos;
    return platos.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [platos, query]);

  const exactMatch = platos.some((p) => p.nombre.toLowerCase() === query.trim().toLowerCase());

  async function handleCreateAndAssign() {
    const nombre = query.trim();
    if (!nombre) return;
    const id = await onCreatePlato(nombre);
    onAssignPlato(id);
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    setTags((prev) => [...prev, t]);
    setTagInput('');
  }

  if (mode === 'tupper' || mode === 'fuera') {
    return (
      <div>
        <p className={styles.dateLabel}>{dateLabel}</p>

        {tags.length > 0 && (
          <div className={styles.tagsWrap}>
            {tags.map((t, i) => (
              <span key={i} className={styles.tag}>
                {t}
                <button
                  type="button"
                  className={styles.tagRemove}
                  onClick={() => setTags((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          className={styles.search}
          placeholder="Añadir nota (ej. Empanada) y pulsa Enter"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
        />

        <button
          type="button"
          className={styles.saveButton}
          onClick={() => onAssignEspecial(mode, tags)}
        >
          Guardar
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className={styles.dateLabel}>{dateLabel}</p>

      <input
        className={styles.search}
        placeholder="Buscar o crear plato…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {currentComida && (
        <div className={styles.group}>
          <button type="button" className={`${styles.row} ${styles.rowDanger}`} onClick={onClear}>
            Quitar asignación
          </button>
        </div>
      )}

      <div className={styles.group}>
        <button type="button" className={styles.row} onClick={() => setMode('tupper')}>
          <span>Tupper</span>
          <span className={styles.rowSecondary}>›</span>
        </button>
        <button type="button" className={styles.row} onClick={() => setMode('fuera')}>
          <span>Fuera</span>
          <span className={styles.rowSecondary}>›</span>
        </button>
      </div>

      <div className={styles.group}>
        {query.trim() && !exactMatch && (
          <button type="button" className={`${styles.row} ${styles.rowAccent}`} onClick={handleCreateAndAssign}>
            + Crear "{query.trim()}"
          </button>
        )}
        {filtered.length === 0 && !query.trim() && (
          <p className={styles.emptyHint}>Aún no tienes platos. Escribe uno arriba para crearlo.</p>
        )}
        {filtered.map((p) => (
          <button key={p.id} type="button" className={styles.row} onClick={() => onAssignPlato(p.id)}>
            {p.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}
