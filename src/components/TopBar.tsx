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
  action: TopBarAction | TopBarAction[] | null;
  back?: TopBarBack | null;
}

export function TopBar({ title, action, back }: TopBarProps) {
  const actions = action ? (Array.isArray(action) ? action : [action]) : [];
  return (
    <header className={styles.topBar}>
      {back && (
        <button type="button" className={styles.backRow} onClick={back.onClick}>
          ‹ {back.label}
        </button>
      )}
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{title}</h1>
        {actions.length > 0 && (
          <div className={styles.actions}>
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                className={styles.gearButton}
                onClick={a.onClick}
                aria-label={a.label}
              >
                {a.icon}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
