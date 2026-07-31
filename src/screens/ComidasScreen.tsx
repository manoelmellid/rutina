import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { WeekNav } from '../features/comidas/WeekNav';
import { DayCard } from '../features/comidas/DayCard';
import { AsignarComidaSheet } from '../features/comidas/AsignarComidaSheet';
import { PlatosSheet } from '../features/comidas/PlatosSheet';
import { IconPlus } from '../components/icons';
import type { LayoutContext } from '../lib/layoutContext';
import { getWeekDays, toISODate } from '../lib/week';
import {
  comidaId,
  deletePlato,
  getAllComidas,
  getAllIngredientes,
  getAllPlatos,
  newId,
  savePlato,
  saveIngrediente,
  setComida,
  clearComida,
  type Comida,
  type Especial,
  type Ingrediente,
  type Plato,
  type TipoComida,
} from '../lib/db';

interface SlotSelection {
  fecha: string;
  tipo: TipoComida;
}

export function ComidasScreen() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [comidas, setComidas] = useState<Comida[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<SlotSelection | null>(null);
  const [platosSheetOpen, setPlatosSheetOpen] = useState(false);
  const { setTopRightAction } = useOutletContext<LayoutContext>();

  useEffect(() => {
    Promise.all([getAllPlatos(), getAllComidas(), getAllIngredientes()]).then(([p, c, i]) => {
      setPlatos(p);
      setComidas(c);
      setIngredientes(i);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setTopRightAction({ icon: <IconPlus />, label: 'Platos', onClick: () => setPlatosSheetOpen(true) });
    return () => setTopRightAction(null);
  }, [setTopRightAction]);

  const days = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  function getComida(fecha: string, tipo: TipoComida): Comida | undefined {
    return comidas.find((c) => c.id === comidaId(fecha, tipo));
  }

  function getPlatoNombre(platoId: string): string {
    return platos.find((p) => p.id === platoId)?.nombre ?? '(eliminado)';
  }

  function upsertLocalComida(c: Comida) {
    setComidas((prev) => [...prev.filter((x) => x.id !== c.id), c]);
  }

  async function handleCreatePlato(nombre: string): Promise<string> {
    const plato: Plato = { id: newId(), nombre, ingredientes: [], notas: '' };
    await savePlato(plato);
    setPlatos((prev) => [...prev, plato]);
    return plato.id;
  }

  async function handleUpdatePlato(plato: Plato) {
    await savePlato(plato);
    setPlatos((prev) => prev.map((p) => (p.id === plato.id ? plato : p)));
  }

  async function handleDeletePlato(id: string) {
    await deletePlato(id);
    setPlatos((prev) => prev.filter((p) => p.id !== id));
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

  async function handleAssignPlato(platoId: string) {
    if (!selection) return;
    const c: Comida = {
      id: comidaId(selection.fecha, selection.tipo),
      fecha: selection.fecha,
      tipo: selection.tipo,
      platoId,
      especial: null,
      tags: [],
    };
    await setComida(c);
    upsertLocalComida(c);
    setSelection(null);
  }

  async function handleAssignEspecial(especial: Especial, tags: string[]) {
    if (!selection) return;
    const c: Comida = {
      id: comidaId(selection.fecha, selection.tipo),
      fecha: selection.fecha,
      tipo: selection.tipo,
      platoId: null,
      especial,
      tags,
    };
    await setComida(c);
    upsertLocalComida(c);
    setSelection(null);
  }

  async function handleClear() {
    if (!selection) return;
    await clearComida(selection.fecha, selection.tipo);
    setComidas((prev) => prev.filter((c) => c.id !== comidaId(selection.fecha, selection.tipo)));
    setSelection(null);
  }

  if (loading) return null;

  return (
    <div>
      <WeekNav days={days} weekOffset={weekOffset} onChangeOffset={setWeekOffset} />

      {days.map((date) => {
        const fecha = toISODate(date);
        return (
          <DayCard
            key={fecha}
            date={date}
            getComida={(tipo) => getComida(fecha, tipo)}
            getPlatoNombre={getPlatoNombre}
            onTapSlot={(tipo) => setSelection({ fecha, tipo })}
          />
        );
      })}

      {selection && (
        <AsignarComidaSheet
          fecha={selection.fecha}
          tipo={selection.tipo}
          platos={platos}
          currentComida={getComida(selection.fecha, selection.tipo)}
          onClose={() => setSelection(null)}
          onAssignPlato={handleAssignPlato}
          onAssignEspecial={handleAssignEspecial}
          onCreatePlato={handleCreatePlato}
          onClear={handleClear}
        />
      )}

      {platosSheetOpen && (
        <PlatosSheet
          platos={platos}
          ingredientes={ingredientes}
          comidas={comidas}
          onClose={() => setPlatosSheetOpen(false)}
          onCreatePlato={handleCreatePlato}
          onUpdatePlato={handleUpdatePlato}
          onDeletePlato={handleDeletePlato}
          onCreateIngrediente={handleCreateIngrediente}
          onRenameIngrediente={handleRenameIngrediente}
        />
      )}
    </div>
  );
}
