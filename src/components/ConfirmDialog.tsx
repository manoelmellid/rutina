import { useEffect } from 'react';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal de confirmación centrado. Sin inputs de texto a propósito (los sheets con
 * campos pelean con el teclado de iOS — ver CLAUDE.md). Solo botones.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} role="alertdialog">
        <p className={styles.title}>{title}</p>
        {message && <p className={styles.message}>{message}</p>}
        <div className={styles.buttons}>
          {cancelLabel && (
            <button type="button" className={styles.cancel} onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            className={`${styles.confirm} ${danger ? styles.confirmDanger : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
