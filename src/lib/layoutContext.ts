import type { TopBarAction } from '../components/TopBar';

export interface LayoutContext {
  setTopRightAction: (action: TopBarAction | null) => void;
  openSettings: () => void;
}
