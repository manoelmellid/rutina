import styles from './Stepper.module.css';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
}: StepperProps) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));

  return (
    <div className={styles.stepper}>
      <button
        type="button"
        className={styles.button}
        onClick={dec}
        disabled={value <= min}
        aria-label="Restar"
      >
        −
      </button>
      <span className={styles.value}>{value}</span>
      <button
        type="button"
        className={styles.button}
        onClick={inc}
        disabled={value >= max}
        aria-label="Sumar"
      >
        +
      </button>
    </div>
  );
}
