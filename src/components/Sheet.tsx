import { useEffect, type ReactNode } from 'react';
import styles from './Sheet.module.css';

interface SheetProps {
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ title, onClose, children }: SheetProps) {
  useEffect(() => {
    const content = document.querySelector<HTMLElement>('.app-content-scroll');
    const previous = content?.style.overflow;
    if (content) content.style.overflow = 'hidden';
    return () => {
      if (content) content.style.overflow = previous ?? '';
    };
  }, []);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.grabber} />
        {title && <h2 className={styles.heading}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
