import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  // FLIP para el reordenado (pendientes primero, comprados al final): sin esto, marcar un
  // artículo lo salta al fondo de golpe, desplazando todo lo de debajo justo mientras se intenta
  // llegar al botón de "Compra finalizada" -- se siente como si el scroll estuviera roto (ver
  // CLAUDE.md). Con FLIP se desliza con una transición corta en vez de saltar, pero el artículo
  // SÍ se sigue moviendo al fondo al instante, como antes -- es solo el "cómo", no el "cuándo".
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const prevRectsRef = useRef<Map<string, DOMRect> | null>(null);

  useLayoutEffect(() => {
    const prevRects = prevRectsRef.current;
    if (!prevRects) return;
    prevRectsRef.current = null;
    rowRefs.current.forEach((el, id) => {
      const prev = prevRects.get(id);
      if (!prev) return;
      const next = el.getBoundingClientRect();
      const deltaY = prev.top - next.top;
      if (Math.abs(deltaY) < 1) return;
      el.style.transition = 'none';
      el.style.transform = `translateY(${deltaY}px)`;
      el.getBoundingClientRect(); // fuerza el reflow antes de animar, si no el navegador junta los dos cambios
      requestAnimationFrame(() => {
        el.style.transition = 'transform 220ms ease';
        el.style.transform = '';
      });
    });
  });

  function capturarPosiciones() {
    const rects = new Map<string, DOMRect>();
    rowRefs.current.forEach((el, id) => rects.set(id, el.getBoundingClientRect()));
    prevRectsRef.current = rects;
  }

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
        showLabel: true,
        onClick: () => navigate('/compra/despensa'),
      },
      {
        icon: <IconIngredientes />,
        label: 'Ingredientes',
        showLabel: true,
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
    capturarPosiciones();
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

  const comprados = items.filter((i) => i.comprado);
  const ordenados = [...items].sort((a, b) => Number(a.comprado) - Number(b.comprado));

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
                ref={(el) => {
                  if (el) rowRefs.current.set(item.id, el);
                  else rowRefs.current.delete(item.id);
                }}
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
          message={`${comprados.length === 1 ? 'El artículo marcado sale' : `Los ${comprados.length} artículos marcados salen`} de la lista. Los del catálogo de ingredientes se añaden a la despensa en su paquete completo.`}
          confirmLabel="Finalizar"
          cancelLabel="Cancelar"
          onConfirm={handleFinish}
          onCancel={() => setConfirmingFinish(false)}
        />
      )}
    </div>
  );
}
