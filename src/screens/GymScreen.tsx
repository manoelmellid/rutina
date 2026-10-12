import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { MarkdownView } from '../components/MarkdownView';
import { IconXmark } from '../components/icons';
import type { LayoutContext } from '../lib/layoutContext';
import { clearGymDoc, getGymDoc, setGymDoc, type GymDoc } from '../lib/db';
import styles from './GymScreen.module.css';

const MAX_BYTES = 2 * 1024 * 1024;
const EXT_MD = /\.(md|markdown)$/i;

export function GymScreen() {
  const { setTopRightAction, setTitle } = useOutletContext<LayoutContext>();
  const [doc, setDoc] = useState<GymDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getGymDoc().then((d) => {
      setDoc(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!doc) return;
    setTitle(doc.nombre.replace(EXT_MD, ''));
    setTopRightAction({
      icon: <IconXmark />,
      label: 'Cerrar',
      showLabel: true,
      onClick: () => {
        clearGymDoc().then(() => setDoc(null));
      },
    });
    return () => {
      setTitle(null);
      setTopRightAction(null);
    };
  }, [doc, setTitle, setTopRightAction]);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!EXT_MD.test(file.name)) {
      setError('Solo se admiten archivos .md');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('El archivo pesa más de 2 MB.');
      return;
    }
    try {
      const contenido = await file.text();
      if (!contenido.trim()) {
        setError('El archivo está vacío.');
        return;
      }
      const nuevo = { nombre: file.name, contenido, subidoEn: new Date().toISOString() };
      await setGymDoc(nuevo);
      setDoc({ ...nuevo, id: 'main' });
      setError(null);
    } catch {
      setError('No se pudo leer el archivo.');
    }
  }

  if (loading) return null;

  if (doc) return <MarkdownView source={doc.contenido} />;

  return (
    <div className={styles.card}>
      <p className={styles.title}>Ningún archivo abierto</p>
      <p className={styles.subtitle}>Abre un archivo .md para leerlo aquí.</p>
      <button type="button" className={styles.openButton} onClick={() => fileInputRef.current?.click()}>
        Abrir archivo .md
      </button>
      {error && <p className={styles.error}>{error}</p>}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        hidden
        onChange={handleFile}
      />
    </div>
  );
}
