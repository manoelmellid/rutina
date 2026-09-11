import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MesScreen.module.css';
import { getWeekDays, isSameDate, toISODate } from '../lib/week';
import { getAllPlatos, getComidasEnRango, type Comida, type Plato, type TipoComida } from '../lib/db';

// Semana anterior, actual, siguiente — centra "hoy" en vez de dejarlo siempre al principio.
const WEEK_OFFSETS = [-1, 0, 1];
const DIAS_LABEL = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const TIPOS: TipoComida[] = ['comida', 'cena'];

interface Resumen {
  texto: string;
  clase: string;
}

function resumenSlot(comida: Comida | undefined, platoById: Map<string, Plato>): Resumen {
  if (!comida) return { texto: '—', clase: styles.slotVacio };
  if (comida.especial) {
    const nombre = comida.especial === 'tupper' ? 'Tupper' : 'Fuera';
    return {
      texto: comida.tags.length ? `${nombre} · ${comida.tags.join(', ')}` : nombre,
      clase: styles.slotEspecial,
    };
  }
  if (comida.platoId) {
    const nombre = platoById.get(comida.platoId)?.nombre ?? '(eliminado)';
    return { texto: nombre, clase: nombre === '(eliminado)' ? styles.slotEliminado : styles.slotLleno };
  }
  return { texto: '—', clase: styles.slotVacio };
}

/**
 * Carcasa "rotada" de verdad: el manifest fuerza `orientation: portrait` (el dispositivo nunca
 * gira solo), así que esta pantalla finge el horizontal con CSS (`transform: rotate(90deg)`, ver
 * `.module.css`) en vez de esperar a una rotación real. Por eso vive FUERA de `<Layout>` en
 * App.tsx — pinta su propia cabecera (girada junto con el resto) en vez del TopBar/TabBar
 * normales, que no tendría sentido mostrar aquí.
 */
export function MesScreen() {
  const navigate = useNavigate();
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [comidas, setComidas] = useState<Comida[]>([]);
  const [loading, setLoading] = useState(true);
  const weeksScrollRef = useRef<HTMLDivElement | null>(null);

  const semanas = useMemo(
    () => WEEK_OFFSETS.map((offset) => ({ offset, dias: getWeekDays(offset) })),
    [],
  );

  useEffect(() => {
    const desde = toISODate(semanas[0].dias[0]);
    const hasta = toISODate(semanas[semanas.length - 1].dias[6]);
    Promise.all([getAllPlatos(), getComidasEnRango(desde, hasta)]).then(([p, c]) => {
      setPlatos(p);
      setComidas(c);
      setLoading(false);
    });
  }, [semanas]);

  // El scroll nativo por gesto táctil no atraviesa de forma fiable un ancestro con
  // `transform: rotate(...)` en iOS (WebKit) — se lleva a mano: el eje vertical propio de
  // `.weeksScroll` (donde se apilan las semanas) corresponde, tras la rotación de 90°, a un
  // arrastre HORIZONTAL físico (ver derivación en MesScreen.module.css), así que el delta de
  // `clientX` es lo que mueve `scrollTop`. `touch-action: none` en el CSS le dice al navegador
  // que no intente su propio gesto aquí, para que no compita con este.
  useEffect(() => {
    const el = weeksScrollRef.current;
    if (!el) return;

    let dragging = false;
    let startX = 0;
    let startTop = 0;

    function onTouchStart(e: TouchEvent) {
      dragging = true;
      startX = e.touches[0].clientX;
      startTop = el!.scrollTop;
    }
    function onTouchMove(e: TouchEvent) {
      if (!dragging) return;
      el!.scrollTop = startTop + (startX - e.touches[0].clientX);
      e.preventDefault();
    }
    function onTouchEnd() {
      dragging = false;
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
    // `.weeksScroll` solo existe en el DOM cuando `!loading` — sin `loading` en las deps, este
    // efecto se ejecuta una vez con `weeksScrollRef.current` todavía `null` (el montaje real pasa
    // después) y nunca vuelve a intentarlo: los listeners no se llegan a adjuntar nunca.
  }, [loading]);

  const platoById = useMemo(() => new Map(platos.map((p) => [p.id, p])), [platos]);
  const comidaByKey = useMemo(() => new Map(comidas.map((c) => [c.id, c])), [comidas]);

  function getComida(fecha: string, tipo: TipoComida): Comida | undefined {
    return comidaByKey.get(`${fecha}__${tipo}`);
  }

  return (
    <div className={styles.landscapeRoot}>
      <div className={styles.header}>
        <button type="button" className={styles.backButton} onClick={() => navigate('/comidas')}>
          ‹ Comidas
        </button>
        <h1 className={styles.title}>Mes</h1>
      </div>

      {!loading && (
        <div className={styles.grid}>
          <div className={styles.weekdayRow}>
            {DIAS_LABEL.map((d) => (
              <span key={d} className={styles.weekdayLabel}>
                {d}
              </span>
            ))}
          </div>
          <div className={styles.weeksScroll} ref={weeksScrollRef}>
            {semanas.map(({ offset, dias }) => (
              <div key={offset} className={styles.weekRow}>
                {dias.map((date) => {
                  const fecha = toISODate(date);
                  const today = isSameDate(date, new Date());
                  return (
                    <button
                      key={fecha}
                      type="button"
                      className={`${styles.cell} ${today ? styles.cellToday : ''}`}
                      onClick={() => navigate('/comidas', { state: { weekOffset: offset, fecha } })}
                    >
                      <span className={styles.dayNum}>{date.getDate()}</span>
                      {TIPOS.map((tipo) => {
                        const r = resumenSlot(getComida(fecha, tipo), platoById);
                        return (
                          <span key={tipo} className={`${styles.slot} ${r.clase}`}>
                            {r.texto}
                          </span>
                        );
                      })}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
