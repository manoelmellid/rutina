import styles from './TopBar.module.css';
import { IconGear } from './icons';

interface TopBarProps {
  title: string;
  onOpenSettings: () => void;
}

export function TopBar({ title, onOpenSettings }: TopBarProps) {
  return (
    <header className={styles.topBar}>
      <h1 className={styles.title}>{title}</h1>
      <button
        type="button"
        className={styles.gearButton}
        onClick={onOpenSettings}
        aria-label="Ajustes"
      >
        <IconGear />
      </button>
    </header>
  );
}
