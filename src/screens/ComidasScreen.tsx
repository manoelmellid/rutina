import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { WeekNav } from '../features/comidas/WeekNav';
import { DayCard } from '../features/comidas/DayCard';
import { AsignarComidaSheet } from '../features/comidas/AsignarComidaSheet';
import { IconPlus } from '../components/icons';
import type { LayoutContext } from '../lib/layoutContext';
import { getWeekDays, toISODate } from '../lib/week';
import {
  comidaId,
  getAllComidas,
  getAllPlatos,
  newId,
  savePlato,
  setComida,
  clearComida,
  type Comida,
  type Especial,
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
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<SlotSelection | null>(null);
  const { setTopRightAction } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getAllPlatos(), getAllComidas()]).then(([p, c]) => {
      setPlatos(p);
      setComidas(c);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setTopRightAction({ icon: <IconPlus />, label: 'Platos', onClick: () => navigate('/comidas/platos') });
    return () => setTopRightAction(null);
  }, [setTopRightAction, navigate]);

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
    </div>
  );
}
