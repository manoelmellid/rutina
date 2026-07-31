import { useCallback, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import styles from './Layout.module.css';
import { TopBar, type TopBarAction, type TopBarBack } from './TopBar';
import { TabBar } from './TabBar';
import { SettingsSheet } from './SettingsSheet';
import type { LayoutContext } from '../lib/layoutContext';

const TITLES: Record<string, string> = {
  '/': 'Hoy',
  '/comidas': 'Comidas',
  '/comidas/platos': 'Platos',
  '/compra': 'Compra',
  '/finanzas': 'Finanzas',
  '/gym': 'Gym',
};

export function Layout() {
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [topRightAction, setTopRightAction] = useState<TopBarAction | null>(null);
  const [topLeftBack, setTopLeftBack] = useState<TopBarBack | null>(null);
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const title = customTitle ?? TITLES[location.pathname] ?? 'Rutina';

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const setTitle = useCallback((t: string | null) => setCustomTitle(t), []);
  const context = useMemo<LayoutContext>(
    () => ({ setTopRightAction, setTopLeftBack, setTitle, openSettings }),
    [setTopRightAction, setTopLeftBack, setTitle, openSettings],
  );

  return (
    <div className={styles.page}>
      <TopBar title={title} action={topRightAction} back={topLeftBack} />
      <main className={`${styles.content} app-content-scroll`}>
        <Outlet context={context} />
      </main>
      <TabBar />
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
