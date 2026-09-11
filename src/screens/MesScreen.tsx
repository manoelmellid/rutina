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
  // `transform: rotate(...)` en iOS (WebKit) — se lleva a mano. Los listeners van en `window`
  // (no en `.weeksScroll`) a propósito: un elemento DESCENDIENTE de un ancestro rotado puede
  // tener el hit-testing táctil de WebKit poco fiable (el toque real puede no llegar a
  // dispararle nada, aunque el código del handler sea correcto — así se explica que el intento
  // anterior, ya con los listeners bien enganchados, siguiera sin reaccionar en el iPhone).
  // `window` siempre recibe el toque pase lo que pase; aquí se comprueba a mano con
  // `getBoundingClientRect()` (que sí devuelve la posición real en pantalla, post-rotación) si
  // cayó dentro de `.weeksScroll` antes de arrastrar. El eje vertical propio de `.weeksScroll`
  // (donde se apilan las semanas) corresponde, tras la rotación de 90°, a un arrastre HORIZONTAL
  // físico (ver derivación más abajo), así que el delta de `clientX` es lo que mueve `scrollTop`.
  useEffect(() => {
    let dragging = false;
    let startX = 0;
    let startTop = 0;

    function onTouchStart(e: TouchEvent) {
      const el = weeksScrollRef.current;
      const t = e.touches[0];
      if (!el || !t) return;
      const rect = el.getBoundingClientRect();
      if (t.clientX < rect.left || t.clientX > rect.right || t.clientY < rect.top || t.clientY > rect.bottom) {
        return;
      }
      dragging = true;
      startX = t.clientX;
      startTop = el.scrollTop;
    }
    function onTouchMove(e: TouchEvent) {
      const el = weeksScrollRef.current;
      if (!dragging || !el) return;
      el.scrollTop = startTop + (startX - e.touches[0].clientX);
      e.preventDefault();
    }
    function onTouchEnd() {
      dragging = false;
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
    // `window` existe siempre — a diferencia del intento anterior (listener en `.weeksScroll`),
    // ya no depende de que ese elemento exista en el DOM al enganchar, pero se deja `loading` en
    // las deps igualmente: hasta que `!loading`, `weeksScrollRef.current` es `null` y
    // `onTouchStart` no tiene nada contra lo que comprobar el rect.
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
