import { NavLink } from 'react-router-dom';
import styles from './TabBar.module.css';
import { IconComidas, IconCompra, IconFinanzas, IconGym, IconHoy } from './icons';

const TABS = [
  { to: '/', label: 'Hoy', Icon: IconHoy, end: true },
  { to: '/comidas', label: 'Comidas', Icon: IconComidas },
  { to: '/compra', label: 'Compra', Icon: IconCompra },
  { to: '/finanzas', label: 'Finanzas', Icon: IconFinanzas },
  { to: '/gym', label: 'Gym', Icon: IconGym },
];

export function TabBar() {
  return (
    <nav className={styles.tabBar}>
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
        >
          <Icon />
          <span className={styles.label}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
