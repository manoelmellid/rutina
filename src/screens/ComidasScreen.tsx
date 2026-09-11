import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import styles from './ComidasScreen.module.css';
import { WeekNav } from '../features/comidas/WeekNav';
import { DayCard } from '../features/comidas/DayCard';
import { AsignarComidaPanel } from '../features/comidas/AsignarComidaPanel';
import { PropuestaGeneradorPanel } from '../features/comidas/PropuestaGeneradorPanel';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconCarta, IconMes, IconRestricciones, IconSparkles } from '../components/icons';
import type { LayoutContext } from '../lib/layoutContext';
import { getWeekDays, toISODate } from '../lib/week';
import {
  describirAlcance,
  planificar,
  rehacerSlot,
  slotsObjetivo,
  type GeneradorInput,
  type ResultadoGeneracion,
} from '../lib/generador';
import { sincronizarConsumoComida } from '../lib/consumo';
import { ingredientesUrgentes } from '../lib/despensa';
import {
  comidaId,
  getAllComidas,
  getAllIngredientes,
  getAllPlatos,
  getDespensa,
  getPreferencias,
  setComida,
  clearComida,
  type Comida,
  type DespensaEntry,
  type Especial,
  type Ingrediente,
  type Plato,
  type Preferencias,
  type TipoComida,
} from '../lib/db';

interface SlotSelection {
  fecha: string;
  tipo: TipoComida;
}

