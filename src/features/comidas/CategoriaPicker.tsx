import { useMemo } from 'react';
import styles from './CategoriaPicker.module.css';
import type { Categoria } from '../../lib/db';

interface CategoriaPickerProps {
  categorias: Categoria[];
  selected: string[];
  onToggle: (id: string) => void;
}

export function CategoriaPicker({ categorias, selected, onToggle }: CategoriaPickerProps) {
  const sorted = useMemo(
    () => [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [categorias],
  );

  return (
    <div className={styles.wrap}>
      {sorted.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`${styles.chip} ${selected.includes(c.id) ? styles.chipActive : ''}`}
          onClick={() => onToggle(c.id)}
        >
          {c.nombre}
        </button>
      ))}
    </div>
  );
}
