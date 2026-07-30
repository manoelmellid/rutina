import type { ReactNode } from 'react';
import styles from './TopBar.module.css';

export interface TopBarAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

interface TopBarProps {
  title: string;
  action: TopBarAction | null;
}

export function TopBar({ title, action }: TopBarProps) {
  return (
    <header className={styles.topBar}>
      <h1 className={styles.title}>{title}</h1>
      {action && (
        <button type="button" className={styles.gearButton} onClick={action.onClick} aria-label={action.label}>
          {action.icon}
        </button>
      )}
    </header>
  );
}
