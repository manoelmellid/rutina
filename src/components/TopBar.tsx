import type { ReactNode } from 'react';
import styles from './TopBar.module.css';

export interface TopBarAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

export interface TopBarBack {
  label: string;
  onClick: () => void;
}

interface TopBarProps {
  title: string;
  action: TopBarAction | null;
  back?: TopBarBack | null;
}

export function TopBar({ title, action, back }: TopBarProps) {
  return (
    <header className={styles.topBar}>
      {back && (
        <button type="button" className={styles.backRow} onClick={back.onClick}>
          ‹ {back.label}
        </button>
      )}
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{title}</h1>
        {action && (
          <button type="button" className={styles.gearButton} onClick={action.onClick} aria-label={action.label}>
            {action.icon}
          </button>
        )}
      </div>
    </header>
  );
}
