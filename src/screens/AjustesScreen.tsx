import { useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import styles from './AjustesScreen.module.css';
import { exportBackup, importBackup, type ImportMode } from '../lib/backup';
import {
  clearAllData,
  getAllCategorias,
  getPreferencias,
  setPreferencias,
  type Categoria,
  type Preferencias,
} from '../lib/db';
import type { LayoutContext } from '../lib/layoutContext';
import { Stepper } from '../components/Stepper';
import { SegmentedControl } from '../components/SegmentedControl';
import { CategoriasManager } from '../features/ajustes/CategoriasManager';
import type { AlcanceGenerador } from '../lib/db';

const ALCANCE_OPTIONS: { value: AlcanceGenerador; label: string }[] = [
  { value: 'semanaEnVista', label: 'Semana en vista' },
  { value: 'diasAdelante', label: 'Días adelante' },
];

const IMPORT_MODE_OPTIONS: { value: ImportMode; label: string }[] = [
  { value: 'reemplazar', label: 'Sustituir todo' },
  { value: 'fusionar', label: 'Fusionar' },
];

const DIAS_SEMANA: { value: number; label: string }[] = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

export function AjustesScreen() {
  const { setTopLeftBack, setTitle } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('reemplazar');
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [prefs, setPrefs] = useState<Preferencias | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    setTitle('Ajustes');
    setTopLeftBack({ label: 'Hoy', onClick: () => navigate('/') });
    return () => {
      setTitle(null);
      setTopLeftBack(null);
    };
  }, [setTitle, setTopLeftBack, navigate]);

  useEffect(() => {
    Promise.all([getPreferencias(), getAllCategorias()]).then(([p, c]) => {
      setPrefs(p);
      setCategorias(c);
    });
  }, []);

  function refetchCategorias() {
    getAllCategorias().then(setCategorias);
  }

  async function updatePrefs(patch: Partial<Preferencias>) {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await setPreferencias(next);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await importBackup(file, importMode);
      setStatus(
        importMode === 'fusionar'
          ? 'Backup fusionado con lo que ya había. Recarga la app para ver los datos.'
          : 'Backup restaurado. Recarga la app para ver los datos.',
      );
    } catch {
      setStatus('No se pudo leer ese archivo como backup válido.');
    }
  }

  async function handleClearAll() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    await clearAllData();
    setConfirmingClear(false);
    setStatus('Todos los datos han sido borrados.');
    refetchCategorias();
    setPrefs(await getPreferencias());
  }

  return (
    <div>
      <div className={styles.group}>
        <button type="button" className={styles.row} onClick={() => exportBackup()}>
          Exportar backup (.json)
        </button>
        <button type="button" className={styles.row} onClick={() => fileInputRef.current?.click()}>
          Importar backup (.json)
        </button>
      </div>
      <div className={styles.stackedRow}>
        <span className={styles.controlLabel}>Al importar</span>
        <SegmentedControl<ImportMode>
          options={IMPORT_MODE_OPTIONS}
          value={importMode}
          onChange={setImportMode}
        />
      </div>
      <p className={styles.hint}>
        El backup sustituye a la sincronización en la nube. Descarga un archivo con todos tus datos
        (comidas, compra, ingredientes, categorías y ajustes) y podrás restaurarlo en este o en
        otro dispositivo. "Sustituir todo" borra los datos actuales antes de meter los del archivo.
        "Fusionar" no borra nada, solo añade o actualiza por id lo que traiga el archivo (útil para
        meter platos predefinidos sin perder lo que ya tienes).
      </p>

      {prefs && (
        <>
          <p className={styles.sectionLabel}>Generador</p>

          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Semanas sin repetir plato</span>
            <Stepper
              value={prefs.semanasAntiRepeticion}
              onChange={(v) => updatePrefs({ semanasAntiRepeticion: v })}
              min={0}
              max={12}
            />
          </div>
          <p className={styles.hint}>0 = desactivado.</p>

          <div className={styles.stackedRow}>
            <span className={styles.controlLabel}>Hasta dónde genera</span>
            <SegmentedControl<AlcanceGenerador>
              options={ALCANCE_OPTIONS}
              value={prefs.alcanceGenerador}
              onChange={(v) => updatePrefs({ alcanceGenerador: v })}
            />
          </div>

          {prefs.alcanceGenerador === 'semanaEnVista' ? (
            <div className={styles.controlRow}>
              <span className={styles.controlLabel}>Hasta el día</span>
              <select
                className={styles.select}
                value={prefs.alcanceDiaFin}
                onChange={(e) => updatePrefs({ alcanceDiaFin: Number(e.target.value) })}
              >
                {DIAS_SEMANA.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className={styles.controlRow}>
              <span className={styles.controlLabel}>Días hacia adelante</span>
              <Stepper
                value={prefs.alcanceDiasAdelante}
                onChange={(v) => updatePrefs({ alcanceDiasAdelante: v })}
                min={1}
                max={28}
              />
            </div>
          )}
        </>
      )}

      <p className={styles.sectionLabel}>Categorías de plato</p>
      <CategoriasManager categorias={categorias} onChange={refetchCategorias} />

      <div className={styles.group}>
        <button
          type="button"
          className={`${styles.row} ${styles.rowDanger}`}
          onClick={handleClearAll}
        >
          {confirmingClear ? '¿Seguro? Toca de nuevo para confirmar' : 'Borrar todos los datos'}
        </button>
      </div>

      {status && <p className={styles.hint}>{status}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={handleImportFile}
      />
    </div>
  );
}
