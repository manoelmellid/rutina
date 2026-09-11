import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import styles from './Layout.module.css';
import { TopBar, type TopBarAction, type TopBarBack } from './TopBar';
import { TabBar } from './TabBar';
import type { LayoutContext } from '../lib/layoutContext';
import { sincronizarConsumoPendiente } from '../lib/consumo';

const TITLES: Record<string, string> = {
  '/': 'Hoy',
  '/comidas': 'Comidas',
  '/comidas/platos': 'Platos',
  '/ajustes': 'Ajustes',
  '/compra': 'Compra',
  '/compra/ingredientes': 'Ingredientes',
  '/compra/despensa': 'Despensa',
  '/finanzas': 'Finanzas',
  '/gym': 'Gym',
};

export function Layout() {
  const location = useLocation();
  const [topRightAction, setTopRightAction] = useState<TopBarAction | TopBarAction[] | null>(null);
  const [topLeftBack, setTopLeftBack] = useState<TopBarBack | null>(null);
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const title = customTitle ?? TITLES[location.pathname] ?? 'Rutina';

  const setTitle = useCallback((t: string | null) => setCustomTitle(t), []);
  const context = useMemo<LayoutContext>(
    () => ({ setTopRightAction, setTopLeftBack, setTitle }),
    [setTopRightAction, setTopLeftBack, setTitle],
  );

  // Descuento silencioso de la despensa al llegar el día de un plato planificado (Fase 5).
  // Fire-and-forget: sin loading state ni error visible — si falla, la próxima apertura de la
  // app lo reintenta (es idempotente).
  useEffect(() => {
    sincronizarConsumoPendiente(new Date());
  }, []);

  return (
    <div className={styles.page}>
      <TopBar title={title} action={topRightAction} back={topLeftBack} />
      <main className={`${styles.content} app-content-scroll`}>
        <Outlet context={context} />
      </main>
      <TabBar />
    </div>
  );
}
