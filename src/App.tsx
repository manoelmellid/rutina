import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HoyScreen } from './screens/HoyScreen';
import { ComidasScreen } from './screens/ComidasScreen';
import { CompraScreen } from './screens/CompraScreen';
import { FinanzasScreen } from './screens/FinanzasScreen';
import { GymScreen } from './screens/GymScreen';
import { DebugViewport } from './components/DebugViewport';

function App() {
  return (
    <BrowserRouter>
      <DebugViewport />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HoyScreen />} />
          <Route path="/comidas" element={<ComidasScreen />} />
          <Route path="/compra" element={<CompraScreen />} />
          <Route path="/finanzas" element={<FinanzasScreen />} />
          <Route path="/gym" element={<GymScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
