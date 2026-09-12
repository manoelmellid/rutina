import type { ReactNode } from 'react';
import styles from './TopBar.module.css';

export interface TopBarAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'accent' | 'danger';
  showLabel?: boolean;
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
                className={[styles.gearButton, a.variant && styles[a.variant]].filter(Boolean).join(' ')}
                onClick={a.onClick}
                aria-label={a.label}
              >
                {a.icon}
                {/* Siempre se renderiza (incluso sin showLabel), oculta con visibility en vez de
                    no montarla, para que el icono quede a la misma altura en los 4 botones —
                    solo visibility:hidden reserva el hueco sin mostrar el texto. */}
                <span className={`${styles.gearLabel} ${a.showLabel ? '' : styles.gearLabelHidden}`}>
                  {a.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
