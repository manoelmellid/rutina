import styles from './Placeholder.module.css';

interface PlaceholderProps {
  title: string;
  subtitle: string;
}

export function Placeholder({ title, subtitle }: PlaceholderProps) {
  return (
    <div className={styles.card}>
      <p className={styles.title}>{title}</p>
      <p className={styles.subtitle}>{subtitle}</p>
    </div>
  );
}
