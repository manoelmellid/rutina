import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MesScreen.module.css';
import { getWeekDays, isSameDate, toISODate } from '../lib/week';
import { getAllPlatos, getComidasEnRango, type Comida, type Plato, type TipoComida } from '../lib/db';

// Rango amplio (~2 meses a cada lado) para poder navegar de verdad — "obviamente no pueden ser
// solo 5 semanas". Solo VISIBLE_WEEKS se ven a la vez (el alto de .weekRow en el CSS está
// calculado para que encajen exactamente 3, ver el calc() ahí — si cambias este número, cambia
// también el divisor en el CSS). El scroll es "por páginas": arrastre libre, pero al soltar
// siempre encaja en un múltiplo de VISIBLE_WEEKS semanas completas, nunca a medias.
const WEEK_RANGE = 8; // semanas antes/después de la actual
const VISIBLE_WEEKS = 3;
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
 * Mide la distancia real en pantalla entre el inicio de dos semanas consecutivas. OJO: las
 * semanas se apilan en el eje LOCAL vertical de `.weeksScroll` (flex-direction: column), que tras
 * la rotación de 90° corresponde al eje HORIZONTAL de pantalla (izquierda/derecha), no al
 * vertical — por eso se compara `.left`, no `.top` (ver la derivación completa en
 * MesScreen.module.css, la misma razón por la que el arrastre usa `clientX`).
 */
function medirPaso(container: HTMLDivElement): number {
  const filas = container.children;
  if (filas.length < 2) return 0;
  const r0 = filas[0].getBoundingClientRect();
  const r1 = filas[1].getBoundingClientRect();
  return Math.abs(r1.left - r0.left);
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
    () =>
      Array.from({ length: WEEK_RANGE * 2 + 1 }, (_, i) => i - WEEK_RANGE).map((offset) => ({
        offset,
        dias: getWeekDays(offset),
      })),
    [],
  );
  const indiceHoy = WEEK_RANGE; // offset 0 siempre cae en este índice del array

  useEffect(() => {
    const desde = toISODate(semanas[0].dias[0]);
    const hasta = toISODate(semanas[semanas.length - 1].dias[6]);
    Promise.all([getAllPlatos(), getComidasEnRango(desde, hasta)]).then(([p, c]) => {
      setPlatos(p);
      setComidas(c);
      setLoading(false);
    });
  }, [semanas]);

  // Coloca "hoy" como la semana central de las VISIBLE_WEEKS visibles al aterrizar (sin animar —
  // es la posición de partida, no una transición). Mismo patrón de doble rAF + retry que el
  // scroll-a-hoy de ComidasScreen, por si el layout aún no está medible en el primer intento.
  useEffect(() => {
    if (loading) return;
    function colocar() {
      const el = weeksScrollRef.current;
      if (!el) return;
      const paso = medirPaso(el);
      if (paso > 0) el.scrollTop = (indiceHoy - 1) * paso;
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(colocar);
    });
    const retry = setTimeout(colocar, 350);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(retry);
    };
  }, [loading, indiceHoy]);

  // El scroll nativo por gesto táctil no atraviesa de forma fiable un ancestro con
  // `transform: rotate(...)` en iOS (WebKit) — se lleva a mano. Los listeners van en `window`
  // (no en `.weeksScroll`) porque un elemento DESCENDIENTE de un ancestro rotado puede tener el
  // hit-testing táctil de WebKit poco fiable; `window` siempre recibe el toque, y aquí se
  // comprueba a mano con `getBoundingClientRect()` si cayó dentro de `.weeksScroll` antes de
  // arrastrar. Durante el arrastre el scroll es libre (sigue al dedo 1:1); al soltar, encaja en
  // el múltiplo de semana completa más cercano en la dirección del arrastre neto (o vuelve a la
  // posición de partida si el arrastre fue muy corto) — nunca deja una semana a medias.
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
      el.scrollTop = startTop - (startX - e.touches[0].clientX);
      e.preventDefault();
    }
    function onTouchEnd() {
      const el = weeksScrollRef.current;
      const arrastraba = dragging;
      dragging = false;
      if (!arrastraba || !el) return;

      const paso = medirPaso(el);
      if (paso <= 0) return;
      const indiceInicial = Math.round(startTop / paso);
      const indiceActual = el.scrollTop / paso;
      const umbral = 0.2; // fracción de una semana que hay que arrastrar para cambiar de página
      let indiceObjetivo = indiceInicial;
      if (indiceActual > indiceInicial + umbral) indiceObjetivo = indiceInicial + 1;
      else if (indiceActual < indiceInicial - umbral) indiceObjetivo = indiceInicial - 1;

      const indiceMaximo = semanas.length - VISIBLE_WEEKS;
      indiceObjetivo = Math.max(0, Math.min(indiceObjetivo, indiceMaximo));
      el.scrollTo({ top: indiceObjetivo * paso, behavior: 'smooth' });
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
    // `.weeksScroll` solo existe en el DOM cuando `!loading` — sin `loading` en las deps, este
    // efecto se ejecuta una vez con `weeksScrollRef.current` todavía `null` y nunca vuelve a
    // intentarlo (bug real ya visto una vez, ver CLAUDE.md).
  }, [loading, semanas]);

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
