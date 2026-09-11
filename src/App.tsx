import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HoyScreen } from './screens/HoyScreen';
import { ComidasScreen } from './screens/ComidasScreen';
import { PlatosScreen } from './screens/PlatosScreen';
import { AjustesScreen } from './screens/AjustesScreen';
import { CompraScreen } from './screens/CompraScreen';
import { IngredientesScreen } from './screens/IngredientesScreen';
import { DespensaScreen } from './screens/DespensaScreen';
import { FinanzasScreen } from './screens/FinanzasScreen';
import { GymScreen } from './screens/GymScreen';
import { MesScreen } from './screens/MesScreen';
import { RestriccionesScreen } from './screens/RestriccionesScreen';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Fuera de Layout a propósito: pinta su propia cabecera dentro del bloque rotado
            (ver MesScreen.tsx) — el TopBar/TabBar normales no tendrían sentido aquí. */}
        <Route path="/comidas/mes" element={<MesScreen />} />
        <Route element={<Layout />}>
          <Route path="/" element={<HoyScreen />} />
          <Route path="/comidas" element={<ComidasScreen />} />
          <Route path="/comidas/platos" element={<PlatosScreen />} />
          <Route path="/comidas/restricciones" element={<RestriccionesScreen />} />
          <Route path="/ajustes" element={<AjustesScreen />} />
          <Route path="/compra" element={<CompraScreen />} />
          <Route path="/compra/ingredientes" element={<IngredientesScreen />} />
          <Route path="/compra/despensa" element={<DespensaScreen />} />
          <Route path="/finanzas" element={<FinanzasScreen />} />
          <Route path="/gym" element={<GymScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
