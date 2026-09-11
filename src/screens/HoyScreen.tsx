import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import styles from './HoyScreen.module.css';
import { IconAjustes } from '../components/icons';
import type { LayoutContext } from '../lib/layoutContext';
import {
  esCompraUrgente,
  estadoCompra,
  reconciliarListaCompra,
  ventanaCompra,
  type EstadoCompra,
} from '../lib/compra';
import { toISODate } from '../lib/week';
import {
  deleteItemCompra,
  getAllIngredientes,
  getAllPlatos,
  getComidasEnRango,
  getDespensa,
  getListaCompra,
  saveItemCompra,
  type Comida,
  type Plato,
  type TipoComida,
} from '../lib/db';

const TIPOS: { tipo: TipoComida; label: string }[] = [
  { tipo: 'comida', label: 'Comida' },
  { tipo: 'cena', label: 'Cena' },
];

interface ResumenComida {
  texto: string;
  clase: string;
}

function resumenComida(comida: Comida | undefined, platoById: Map<string, Plato>): ResumenComida {
  if (!comida) return { texto: 'Sin asignar', clase: styles.valorVacio };
  if (comida.especial) {
    const nombre = comida.especial === 'tupper' ? 'Tupper' : 'Fuera';
    return {
      texto: comida.tags.length ? `${nombre} · ${comida.tags.join(', ')}` : nombre,
      clase: styles.valorEspecial,
    };
  }
  if (comida.platoId) {
    const nombre = platoById.get(comida.platoId)?.nombre ?? '(eliminado)';
    return { texto: nombre, clase: nombre === '(eliminado)' ? styles.valorEliminado : '' };
  }
  return { texto: 'Sin asignar', clase: styles.valorVacio };
}

export function HoyScreen() {
  const { setTopRightAction } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();
  const [comidasHoy, setComidasHoy] = useState<Comida[]>([]);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [estado, setEstado] = useState<EstadoCompra | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTopRightAction({
      icon: <IconAjustes />,
      label: 'Ajustes',
      onClick: () => navigate('/ajustes'),
    });
    return () => setTopRightAction(null);
  }, [setTopRightAction, navigate]);

  useEffect(() => {
    async function cargar() {
      const hoy = new Date();
      const hoyISO = toISODate(hoy);
      const ventana = ventanaCompra(hoy);
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
      const comidasPorId = new Map(comidasVentana.map((c) => [c.id, c]));
      setComidasHoy(comidasVentana.filter((c) => c.fecha === hoyISO));
      setPlatos(platosAll);
      setEstado(estadoCompra(resultado.items, comidasPorId, hoy));
      setLoading(false);
    }
    cargar();
  }, []);

  const platoById = useMemo(() => new Map(platos.map((p) => [p.id, p])), [platos]);

  function irAComidas() {
    navigate('/comidas', { state: { fecha: toISODate(new Date()) } });
  }

  if (loading) return null;

  const urgente = estado ? esCompraUrgente(estado) : false;
  const compraClase = estado && estado.pendientes === 0 ? styles.compraAlDia : urgente ? styles.compraUrgente : styles.compraMargen;
  const compraTexto =
    !estado || estado.pendientes === 0
      ? 'Estás al día con la compra.'
      : urgente
        ? 'Te falta ir a la compra en los próximos días.'
        : 'Puedes esperar unos días para ir a la compra.';

  return (
    <div>
      <div className={styles.card}>
        {TIPOS.map(({ tipo, label }) => {
          const comida = comidasHoy.find((c) => c.tipo === tipo);
          const r = resumenComida(comida, platoById);
          return (
            <button key={tipo} type="button" className={styles.row} onClick={irAComidas}>
              <span className={styles.tipo}>{label}</span>
              <span className={`${styles.valor} ${r.clase}`}>{r.texto}</span>
            </button>
          );
        })}
      </div>

      <div className={`${styles.card} ${styles.compraCard}`}>
        <p className={styles.compraLabel}>Compra</p>
        <p className={`${styles.compraTexto} ${compraClase}`}>{compraTexto}</p>
      </div>
    </div>
  );
}
