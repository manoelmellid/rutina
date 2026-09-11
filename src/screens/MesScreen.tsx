import { useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Placeholder } from '../components/Placeholder';
import type { LayoutContext } from '../lib/layoutContext';

/** Carcasa mock — la vista real (horizontal, mes/varias semanas) está pendiente de brainstorming. */
export function MesScreen() {
  const { setTopLeftBack, setTitle } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();

  useEffect(() => {
    setTitle('Mes');
    setTopLeftBack({ label: 'Comidas', onClick: () => navigate('/comidas') });
    return () => {
      setTitle(null);
      setTopLeftBack(null);
    };
  }, [setTitle, setTopLeftBack, navigate]);

  return (
    <Placeholder
      title="En diseño"
      subtitle="Vista horizontal de mes o varias semanas — pendiente de decidir cómo funciona."
    />
  );
}
