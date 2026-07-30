import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import styles from './Layout.module.css';
import { TopBar } from './TopBar';
import { TabBar } from './TabBar';
import { SettingsSheet } from './SettingsSheet';

const TITLES: Record<string, string> = {
  '/': 'Hoy',
  '/comidas': 'Comidas',
  '/compra': 'Compra',
  '/finanzas': 'Finanzas',
  '/gym': 'Gym',
};

export function Layout() {
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const title = TITLES[location.pathname] ?? 'Rutina';

  return (
    <div className={styles.page}>
      <TopBar title={title} onOpenSettings={() => setSettingsOpen(true)} />
      <main className={styles.content}>
        <Outlet />
      </main>
      <TabBar />
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
