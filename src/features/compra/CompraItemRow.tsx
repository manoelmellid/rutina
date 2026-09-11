import styles from './CompraItemRow.module.css';

interface CompraItemRowProps {
  nombre: string;
  comprado: boolean;
  cantidadLabel?: string;
  origenLabel?: string;
  avisoObsoleto?: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

export function CompraItemRow({
  nombre,
  comprado,
  cantidadLabel,
  origenLabel,
  avisoObsoleto,
  onToggle,
  onDelete,
}: CompraItemRowProps) {
  return (
    <div className={styles.row}>
      <button
        type="button"
        className={`${styles.checkbox} ${comprado ? styles.checkboxChecked : ''}`}
        onClick={onToggle}
        aria-label={comprado ? 'Marcar como no comprado' : 'Marcar como comprado'}
      >
        {comprado && '✓'}
      </button>
      <button type="button" className={styles.texts} onClick={onToggle}>
        <p className={`${styles.nombre} ${comprado ? styles.nombreComprado : ''}`}>
          {nombre}
          {avisoObsoleto && <span className={styles.avisoObsoleto}>ya no hace falta</span>}
        </p>
        {cantidadLabel && <p className={styles.cantidad}>{cantidadLabel}</p>}
        {origenLabel && <p className={styles.origen}>{origenLabel}</p>}
      </button>
      <button type="button" className={styles.deleteButton} onClick={onDelete} aria-label="Eliminar">
        ×
      </button>
    </div>
  );
}
