import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { PlatoDetail } from '../features/comidas/PlatoDetail';
import sharedStyles from '../features/comidas/AsignarComidaSheet.module.css';
import type { LayoutContext } from '../lib/layoutContext';
import {
  deletePlato,
  getAllComidas,
  getAllIngredientes,
  getAllPlatos,
  newId,
  savePlato,
  saveIngrediente,
  type Comida,
  type Ingrediente,
  type Plato,
} from '../lib/db';

export function PlatosScreen() {
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [comidas, setComidas] = useState<Comida[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { setTopLeftBack, setTitle } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getAllPlatos(), getAllIngredientes(), getAllComidas()]).then(([p, i, c]) => {
      setPlatos(p);
      setIngredientes(i);
      setComidas(c);
      setLoading(false);
    });
  }, []);

  const selectedPlato = platos.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedPlato) {
      setTitle(selectedPlato.nombre);
      setTopLeftBack({ label: 'Platos', onClick: () => setSelectedId(null) });
    } else {
      setTitle(null);
      setTopLeftBack({ label: 'Comidas', onClick: () => navigate('/comidas') });
    }
    return () => {
      setTitle(null);
      setTopLeftBack(null);
    };
  }, [selectedPlato, setTitle, setTopLeftBack, navigate]);

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
    const plato: Plato = { id: newId(), nombre, ingredientes: [], notas: '' };
    await savePlato(plato);
    setPlatos((prev) => [...prev, plato]);
    setQuery('');
    setSelectedId(plato.id);
  }

  async function handleUpdatePlato(plato: Plato) {
    await savePlato(plato);
    setPlatos((prev) => prev.map((p) => (p.id === plato.id ? plato : p)));
    setSelectedId(null);
  }

  async function handleDeletePlato(id: string) {
    await deletePlato(id);
    setPlatos((prev) => prev.filter((p) => p.id !== id));
    setSelectedId(null);
  }

  async function handleCreateIngrediente(nombre: string): Promise<string> {
    const ingrediente: Ingrediente = { id: newId(), nombre };
    await saveIngrediente(ingrediente);
    setIngredientes((prev) => [...prev, ingrediente]);
    return ingrediente.id;
  }

  async function handleRenameIngrediente(id: string, nombre: string) {
    const ingrediente: Ingrediente = { id, nombre };
    await saveIngrediente(ingrediente);
    setIngredientes((prev) => prev.map((i) => (i.id === id ? ingrediente : i)));
  }

  if (loading) return null;

  if (selectedPlato) {
    return (
      <PlatoDetail
        plato={selectedPlato}
        ingredientes={ingredientes}
        usageCount={comidas.filter((c) => c.platoId === selectedPlato.id).length}
        onSave={handleUpdatePlato}
        onDelete={() => handleDeletePlato(selectedPlato.id)}
        onCreateIngrediente={handleCreateIngrediente}
        onRenameIngrediente={handleRenameIngrediente}
      />
    );
  }

  return (
    <div>
      <input
        className={sharedStyles.search}
        placeholder="Buscar o crear plato…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && query.trim() && !exactMatch) handleCreate();
        }}
        autoFocus
      />

      <div className={sharedStyles.group}>
        {query.trim() && !exactMatch && (
          <button type="button" className={`${sharedStyles.row} ${sharedStyles.rowAccent}`} onClick={handleCreate}>
            + Crear "{query.trim()}"
          </button>
        )}
        {filtered.length === 0 && !query.trim() && (
          <p className={sharedStyles.emptyHint}>Aún no tienes platos. Escribe uno arriba para crearlo.</p>
        )}
        {filtered.map((p) => (
          <button key={p.id} type="button" className={sharedStyles.row} onClick={() => setSelectedId(p.id)}>
            <span>{p.nombre}</span>
            <span className={sharedStyles.rowSecondary}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
