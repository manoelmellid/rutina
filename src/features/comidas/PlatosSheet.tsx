import { useMemo, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { PlatoDetail } from './PlatoDetail';
import styles from './AsignarComidaSheet.module.css';
import type { Comida, Ingrediente, Plato } from '../../lib/db';

interface PlatosSheetProps {
  platos: Plato[];
  ingredientes: Ingrediente[];
  comidas: Comida[];
  onClose: () => void;
  onCreatePlato: (nombre: string) => Promise<string>;
  onUpdatePlato: (plato: Plato) => Promise<void>;
  onDeletePlato: (id: string) => Promise<void>;
  onCreateIngrediente: (nombre: string) => Promise<string>;
  onRenameIngrediente: (id: string, nombre: string) => Promise<void>;
}

export function PlatosSheet({
  platos,
  ingredientes,
  comidas,
  onClose,
  onCreatePlato,
  onUpdatePlato,
  onDeletePlato,
  onCreateIngrediente,
  onRenameIngrediente,
}: PlatosSheetProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const sorted = [...platos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [platos, query]);

  const exactMatch = platos.some((p) => p.nombre.toLowerCase() === query.trim().toLowerCase());

  async function handleCreate() {
    const nombre = query.trim();
    if (!nombre) return;
    const id = await onCreatePlato(nombre);
    setQuery('');
    setSelectedId(id);
  }

  const selectedPlato = platos.find((p) => p.id === selectedId) ?? null;

  if (selectedPlato) {
    return (
      <PlatoDetail
        plato={selectedPlato}
        ingredientes={ingredientes}
        usageCount={comidas.filter((c) => c.platoId === selectedPlato.id).length}
        onBack={() => setSelectedId(null)}
        onClose={onClose}
        onSave={async (updated) => {
          await onUpdatePlato(updated);
          setSelectedId(null);
        }}
        onDelete={async () => {
          await onDeletePlato(selectedPlato.id);
          setSelectedId(null);
        }}
        onCreateIngrediente={onCreateIngrediente}
        onRenameIngrediente={onRenameIngrediente}
      />
    );
  }

  return (
    <Sheet title="Platos" onClose={onClose}>
      <input
        className={styles.search}
        placeholder="Buscar o crear plato…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && query.trim() && !exactMatch) handleCreate();
        }}
        autoFocus
      />

      <div className={styles.group}>
        {query.trim() && !exactMatch && (
          <button type="button" className={`${styles.row} ${styles.rowAccent}`} onClick={handleCreate}>
            + Crear "{query.trim()}"
          </button>
        )}
        {filtered.length === 0 && !query.trim() && (
          <p className={styles.emptyHint}>Aún no tienes platos. Escribe uno arriba para crearlo.</p>
        )}
        {filtered.map((p) => (
          <button key={p.id} type="button" className={styles.row} onClick={() => setSelectedId(p.id)}>
            <span>{p.nombre}</span>
            <span className={styles.rowSecondary}>›</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
