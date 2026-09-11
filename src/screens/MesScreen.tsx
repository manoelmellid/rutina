import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MesScreen.module.css';
import { getWeekDays, isSameDate, toISODate } from '../lib/week';
import { getAllPlatos, getComidasEnRango, type Comida, type Plato, type TipoComida } from '../lib/db';

const SEMANAS = 2; // "probar primero con dos" — la ventana real vendrá después
const DIAS_LABEL = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const TIPOS: TipoComida[] = ['comida', 'cena'];

interface Resumen {
  texto: string;
  clase?: string;
}

function resumenSlot(comida: Comida | undefined, platoById: Map<string, Plato>): Resumen {
  if (!comida) return { texto: '—' };
  if (comida.especial) {
    const nombre = comida.especial === 'tupper' ? 'Tupper' : 'Fuera';
    return {
      texto: comida.tags.length ? `${nombre} · ${comida.tags.join(', ')}` : nombre,
      clase: styles.slotEspecial,
    };
  }
  if (comida.platoId) {
    const nombre = platoById.get(comida.platoId)?.nombre ?? '(eliminado)';
    return { texto: nombre, clase: nombre === '(eliminado)' ? styles.slotEliminado : undefined };
  }
  return { texto: '—' };
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

  const semanas = useMemo(
    () => Array.from({ length: SEMANAS }, (_, i) => getWeekDays(i)),
    [],
  );

  useEffect(() => {
    const desde = toISODate(semanas[0][0]);
    const hasta = toISODate(semanas[semanas.length - 1][6]);
    Promise.all([getAllPlatos(), getComidasEnRango(desde, hasta)]).then(([p, c]) => {
      setPlatos(p);
      setComidas(c);
      setLoading(false);
    });
  }, [semanas]);

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
          {semanas.map((dias, weekOffset) => (
            <div key={weekOffset} className={styles.weekRow}>
              {dias.map((date) => {
                const fecha = toISODate(date);
                const today = isSameDate(date, new Date());
                return (
                  <button
                    key={fecha}
                    type="button"
                    className={`${styles.cell} ${today ? styles.cellToday : ''}`}
                    onClick={() => navigate('/comidas', { state: { weekOffset } })}
                  >
                    <span className={styles.dayNum}>{date.getDate()}</span>
                    {TIPOS.map((tipo) => {
                      const r = resumenSlot(getComida(fecha, tipo), platoById);
                      return (
                        <span key={tipo} className={`${styles.slot} ${r.clase ?? styles.slotVacio}`}>
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
      )}
    </div>
  );
}
