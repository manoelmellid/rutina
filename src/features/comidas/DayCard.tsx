import styles from './DayCard.module.css';
import { formatDayLabel, isSameDate } from '../../lib/week';
import type { Comida, TipoComida } from '../../lib/db';

const TIPOS: { tipo: TipoComida; label: string }[] = [
  { tipo: 'comida', label: 'Comida' },
  { tipo: 'cena', label: 'Cena' },
];

interface DayCardProps {
  date: Date;
  getComida: (tipo: TipoComida) => Comida | undefined;
  getPlatoNombre: (platoId: string) => string;
  onTapSlot: (tipo: TipoComida) => void;
  onOpenPlato: (platoId: string) => void;
}

export function DayCard({ date, getComida, getPlatoNombre, onTapSlot, onOpenPlato }: DayCardProps) {
  const today = isSameDate(date, new Date());

  return (
    <div className={styles.card}>
      <p className={`${styles.dayLabel} ${today ? styles.dayLabelToday : ''}`}>
        {formatDayLabel(date)}
      </p>
      {TIPOS.map(({ tipo, label }) => {
        const comida = getComida(tipo);
        let valor: string;
        let valorClass = styles.valorVacio;

        if (!comida) {
          valor = 'Añadir';
        } else if (comida.especial) {
          const nombreEspecial = comida.especial === 'tupper' ? 'Tupper' : 'Fuera';
          valor = comida.tags.length ? `${nombreEspecial} · ${comida.tags.join(', ')}` : nombreEspecial;
          valorClass = styles.valorEspecial;
        } else if (comida.platoId) {
          valor = getPlatoNombre(comida.platoId);
          valorClass = valor === '(eliminado)' ? styles.valorEliminado : '';
        } else {
          valor = 'Añadir';
        }

        const platoId =
          comida && !comida.especial && comida.platoId && valor !== '(eliminado)'
            ? comida.platoId
            : null;

        return (
          <div key={tipo} className={styles.row}>
            <button type="button" className={styles.rowMain} onClick={() => onTapSlot(tipo)}>
              <span className={styles.tipo}>{label}</span>
              <span className={`${styles.valor} ${valorClass}`}>{valor}</span>
            </button>
            {platoId && (
              <button
                type="button"
                className={styles.ficha}
                onClick={() => onOpenPlato(platoId)}
                aria-label={`Ver ficha de ${valor}`}
              >
                ›
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
