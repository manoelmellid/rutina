import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { IngredienteDetail } from '../features/compra/IngredienteDetail';
import sharedStyles from '../features/comidas/AsignarComidaPanel.module.css';
import type { LayoutContext } from '../lib/layoutContext';
import {
  deleteIngrediente,
  getAllIngredientes,
  getAllPlatos,
  newId,
  saveIngrediente,
  type Ingrediente,
  type Plato,
} from '../lib/db';

export function IngredientesScreen() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const { setTopLeftBack, setTitle } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedId, setSelectedId] = useState<string | null>(
    (location.state as { ingredienteId?: string } | null)?.ingredienteId ?? null,
  );

  useEffect(() => {
    Promise.all([getAllIngredientes(), getAllPlatos()]).then(([i, p]) => {
      setIngredientes(i);
      setPlatos(p);
      setLoading(false);
    });
  }, []);

  const selected = ingredientes.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setTitle(selected.nombre);
      setTopLeftBack({ label: 'Ingredientes', onClick: () => setSelectedId(null) });
    } else {
      setTitle(null);
      setTopLeftBack({ label: 'Compra', onClick: () => navigate('/compra') });
    }
    return () => {
      setTitle(null);
      setTopLeftBack(null);
    };
  }, [selected, setTitle, setTopLeftBack, navigate]);

  const filtered = useMemo(() => {
    const sorted = [...ingredientes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((i) => i.nombre.toLowerCase().includes(q));
  }, [ingredientes, query]);

  const exactMatch = ingredientes.some(
    (i) => i.nombre.toLowerCase() === query.trim().toLowerCase(),
  );

  function usageCount(id: string): number {
    return platos.filter((p) => p.ingredientes.some((pi) => pi.ingredienteId === id)).length;
  }

  async function handleCreate() {
    const nombre = query.trim();
    if (!nombre) return;
    const ingrediente: Ingrediente = {
      id: newId(),
      nombre,
      unidad: 'ud',
      tamanoPaquete: null,
      diasAbierto: null,
    };
    await saveIngrediente(ingrediente);
    setIngredientes((prev) => [...prev, ingrediente]);
    setQuery('');
    setSelectedId(ingrediente.id);
  }

  async function handleUpdate(updated: Ingrediente) {
    await saveIngrediente(updated);
    setIngredientes((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelectedId(null);
  }

  async function handleDelete(id: string) {
    await deleteIngrediente(id);
    setIngredientes((prev) => prev.filter((i) => i.id !== id));
    setSelectedId(null);
  }

  if (loading) return null;

  if (selected) {
    return (
      <IngredienteDetail
        ingrediente={selected}
        usageCount={usageCount(selected.id)}
        onSave={handleUpdate}
        onDelete={() => handleDelete(selected.id)}
      />
    );
  }

  return (
    <div>
      <input
        className={sharedStyles.search}
        placeholder="Buscar o crear ingrediente…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && query.trim() && !exactMatch) handleCreate();
        }}
      />

      <div className={sharedStyles.group}>
        {query.trim() && !exactMatch && (
          <button
            type="button"
            className={`${sharedStyles.row} ${sharedStyles.rowAccent}`}
            onClick={handleCreate}
          >
            + Crear "{query.trim()}"
          </button>
        )}
        {filtered.length === 0 && !query.trim() && (
          <p className={sharedStyles.emptyHint}>
            Aún no tienes ingredientes. Escribe uno arriba para crearlo.
          </p>
        )}
        {filtered.map((i) => (
          <button
            key={i.id}
            type="button"
            className={sharedStyles.row}
            onClick={() => setSelectedId(i.id)}
          >
            <span>{i.nombre}</span>
            <span className={sharedStyles.rowSecondary}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
