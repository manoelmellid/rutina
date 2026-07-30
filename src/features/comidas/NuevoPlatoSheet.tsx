import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import styles from './AsignarComidaSheet.module.css';

interface NuevoPlatoSheetProps {
  onClose: () => void;
  onCreate: (nombre: string) => Promise<void>;
}

export function NuevoPlatoSheet({ onClose, onCreate }: NuevoPlatoSheetProps) {
  const [nombre, setNombre] = useState('');

  async function handleCreate() {
    const n = nombre.trim();
    if (!n) return;
    await onCreate(n);
    onClose();
  }

  return (
    <Sheet title="Nuevo plato" onClose={onClose}>
      <input
        className={styles.search}
        placeholder="Nombre del plato…"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreate();
        }}
        autoFocus
      />
      <button type="button" className={styles.saveButton} onClick={handleCreate}>
        Crear
      </button>
    </Sheet>
  );
}
