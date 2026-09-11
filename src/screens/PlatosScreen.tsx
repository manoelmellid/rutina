import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { PlatoDetail } from '../features/comidas/PlatoDetail';
import sharedStyles from '../features/comidas/AsignarComidaPanel.module.css';
import { IconPlus } from '../components/icons';
import type { LayoutContext } from '../lib/layoutContext';
import {
  deletePlato,
  getAllCategorias,
  getAllComidas,
  getAllIngredientes,
  getAllPlatos,
  newId,
  savePlato,
  saveIngrediente,
  type Categoria,
  type Comida,
  type Ingrediente,
  type Plato,
  type Unidad,
} from '../lib/db';

export function PlatosScreen() {
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [comidas, setComidas] = useState<Comida[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const { setTopLeftBack, setTitle, setTopRightAction } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();
  const location = useLocation();
  // Se puede llegar aquí con un plato concreto ya elegido (ej. tocar la ficha desde
  // la vista de Semana). Solo se lee al montar; después manda el estado local.
  const [selectedId, setSelectedId] = useState<string | null>(
    (location.state as { platoId?: string } | null)?.platoId ?? null,
  );
  // Un plato recién creado con "+" vive solo aquí hasta que se pulsa "Guardar cambios" — no se
  // escribe en IndexedDB al crearlo (a diferencia de antes), así que "atrás" sin guardar no deja
  // rastro y no hace falta revertir nada.
  const [draftPlato, setDraftPlato] = useState<Plato | null>(null);

  useEffect(() => {
    Promise.all([getAllPlatos(), getAllIngredientes(), getAllComidas(), getAllCategorias()]).then(
      ([p, i, c, cat]) => {
        setPlatos(p);
        setIngredientes(i);
        setComidas(c);
        setCategorias(cat);
        setLoading(false);
      },
    );
  }, []);

  const selectedPlato =
    draftPlato && draftPlato.id === selectedId ? draftPlato : (platos.find((p) => p.id === selectedId) ?? null);

  useEffect(() => {
    if (selectedPlato) {
      setTitle(draftPlato ? 'Nuevo plato' : selectedPlato.nombre);
      setTopLeftBack({
        label: 'Platos',
        onClick: () => {
          setDraftPlato(null);
          setSelectedId(null);
        },
      });
      setTopRightAction(null);
    } else {
      setTitle(null);
      setTopLeftBack({ label: 'Comidas', onClick: () => navigate('/comidas') });
      setTopRightAction({ icon: <IconPlus />, label: 'Crear plato', onClick: () => handleCreate() });
    }
    return () => {
      setTitle(null);
      setTopLeftBack(null);
      setTopRightAction(null);
    };
  }, [selectedPlato, draftPlato, setTitle, setTopLeftBack, setTopRightAction, navigate]);

  const filtered = useMemo(() => {
    const sorted = [...platos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [platos, query]);

  function handleCreate() {
    const plato: Plato = {
      id: newId(),
      nombre: '',
      ingredientes: [],
      notas: '',
      categoriaIds: [],
      tipo: 'ambas',
    };
    setDraftPlato(plato);
    setSelectedId(plato.id);
  }

  async function handleUpdatePlato(plato: Plato) {
    await savePlato(plato);
    setPlatos((prev) =>
      prev.some((p) => p.id === plato.id) ? prev.map((p) => (p.id === plato.id ? plato : p)) : [...prev, plato],
    );
    setDraftPlato(null);
    setSelectedId(null);
  }

  async function handleDeletePlato(id: string) {
    await deletePlato(id);
    setPlatos((prev) => prev.filter((p) => p.id !== id));
    setDraftPlato(null);
    setSelectedId(null);
  }

  async function handleCreateIngrediente(data: {
    nombre: string;
    unidad: Unidad;
    tamanoPaquete: number | null;
  }): Promise<string> {
    const ingrediente: Ingrediente = { id: newId(), diasAbierto: null, ...data };
    await saveIngrediente(ingrediente);
    setIngredientes((prev) => [...prev, ingrediente]);
    return ingrediente.id;
  }

  async function handleRenameIngrediente(id: string, nombre: string) {
    const existing = ingredientes.find((i) => i.id === id);
    if (!existing) return;
    const updated = { ...existing, nombre };
    await saveIngrediente(updated);
    setIngredientes((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }

  if (loading) return null;

  if (selectedPlato) {
    return (
      <PlatoDetail
        plato={selectedPlato}
        platos={platos}
        ingredientes={ingredientes}
        categorias={categorias}
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
        placeholder="Buscar plato…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className={sharedStyles.group}>
        {filtered.length === 0 && !query.trim() && (
          <p className={sharedStyles.emptyHint}>Aún no tienes platos. Usa "+" para crear el primero.</p>
        )}
        {filtered.length === 0 && query.trim() && (
          <p className={sharedStyles.emptyHint}>Ningún plato coincide con "{query.trim()}".</p>
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
