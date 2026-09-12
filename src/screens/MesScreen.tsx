import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MesScreen.module.css';
import { addDays, formatMonthLabel, getWeekDays, isSameDate, toISODate } from '../lib/week';
import { getAllPlatos, getComidasEnRango, type Comida, type Plato, type TipoComida } from '../lib/db';

// Rango inicial (~2 meses a cada lado); se AMPLÍA sobre la marcha al acercarse a un borde (ver
// onTouchEnd más abajo) — nunca se queda bloqueado, siempre se puede seguir avanzando semana a
// semana. Solo VISIBLE_WEEKS se ven a la vez (el alto de .weekRow en el CSS está calculado para
// que encajen exactamente 3, ver el calc() ahí — si cambias este número, cambia también el
// divisor en el CSS). El scroll tiene inercia real (arrastre libre + deceleración por fricción,
// ver el efecto táctil más abajo); solo al asentarse engancha a un múltiplo de VISIBLE_WEEKS
// semanas completas, nunca a medias.
const RANGO_INICIAL = 8; // semanas antes/después de la actual, al arrancar
const AMPLIACION = 8; // semanas que se añaden de golpe al acercarse a un borde
const VISIBLE_WEEKS = 3;
const DIAS_LABEL = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const TIPOS: TipoComida[] = ['comida', 'cena'];

interface Resumen {
  texto: string;
  clase: string;
}

function resumenSlot(comida: Comida | undefined, platoById: Map<string, Plato>): Resumen {
  if (!comida) return { texto: '', clase: styles.slotVacio };
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
  return { texto: '', clase: styles.slotVacio };
}

/**
 * Nombre del mes a mostrar junto al número de día, o `null` si no toca. Se muestra en tres casos:
 * el día 1 de cualquier mes, el último día de cualquier mes, y el lunes de la semana que esté
 * AHORA MISMO arriba del todo de las VISIBLE_WEEKS visibles (`esAncla`, calculado en el render a
 * partir de `topOffset` — no de `minOffset`: es dinámico, sigue al scroll, no al principio fijo
 * del array). Sin esto, un rango de semanas que cae entero dentro de un mismo mes (sin pasar por
 * ningún día 1 ni último día) se queda sin ninguna etiqueta visible — ver CLAUDE.md, ejemplo real
 * reportado por el usuario con el rango 7–27 de septiembre.
 */
