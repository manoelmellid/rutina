import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import styles from './ComidasScreen.module.css';
import { WeekNav } from '../features/comidas/WeekNav';
import { DayCard } from '../features/comidas/DayCard';
import { AsignarComidaPanel } from '../features/comidas/AsignarComidaPanel';
import { IconPlus } from '../components/icons';
import type { LayoutContext } from '../lib/layoutContext';
import { getWeekDays, isSameDate, toISODate } from '../lib/week';
import {
  comidaId,
  getAllComidas,
  getAllPlatos,
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
  const [readyToReveal, setReadyToReveal] = useState(false);
  const { setTopRightAction } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();
  const todayCardRef = useRef<HTMLDivElement | null>(null);
  const dayListRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledToTodayRef = useRef(false);
  const scrollPosRef = useRef(0);

  useEffect(() => {
    Promise.all([getAllPlatos(), getAllComidas()]).then(([p, c]) => {
      setPlatos(p);
      setComidas(c);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selection) {
      setTopRightAction(null);
      return;
    }
    setTopRightAction({ icon: <IconPlus />, label: 'Platos', onClick: () => navigate('/comidas/platos') });
    return () => setTopRightAction(null);
  }, [setTopRightAction, navigate, selection]);

  const days = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  // Coloca la vista en el día de hoy (solo en la semana actual). Ported de comidas-app:
  // doble rAF para medir tras el layout real, retry de respaldo, y la lista oculta
  // hasta el primer intento para que no se vea el salto desde el lunes.
  useEffect(() => {
    if (loading) return;

    if (weekOffset !== 0) {
      if (dayListRef.current) dayListRef.current.scrollTop = 0;
      setReadyToReveal(true);
      return;
    }

    function scrollToToday() {
      const container = dayListRef.current;
      const card = todayCardRef.current;
      if (container && card) {
        const delta = card.getBoundingClientRect().top - container.getBoundingClientRect().top;
        if (Math.abs(delta) >= 1) {
          container.scrollBy({ top: delta, behavior: hasScrolledToTodayRef.current ? 'smooth' : 'auto' });
        }
        hasScrolledToTodayRef.current = true;
      }
      setReadyToReveal(true);
    }

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(scrollToToday);
    });
    const retry = setTimeout(scrollToToday, 350);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(retry);
    };
  }, [weekOffset, loading]);

  // Al volver del panel de asignar, restaura el scroll de la lista de días (síncrono,
  // antes de pintar, para que no haya parpadeo).
  useLayoutEffect(() => {
    if (selection) return;
    if (dayListRef.current) dayListRef.current.scrollTop = scrollPosRef.current;
  }, [selection]);

  function getComida(fecha: string, tipo: TipoComida): Comida | undefined {
    return comidas.find((c) => c.id === comidaId(fecha, tipo));
  }

  function getPlatoNombre(platoId: string): string {
    return platos.find((p) => p.id === platoId)?.nombre ?? '(eliminado)';
  }

  function upsertLocalComida(c: Comida) {
    setComidas((prev) => [...prev.filter((x) => x.id !== c.id), c]);
  }

  function openSlot(fecha: string, tipo: TipoComida) {
    scrollPosRef.current = dayListRef.current?.scrollTop ?? 0;
    setSelection({ fecha, tipo });
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

  if (selection) {
    return (
      <AsignarComidaPanel
        fecha={selection.fecha}
        tipo={selection.tipo}
        platos={platos}
        currentComida={getComida(selection.fecha, selection.tipo)}
        onClose={() => setSelection(null)}
        onAssignPlato={handleAssignPlato}
        onAssignEspecial={handleAssignEspecial}
        onClear={handleClear}
      />
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <WeekNav days={days} weekOffset={weekOffset} onChangeOffset={setWeekOffset} />
      </div>

      <div
        className={`${styles.dayList} ${readyToReveal ? '' : styles.dayListHidden}`}
        ref={dayListRef}
      >
        {days.map((date) => {
          const fecha = toISODate(date);
          const isToday = isSameDate(date, new Date());
          return (
            <div key={fecha} ref={isToday ? todayCardRef : undefined}>
              <DayCard
                date={date}
                getComida={(tipo) => getComida(fecha, tipo)}
                getPlatoNombre={getPlatoNombre}
                onTapSlot={(tipo) => openSlot(fecha, tipo)}
                onOpenPlato={(platoId) => navigate('/comidas/platos', { state: { platoId } })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
