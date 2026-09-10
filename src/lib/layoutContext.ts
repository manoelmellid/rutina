import type { TopBarAction, TopBarBack } from '../components/TopBar';

export interface LayoutContext {
  setTopRightAction: (action: TopBarAction | null) => void;
  setTopLeftBack: (back: TopBarBack | null) => void;
  setTitle: (title: string | null) => void;
}
