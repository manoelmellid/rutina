import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Placeholder } from '../components/Placeholder';
import { IconGear } from '../components/icons';
import type { LayoutContext } from '../lib/layoutContext';

export function HoyScreen() {
  const { setTopRightAction, openSettings } = useOutletContext<LayoutContext>();

  useEffect(() => {
    setTopRightAction({ icon: <IconGear />, label: 'Ajustes', onClick: openSettings });
    return () => setTopRightAction(null);
  }, [setTopRightAction, openSettings]);

  return (
    <Placeholder
      title="Aún no hay nada que resumir"
      subtitle="Este dashboard se construye al final, cuando Comidas, Compra y Finanzas ya tengan datos reales."
    />
  );
}
