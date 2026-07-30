import styles from './WeekNav.module.css';
import { formatWeekRangeLabel } from '../../lib/week';

interface WeekNavProps {
  days: Date[];
  weekOffset: number;
  onChangeOffset: (offset: number) => void;
}

export function WeekNav({ days, weekOffset, onChangeOffset }: WeekNavProps) {
  return (
    <div className={styles.nav}>
      <button type="button" className={styles.arrowButton} onClick={() => onChangeOffset(weekOffset - 1)}>
        ‹
      </button>
      <div className={styles.center}>
        <span className={styles.range}>{formatWeekRangeLabel(days)}</span>
        {weekOffset !== 0 && (
          <button type="button" className={styles.todayButton} onClick={() => onChangeOffset(0)}>
            Hoy
          </button>
        )}
      </div>
      <button type="button" className={styles.arrowButton} onClick={() => onChangeOffset(weekOffset + 1)}>
        ›
      </button>
    </div>
  );
}
