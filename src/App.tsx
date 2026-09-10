import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HoyScreen } from './screens/HoyScreen';
import { ComidasScreen } from './screens/ComidasScreen';
import { PlatosScreen } from './screens/PlatosScreen';
import { AjustesScreen } from './screens/AjustesScreen';
import { CompraScreen } from './screens/CompraScreen';
import { IngredientesScreen } from './screens/IngredientesScreen';
import { FinanzasScreen } from './screens/FinanzasScreen';
import { GymScreen } from './screens/GymScreen';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HoyScreen />} />
          <Route path="/comidas" element={<ComidasScreen />} />
          <Route path="/comidas/platos" element={<PlatosScreen />} />
          <Route path="/ajustes" element={<AjustesScreen />} />
          <Route path="/compra" element={<CompraScreen />} />
          <Route path="/compra/ingredientes" element={<IngredientesScreen />} />
          <Route path="/finanzas" element={<FinanzasScreen />} />
          <Route path="/gym" element={<GymScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
