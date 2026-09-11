import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import sharedStyles from './AsignarComidaPanel.module.css';
import styles from './PropuestaGeneradorPanel.module.css';
import { formatFullDayLabel, parseISODate } from '../../lib/week';
import type { LayoutContext } from '../../lib/layoutContext';
import type { ResultadoGeneracion } from '../../lib/generador';

interface PropuestaGeneradorPanelProps {
  propuesta: ResultadoGeneracion;
  getPlatoNombre: (platoId: string) => string;
  onReroll: () => void;
  onAccept: () => void;
  onCancel: () => void;
}

export function PropuestaGeneradorPanel({
  propuesta,
  getPlatoNombre,
  onReroll,
  onAccept,
  onCancel,
}: PropuestaGeneradorPanelProps) {
  const { setTopLeftBack, setTitle } = useOutletContext<LayoutContext>();

  useEffect(() => {
    setTitle('Propuesta del generador');
    setTopLeftBack({ label: 'Comidas', onClick: onCancel });
    return () => {
      setTitle(null);
      setTopLeftBack(null);
    };
  }, [onCancel, setTitle, setTopLeftBack]);

  return (
    <div>
      <p className={sharedStyles.dateLabel}>
        Huecos rellenados al azar. Revisa la propuesta, vuelve a tirar si no convence, o acéptala
        para guardarla.
      </p>

      <div className={sharedStyles.group}>
        {propuesta.propuestas.map((p) => (
          <div key={`${p.fecha}__${p.tipo}`} className={sharedStyles.row}>
            <span>
              {formatFullDayLabel(parseISODate(p.fecha))} · {p.tipo === 'comida' ? 'Comida' : 'Cena'}
            </span>
            <span className={styles.rowMain}>
              <span className={p.platoId ? undefined : styles.sinPlato}>
                {p.platoId ? getPlatoNombre(p.platoId) : 'Sin plato'}
              </span>
              {p.perecederoUrgente && (
                <span className={styles.motivoCaducidad}>Usa algo que caduca pronto</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {propuesta.sinCandidato > 0 && (
        <p className={sharedStyles.emptyHint}>
          {propuesta.sinCandidato} hueco(s) sin plato: no hay platos de ese tipo o todos se
          repetían. Añade platos o baja las semanas sin repetir en Ajustes.
        </p>
      )}

      <button type="button" className={sharedStyles.saveButton} onClick={onAccept}>
        Aceptar
      </button>
      <div className={styles.secondaryRow}>
        <button type="button" className={styles.secondaryButton} onClick={onReroll}>
          Volver a tirar
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
