import { useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Placeholder } from '../components/Placeholder';
import type { LayoutContext } from '../lib/layoutContext';

/** Carcasa mock — ajustes de restricciones del generador, sin lógica todavía. */
export function RestriccionesScreen() {
  const { setTopLeftBack, setTitle } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();

  useEffect(() => {
    setTitle('Restricciones');
    setTopLeftBack({ label: 'Comidas', onClick: () => navigate('/comidas') });
    return () => {
      setTitle(null);
      setTopLeftBack(null);
    };
  }, [setTitle, setTopLeftBack, navigate]);

  return (
    <Placeholder
      title="En diseño"
      subtitle="Restricciones diarias y globales para el generador — pendiente de decidir el alcance."
    />
  );
}
