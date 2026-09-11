import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import styles from './CompraScreen.module.css';
import { CompraItemRow } from '../features/compra/CompraItemRow';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconPlus, IconDespensa, IconIngredientes } from '../components/icons';
import type { LayoutContext } from '../lib/layoutContext';
import { etiquetaOrigen, reconciliarListaCompra, ventanaCompra } from '../lib/compra';
import { formatCantidad } from '../lib/units';
import {
  addToDespensa,
  deleteItemCompra,
  getAllIngredientes,
  getAllPlatos,
  getComidasEnRango,
  getDespensa,
  getListaCompra,
  newId,
  saveItemCompra,
  type Comida,
  type Ingrediente,
  type ItemCompra,
  type Plato,
} from '../lib/db';

export function CompraScreen() {
  const [items, setItems] = useState<ItemCompra[]>([]);
  const [comidas, setComidas] = useState<Comida[]>([]);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState('');
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const { setTopRightAction } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();

  useEffect(() => {
    async function cargar() {
      const ventana = ventanaCompra(new Date());
      const [itemsRaw, comidasVentana, platosAll, despensaAll, ingredientesAll] = await Promise.all([
        getListaCompra(),
        getComidasEnRango(ventana.desde, ventana.hasta),
        getAllPlatos(),
        getDespensa(),
        getAllIngredientes(),
      ]);
      const resultado = reconciliarListaCompra({
        items: itemsRaw,
        comidas: comidasVentana,
        platos: platosAll,
        despensa: despensaAll,
        ingredientes: ingredientesAll,
      });
      await Promise.all([
        ...resultado.aGuardar.map((i) => saveItemCompra(i)),
        ...resultado.aBorrar.map((id) => deleteItemCompra(id)),
      ]);
      setItems(resultado.items);
      setComidas(comidasVentana);
      setPlatos(platosAll);
      setIngredientes(ingredientesAll);
      setLoading(false);
    }
    cargar();
  }, []);

  useEffect(() => {
    setTopRightAction([
      {
        icon: <IconDespensa />,
        label: 'Despensa',
        onClick: () => navigate('/compra/despensa'),
      },
      {
        icon: <IconIngredientes />,
        label: 'Ingredientes',
        onClick: () => navigate('/compra/ingredientes'),
      },
    ]);
    return () => setTopRightAction(null);
  }, [setTopRightAction, navigate]);

  const comidasPorId = useMemo(() => new Map(comidas.map((c) => [c.id, c])), [comidas]);
  const platoById = useMemo(() => new Map(platos.map((p) => [p.id, p])), [platos]);
  const ingredienteById = useMemo(() => new Map(ingredientes.map((i) => [i.id, i])), [ingredientes]);

  async function handleAdd() {
    const n = nombre.trim();
    if (!n) return;
    const item: ItemCompra = { id: newId(), nombre: n, cantidad: 0, comprado: false, origenComidaIds: [] };
    await saveItemCompra(item);
    setItems((prev) => [...prev, item]);
    setNombre('');
  }

  async function handleToggle(item: ItemCompra) {
    const updated = { ...item, comprado: !item.comprado };
    await saveItemCompra(updated);
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
  }

  async function handleDelete(item: ItemCompra) {
    await deleteItemCompra(item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  async function handleFinish() {
    setConfirmingFinish(false);
    const comprados = items.filter((i) => i.comprado);
    await Promise.all(
      comprados
        .filter((i) => i.ingredienteId)
        .map((i) => addToDespensa(i.ingredienteId!, i.cantidad, false)),
    );
    await Promise.all(comprados.map((i) => deleteItemCompra(i.id)));
    setItems((prev) => prev.filter((i) => !i.comprado));
  }

  if (loading) return null;

  const pendientes = items.filter((i) => !i.comprado);
  const comprados = items.filter((i) => i.comprado);
  const ordenados = [...pendientes, ...comprados];

  return (
    <div>
      <div className={styles.addRow}>
        <input
          className={styles.addInput}
          placeholder="Añadir artículo…"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
        />
        <button type="button" className={styles.addButton} onClick={handleAdd} aria-label="Añadir">
          <IconPlus />
        </button>
      </div>

      {ordenados.length === 0 ? (
        <p className={styles.emptyHint}>Tu lista está vacía. Añade algo arriba.</p>
      ) : (
        <div className={styles.group}>
          {ordenados.map((item) => {
            const ing = item.ingredienteId ? ingredienteById.get(item.ingredienteId) : undefined;
            const nombreMostrado = item.ingredienteId ? (ing?.nombre ?? '(eliminado)') : item.nombre;
            const cantidadLabel =
              ing && item.cantidad > 0 ? formatCantidad(item.cantidad, ing.unidad) : undefined;
            const origenLabel =
              item.origenComidaIds.length > 0
                ? etiquetaOrigen(item.origenComidaIds, comidasPorId, platoById)
                : undefined;
            const avisoObsoleto =
              Boolean(item.ingredienteId) && item.comprado && item.origenComidaIds.length === 0;
            return (
              <CompraItemRow
                key={item.id}
                nombre={nombreMostrado}
                comprado={item.comprado}
                cantidadLabel={cantidadLabel}
                origenLabel={origenLabel}
                avisoObsoleto={avisoObsoleto}
                onToggle={() => handleToggle(item)}
                onDelete={() => handleDelete(item)}
              />
            );
          })}
        </div>
      )}

      {comprados.length > 0 && (
        <button
          type="button"
          className={styles.finishButton}
          onClick={() => setConfirmingFinish(true)}
        >
          Compra finalizada ({comprados.length})
        </button>
      )}

      {confirmingFinish && (
        <ConfirmDialog
          title="¿Compra finalizada?"
          message={`Los ${comprados.length} artículo(s) marcados salen de la lista; los que están en el catálogo de ingredientes se añaden a la despensa (paquete entero).`}
          confirmLabel="Finalizar"
          cancelLabel="Cancelar"
          onConfirm={handleFinish}
          onCancel={() => setConfirmingFinish(false)}
        />
      )}
    </div>
  );
}