function mesLabelPara(date: Date, esAncla: boolean): string | null {
  const esUltimoDiaDelMes = addDays(date, 1).getMonth() !== date.getMonth();
  if (date.getDate() === 1 || esUltimoDiaDelMes || esAncla) return formatMonthLabel(date);
  return null;
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
  const [minOffset, setMinOffset] = useState(-RANGO_INICIAL);
  const [maxOffset, setMaxOffset] = useState(RANGO_INICIAL);
  // Offset (no índice de array) de la semana que está actualmente arriba del todo de las
  // VISIBLE_WEEKS visibles — se usa para la celda "ancla" de mesLabelPara. Offset y no índice a
  // propósito: una ampliación por delante (minOffset) desplaza todos los índices del array pero
  // el offset de una semana ya existente no cambia nunca.
  const [topOffset, setTopOffset] = useState<number | null>(null);
  const weeksScrollRef = useRef<HTMLDivElement | null>(null);
  // Índice (en términos del array YA ampliado) al que hay que saltar en cuanto las filas nuevas
  // estén en el DOM — solo se usa cuando onTouchEnd amplía el rango; null = nada pendiente.
  const pendingSnapRef = useRef<number | null>(null);
  // minOffset leído dentro del efecto táctil (deps solo `[loading]`, ver más abajo) tiene que
  // venir de una ref, no de la variable de estado directamente, por la misma razón que
  // semanasLengthRef: el efecto no se recrea cuando minOffset cambia.
  const minOffsetRef = useRef(minOffset);
  useEffect(() => {
    minOffsetRef.current = minOffset;
  }, [minOffset]);

  const semanas = useMemo(() => {
    const arr = [];
    for (let offset = minOffset; offset <= maxOffset; offset++) {
      arr.push({ offset, dias: getWeekDays(offset) });
    }
    return arr;
  }, [minOffset, maxOffset]);

  // El efecto táctil de más abajo NO depende de `semanas` a propósito (ver su comentario) —
  // necesita el largo actual del array para saber cuándo ampliar, así que lo lee de una ref en
  // vez de la variable, para no tener que recrearse cada vez que el rango cambia.
  const semanasLengthRef = useRef(semanas.length);
  useEffect(() => {
    semanasLengthRef.current = semanas.length;
  }, [semanas]);

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
  // Deps solo `[loading]` a propósito: solo debe centrar "hoy" una vez, al cargar — no cada vez
  // que el usuario amplía el rango navegando (eso lo gestiona el efecto de más abajo). `minOffset`
  // se lee a propósito solo con su valor de montaje; añadirlo a las deps re-centraría "hoy" en
  // cada ampliación de rango.
  useEffect(() => {
    if (loading) return;
    // `retry` es un respaldo por si el primer intento (rAF) no pudo medir el layout todavía —
    // pero SIEMPRE se dispara a los 350ms pase lo que pase. Sin este flag, si el usuario empieza
    // a arrastrar dentro de esos 350ms, el retry reinicia `scrollTop` a mitad de gesto y pelea
    // con el arrastre del usuario (bug real, visto arrastrando justo al aterrizar en la vista).
    let centrado = false;
    function colocar() {
      if (centrado) return;
      const el = weeksScrollRef.current;
      if (!el) return;
      const paso = medirPaso(el);
      if (paso > 0) {
        el.scrollTop = (-minOffset - 1) * paso;
        setTopOffset(-1); // la semana justo antes de "hoy" queda arriba del todo al centrar
        centrado = true;
      }
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
  }, [loading]);

  // Aplica el salto pendiente en cuanto el rango ampliado (minOffset/maxOffset) ya está en el DOM
  // — useLayoutEffect (no useEffect) para que sea antes de pintar, sin parpadeo. Ampliar por
  // delante (minOffset) inserta filas ANTES de las que ya había, así que el índice objetivo tuvo
  // que calcularse ya teniendo en cuenta ese desplazamiento (ver onTouchEnd); ampliar por detrás
  // (maxOffset) solo añade al final, no desplaza nada.
  useLayoutEffect(() => {
    const pending = pendingSnapRef.current;
    if (pending === null) return;
    pendingSnapRef.current = null;
    const el = weeksScrollRef.current;
    if (!el) return;
    const paso = medirPaso(el);
    if (paso > 0) el.scrollTop = pending * paso;
  }, [minOffset, maxOffset]);

  // El scroll nativo por gesto táctil no atraviesa de forma fiable un ancestro con
  // `transform: rotate(...)` en iOS (WebKit) — se lleva a mano. Los listeners van en `window`
  // (no en `.weeksScroll`) porque un elemento DESCENDIENTE de un ancestro rotado puede tener el
  // hit-testing táctil de WebKit poco fiable; `window` siempre recibe el toque, y aquí se
  // comprueba a mano con `getBoundingClientRect()` si cayó dentro de `.weeksScroll` antes de
  // arrastrar.
  //
  // Scroll con INERCIA, no "una semana por gesto": durante el arrastre sigue al dedo 1:1 (libre
  // de verdad, puede recorrer varias semanas en un solo gesto). Al soltar, sigue moviéndose con
  // la velocidad que llevaba el dedo en ese instante, decelerando por fricción — igual que
  // cualquier lista nativa. Solo cuando esa velocidad baja de un umbral (o se sale del rango
  // cargado) se "engancha" a la semana completa más cercana. Si el objetivo cae fuera del rango
  // cargado, se AMPLÍA en esa dirección en vez de bloquear (nunca hay un "final" real).
  useEffect(() => {
    let dragging = false;
    let startX = 0;
    let startTop = 0;
    let deseado = 0; // posición sin clampar durante el arrastre — ver onTouchMove
    let ultimaX = 0;
    let ultimoT = 0;
    let velocidad = 0; // px de scrollTop por ms
    let animacionId = 0;

    function detenerMomentum() {
      if (animacionId) cancelAnimationFrame(animacionId);
      animacionId = 0;
    }

    const DURACION_ENGANCHE = 220; // ms — asentamiento suave (easeOutCubic), no un salto brusco

    /**
     * Anima `scrollTop` desde su posición actual hasta `destino` con una curva de deceleración
     * (easeOutCubic), en vez de saltar de golpe. Es el "tirón" que se siente al soltar a mitad de
     * una semana con poca velocidad — antes era una asignación instantánea (`el.scrollTop =
     * destino`), que se sentía como un salto seco comparado con el scroll con inercia de macOS
     * Calendar que el usuario pidió imitar. `behavior: 'smooth'` sigue sin usarse (comprobado que
     * no funciona en el entorno de desarrollo, ver CLAUDE.md) — esta es una animación manual con
     * `requestAnimationFrame`, igual que la de inercia de `lanzarMomentum` más abajo.
     */
    function animarEnganche(el: HTMLDivElement, destino: number) {
      detenerMomentum();
      const origen = el.scrollTop;
      const distancia = destino - origen;
      if (Math.abs(distancia) < 1) {
        el.scrollTop = destino;
        return;
      }
      const inicio = performance.now();
      function frame(ahora: number) {
        const t = Math.min(1, (ahora - inicio) / DURACION_ENGANCHE);
        const suavizado = 1 - (1 - t) ** 3;
        el.scrollTop = origen + distancia * suavizado;
        if (t < 1) {
          animacionId = requestAnimationFrame(frame);
        } else {
          animacionId = 0;
        }
      }
      animacionId = requestAnimationFrame(frame);
    }

    /**
     * Ajusta scrollTop al múltiplo de semana completa más cercano (con una animación suave, ver
     * `animarEnganche`); amplía el rango si hace falta. `deseado` es la posición SIN clampar (ver
     * por qué en el comentario de más abajo, en onTouchMove) — nunca se lee `el.scrollTop` para
     * decidir el índice objetivo, porque el navegador ya lo habría clampado en el borde,
     * ocultando que el usuario quería ir más allá.
     */
    function engancharSemana(el: HTMLDivElement, deseado: number) {
      const paso = medirPaso(el);
      if (paso <= 0) return;
      const indiceObjetivo = Math.round(deseado / paso);
      // offset (no índice) de la semana que va a quedar arriba del todo — válido en los 3 casos
      // de abajo por igual, porque ampliar el rango nunca cambia el offset de una semana ya
      // existente, solo su índice dentro del array (ver el comentario de topOffset más arriba).
      setTopOffset(minOffsetRef.current + indiceObjetivo);

      if (indiceObjetivo < 0) {
        // Ampliar por delante inserta AMPLIACION filas nuevas antes del índice 0 actual — el
        // índice objetivo, en términos del array ya ampliado, se desplaza esa misma cantidad.
        // Instantáneo a propósito (vía pendingSnapRef + useLayoutEffect, no animarEnganche): cruzar
        // a territorio recién cargado es un caso distinto al enganche normal dentro del rango ya
        // visible, y la asignación antes de pintar evita cualquier parpadeo con las filas nuevas.
        pendingSnapRef.current = indiceObjetivo + AMPLIACION;
        setMinOffset((m) => m - AMPLIACION);
        return;
      }
      const indiceMaximoActual = semanasLengthRef.current - VISIBLE_WEEKS;
      if (indiceObjetivo > indiceMaximoActual) {
        // Ampliar por detrás solo añade al final: el índice objetivo no se desplaza.
        pendingSnapRef.current = indiceObjetivo;
        setMaxOffset((m) => m + AMPLIACION);
        return;
      }
      animarEnganche(el, indiceObjetivo * paso);
    }

    const FRICCION = 0.95; // factor de deceleración por frame (~16ms)
    const UMBRAL_PARAR = 0.02; // px/ms por debajo del cual se considera "parado" y se engancha

    function lanzarMomentum(el: HTMLDivElement, velocidadInicial: number, posInicial: number) {
      if (Math.abs(velocidadInicial) <= UMBRAL_PARAR) {
        engancharSemana(el, posInicial);
        return;
      }
      let v = velocidadInicial;
      // `pos` es la posición física SIN clampar — sigue creciendo/decreciendo más allá de los
      // bordes del DOM aunque `el.scrollTop` (visual) se quede pegado en ellos, para que al parar
      // `engancharSemana` sepa que el usuario quería ir más allá y amplíe el rango en vez de
      // quedarse exactamente en la última semana cargada.
      let pos = posInicial;
      function frame() {
        pos += v * 16;
        v *= FRICCION;
        const max = el.scrollHeight - el.clientHeight;
        el.scrollTop = Math.max(0, Math.min(pos, max));
        const alcanzoBorde = pos <= 0 || pos >= max;
        if (Math.abs(v) > UMBRAL_PARAR && !alcanzoBorde) {
          animacionId = requestAnimationFrame(frame);
        } else {
          animacionId = 0;
          engancharSemana(el, pos);
        }
      }
      animacionId = requestAnimationFrame(frame);
    }

    function onTouchStart(e: TouchEvent) {
      const el = weeksScrollRef.current;
      const t = e.touches[0];
      if (!el || !t) return;
      const rect = el.getBoundingClientRect();
      if (t.clientX < rect.left || t.clientX > rect.right || t.clientY < rect.top || t.clientY > rect.bottom) {
        return;
      }
      detenerMomentum(); // "atrapar" un scroll que todavía estuviera decelerando
      dragging = true;
      startX = t.clientX;
      startTop = el.scrollTop;
      deseado = startTop;
      ultimaX = t.clientX;
      ultimoT = e.timeStamp;
      velocidad = 0;
    }
    function onTouchMove(e: TouchEvent) {
      const el = weeksScrollRef.current;
      if (!dragging || !el) return;
      const t = e.touches[0];
      // El navegador clampa `el.scrollTop` en cuanto se le asigna un valor fuera de
      // [0, scrollHeight-clientHeight] — si el usuario ya está en el borde y sigue arrastrando,
      // `el.scrollTop` deja de moverse y "miente" (bug real, ya visto una vez). `deseado` lleva
      // la cuenta del valor real que pide el arrastre, sin clampar.
      deseado = startTop - (startX - t.clientX);
      el.scrollTop = deseado;
      const dt = e.timeStamp - ultimoT;
      // Velocidad instantánea (últimos dos puntos) — es lo que se siente al soltar, no la media
      // de todo el gesto.
      if (dt > 0) velocidad = (t.clientX - ultimaX) / dt;
      ultimaX = t.clientX;
      ultimoT = e.timeStamp;
      e.preventDefault();
    }
    function onTouchEnd() {
      const el = weeksScrollRef.current;
      const arrastraba = dragging;
      dragging = false;
      if (!arrastraba || !el) return;
      lanzarMomentum(el, velocidad, deseado);
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
      detenerMomentum();
    };
    // `.weeksScroll` solo existe en el DOM cuando `!loading` — sin `loading` en las deps, este
    // efecto se ejecuta una vez con `weeksScrollRef.current` todavía `null` y nunca vuelve a
    // intentarlo (bug real ya visto una vez, ver CLAUDE.md). `semanas` NO va en las deps a
    // propósito (usa `semanasLengthRef` en su lugar): si el efecto se recreara en cada ampliación
    // de rango, habría una ventana entre el cleanup y el nuevo `addEventListener` en la que un
    // gesto en curso podría perderse — comprobado, causaba arrastres fantasma que no avanzaban.
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
                {dias.map((date, dayIndex) => {
                  const fecha = toISODate(date);
                  const today = isSameDate(date, new Date());
                  const esAncla = offset === topOffset && dayIndex === 0;
                  const mesLabel = mesLabelPara(date, esAncla);
                  return (
                    <button
                      key={fecha}
                      type="button"
                      className={`${styles.cell} ${today ? styles.cellToday : ''}`}
                      onClick={() => navigate('/comidas', { state: { weekOffset: offset, fecha } })}
                    >
                      <span className={styles.dayHeader}>
                        <span className={styles.dayNum}>{date.getDate()}</span>
                        {mesLabel && <span className={styles.monthLabel}>{mesLabel}</span>}
                      </span>
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
