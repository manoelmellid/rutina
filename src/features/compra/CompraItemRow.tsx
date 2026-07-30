import styles from './CompraItemRow.module.css';
import type { ItemCompra } from '../../lib/db';

interface CompraItemRowProps {
  item: ItemCompra;
  onToggle: () => void;
  onDelete: () => void;
}

export function CompraItemRow({ item, onToggle, onDelete }: CompraItemRowProps) {
  return (
    <div className={styles.row}>
      <button
        type="button"
        className={`${styles.checkbox} ${item.comprado ? styles.checkboxChecked : ''}`}
        onClick={onToggle}
        aria-label={item.comprado ? 'Marcar como no comprado' : 'Marcar como comprado'}
      >
        {item.comprado && '✓'}
      </button>
      <button type="button" className={styles.texts} onClick={onToggle}>
        <p className={`${styles.nombre} ${item.comprado ? styles.nombreComprado : ''}`}>
          {item.nombre}
        </p>
        {item.cantidad && <p className={styles.cantidad}>{item.cantidad}</p>}
      </button>
      <button type="button" className={styles.deleteButton} onClick={onDelete} aria-label="Eliminar">
        ×
      </button>
    </div>
  );
}