export function ComidasScreen() {
  const location = useLocation();
  // Se puede llegar aquí con una semana concreta ya elegida (ej. tocar un día desde la vista de
  // Mes). Solo se lee al montar; después manda el estado local, igual que el patrón de
  // `selectedId` en PlatosScreen.
  const [weekOffset, setWeekOffset] = useState(
    (location.state as { weekOffset?: number } | null)?.weekOffset ?? 0,
  );
  // Día al que hay que hacer scroll al aterrizar: el que se tocó en Mes, o "hoy" por defecto
  // (mismo patrón de "solo se lee al montar" que weekOffset arriba).
  const [targetFecha] = useState(
    (location.state as { fecha?: string } | null)?.fecha ?? toISODate(new Date()),
  );
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [comidas, setComidas] = useState<Comida[]>([]);
  const [prefs, setPrefs] = useState<Preferencias | null>(null);
  const [despensa, setDespensa] = useState<DespensaEntry[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<SlotSelection | null>(null);
  const [generateStep, setGenerateStep] = useState<'idle' | 'past' | 'vacio' | 'confirm'>('idle');
  const [propuesta, setPropuesta] = useState<ResultadoGeneracion | null>(null);
  const [generadorInput, setGeneradorInput] = useState<GeneradorInput | null>(null);
  const [readyToReveal, setReadyToReveal] = useState(false);
  const { setTopRightAction } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();
  const targetCardRef = useRef<HTMLDivElement | null>(null);
  const dayListRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledRef = useRef(false);
  const scrollPosRef = useRef(0);

  useEffect(() => {
    Promise.all([
      getAllPlatos(),
      getAllComidas(),
      getPreferencias(),
      getDespensa(),
      getAllIngredientes(),
    ]).then(([p, c, pr, d, i]) => {
      setPlatos(p);
      setComidas(c);
      setPrefs(pr);
      setDespensa(d);
      setIngredientes(i);
      setLoading(false);
    });
  }, []);

  const days = useMemo(() => getWeekDays(weekOffset), [weekOffset]);
  const platoById = useMemo(() => new Map(platos.map((p) => [p.id, p])), [platos]);
  const ingredienteById = useMemo(() => new Map(ingredientes.map((i) => [i.id, i])), [ingredientes]);

  useEffect(() => {
    if (selection || propuesta) {
      setTopRightAction(null);
      return;
    }
    setTopRightAction([
      {
        icon: <IconSparkles />,
        label: 'Generar comidas',
        variant: 'accent',
        onClick: () => {
          if (weekOffset < 0) {
            setGenerateStep('past');
            return;
          }
          if (!prefs) return;
          const slots = slotsObjetivo(prefs, days, new Date());
          setGenerateStep(slots.length === 0 ? 'vacio' : 'confirm');
        },
      },
      {
        icon: <IconRestricciones />,
        label: 'Restricciones',
        variant: 'danger',
        onClick: () => navigate('/comidas/restricciones'),
      },
      { icon: <IconMes />, label: 'Mes', showLabel: true, onClick: () => navigate('/comidas/mes') },
      {
        icon: <IconCarta />,
        label: 'Platos',
        showLabel: true,
        onClick: () => navigate('/comidas/platos'),
      },
    ]);
    return () => setTopRightAction(null);
  }, [setTopRightAction, navigate, selection, propuesta, weekOffset, prefs, days]);

  // Coloca la vista en `targetFecha` (hoy por defecto, o el día que se tocó desde Mes) cuando esa
  // fecha cae en la semana visible; si no (p. ej. navegando con ‹/› a otra semana), vuelve al
  // principio. Ported de comidas-app: doble rAF para medir tras el layout real, retry de
  // respaldo, y la lista oculta hasta el primer intento para que no se vea el salto desde el lunes.
  useEffect(() => {
    if (loading) return;

    function scrollToTarget() {
      const container = dayListRef.current;
      const card = targetCardRef.current;
      if (container && card) {
        const delta = card.getBoundingClientRect().top - container.getBoundingClientRect().top;
        if (Math.abs(delta) >= 1) {
          container.scrollBy({ top: delta, behavior: hasScrolledRef.current ? 'smooth' : 'auto' });
        }
        hasScrolledRef.current = true;
      } else if (container) {
        container.scrollTop = 0;
      }
      setReadyToReveal(true);
    }

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(scrollToTarget);
    });
    const retry = setTimeout(scrollToTarget, 350);
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
    const existing = getComida(selection.fecha, selection.tipo);
    const c: Comida = {
      id: comidaId(selection.fecha, selection.tipo),
      fecha: selection.fecha,
      tipo: selection.tipo,
      platoId,
      especial: null,
      tags: [],
      consumoAplicado: existing?.consumoAplicado ?? null,
    };
    await setComida(c);
    // Fase 5: si el día ya toca (hoy o pasado), ajusta la despensa — revierte lo del plato
    // anterior si lo había y aplica lo del nuevo.
    const actualizada = await sincronizarConsumoComida(c, platoById, new Date());
    upsertLocalComida(actualizada ?? c);
    setSelection(null);
  }

  async function handleAssignEspecial(especial: Especial, tags: string[]) {
    if (!selection) return;
    const existing = getComida(selection.fecha, selection.tipo);
    const c: Comida = {
      id: comidaId(selection.fecha, selection.tipo),
      fecha: selection.fecha,
      tipo: selection.tipo,
      platoId: null,
      especial,
      tags,
      consumoAplicado: existing?.consumoAplicado ?? null,
    };
    await setComida(c);
    const actualizada = await sincronizarConsumoComida(c, platoById, new Date());
    upsertLocalComida(actualizada ?? c);
    setSelection(null);
  }

  async function handleClear() {
    if (!selection) return;
    const existing = getComida(selection.fecha, selection.tipo);
    if (existing) {
      // Si ya se había descontado, devolver esa cantidad a la despensa antes de borrar la fila.
      await sincronizarConsumoComida(
        { ...existing, platoId: null, especial: null, tags: [] },
        platoById,
        new Date(),
      );
    }
    await clearComida(selection.fecha, selection.tipo);
    setComidas((prev) => prev.filter((c) => c.id !== comidaId(selection.fecha, selection.tipo)));
    setSelection(null);
  }

  function handleGenerar() {
    if (!prefs) return;
    const slots = slotsObjetivo(prefs, days, new Date());
    const fechas = [...new Set(slots.map((s) => s.fecha))].sort();
    if (fechas.length === 0) return;
    const rango = { desde: fechas[0], hasta: fechas[fechas.length - 1] };
    // Un ingrediente en déficit (cantidad negativa, ver consumirDeDespensa en db.ts) no cuenta
    // como "hay algo en la despensa" — no hay comida física, es una deuda.
    const despensaIngredienteIds = new Set(
      despensa.filter((e) => e.cantidad > 0).map((e) => e.ingredienteId),
    );
    const perecederosUrgentesIds = ingredientesUrgentes(despensa, ingredienteById, new Date());
    const input: GeneradorInput = {
      slots,
      platos,
      comidas,
      despensaIngredienteIds,
      perecederosUrgentesIds,
      semanasAntiRepeticion: prefs.semanasAntiRepeticion,
      rango,
    };
    setGenerateStep('idle');
    setGeneradorInput(input);
    setPropuesta(planificar(input));
  }

  function handleRerollSlot(index: number) {
    if (!propuesta || !generadorInput) return;
    const nuevoSlot = rehacerSlot(generadorInput, propuesta.propuestas, index);
    const propuestas = propuesta.propuestas.map((p, i) => (i === index ? nuevoSlot : p));
    setPropuesta({ propuestas, sinCandidato: propuestas.filter((p) => p.platoId === null).length });
  }

  async function handleAceptarPropuesta() {
    if (!propuesta) return;
    const asignadas = propuesta.propuestas.filter(
      (p): p is typeof p & { platoId: string } => p.platoId !== null,
    );
    await Promise.all(
      asignadas.map((p) =>
        setComida({
          id: comidaId(p.fecha, p.tipo),
          fecha: p.fecha,
          tipo: p.tipo,
          platoId: p.platoId,
          especial: null,
          tags: [],
          consumoAplicado: null,
        }),
      ),
    );
    for (const p of asignadas) {
      upsertLocalComida({
        id: comidaId(p.fecha, p.tipo),
        fecha: p.fecha,
        tipo: p.tipo,
        platoId: p.platoId,
        especial: null,
        tags: [],
        consumoAplicado: null,
      });
    }
    setPropuesta(null);
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

  if (propuesta) {
    return (
      <PropuestaGeneradorPanel
        propuesta={propuesta}
        getPlatoNombre={getPlatoNombre}
        onReroll={handleGenerar}
        onRerollSlot={handleRerollSlot}
        onAccept={handleAceptarPropuesta}
        onCancel={() => setPropuesta(null)}
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
          return (
            <div key={fecha} ref={fecha === targetFecha ? targetCardRef : undefined}>
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

      {generateStep === 'past' && (
        <ConfirmDialog
          title="Semana pasada"
          message="No se pueden generar comidas de una semana que ya pasó."
          confirmLabel="Entendido"
          onConfirm={() => setGenerateStep('idle')}
          onCancel={() => setGenerateStep('idle')}
        />
      )}
      {generateStep === 'vacio' && (
        <ConfirmDialog
          title="Nada que generar"
          message="No quedan días en el rango configurado (Ajustes → Generador) a partir de hoy."
          confirmLabel="Entendido"
          onConfirm={() => setGenerateStep('idle')}
          onCancel={() => setGenerateStep('idle')}
        />
      )}
      {generateStep === 'confirm' && prefs && (
        <ConfirmDialog
          title={`¿Generar comida y cena ${describirAlcance(prefs, slotsObjetivo(prefs, days, new Date()))}?`}
          message="Rellena solo los huecos vacíos, y no toca lo que ya pusiste a mano."
          confirmLabel="Generar"
          cancelLabel="Cancelar"
          onConfirm={handleGenerar}
          onCancel={() => setGenerateStep('idle')}
        />
      )}
    </div>
  );
}
