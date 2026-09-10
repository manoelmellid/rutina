import { useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Placeholder } from '../components/Placeholder';
import { IconAjustes } from '../components/icons';
import type { LayoutContext } from '../lib/layoutContext';

export function HoyScreen() {
  const { setTopRightAction } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();

  useEffect(() => {
    setTopRightAction({
      icon: <IconAjustes />,
      label: 'Ajustes',
      onClick: () => navigate('/ajustes'),
    });
    return () => setTopRightAction(null);
  }, [setTopRightAction, navigate]);

  return (
    <Placeholder
      title="Aún no hay nada que resumir"
      subtitle="Este dashboard se construye al final, cuando Comidas, Compra y Finanzas ya tengan datos reales."
    />
  );
}
