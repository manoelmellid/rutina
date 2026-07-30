import { useEffect, useState } from 'react';
import styles from './CompraScreen.module.css';
import { CompraItemRow } from '../features/compra/CompraItemRow';
import { IconPlus } from '../components/icons';
import { getWeekDays, toISODate } from '../lib/week';
import {
  deleteItemCompra,
  getAllPlatos,
  getComidasEnRango,
  getListaCompra,
  newId,
  saveItemCompra,
  type ItemCompra,
} from '../lib/db';

export function CompraScreen() {
  const [items, setItems] = useState<ItemCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    getListaCompra().then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  async function handleAdd() {
    const n = nombre.trim();
    if (!n) return;
    const item: ItemCompra = { id: newId(), nombre: n, cantidad: '', comprado: false };
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

  async function handleGenerarDesdeSemana() {
    const days = getWeekDays(0);
    const fechaInicio = toISODate(days[0]);
    const fechaFin = toISODate(days[6]);
    const [comidas, platos] = await Promise.all([
      getComidasEnRango(fechaInicio, fechaFin),
      getAllPlatos(),
    ]);

    const yaEnLista = new Set(items.map((i) => i.nombre.toLowerCase()));
    const nombresPlan = new Set<string>();
    for (const c of comidas) {
      if (!c.platoId) continue;
      const plato = platos.find((p) => p.id === c.platoId);
      if (plato) nombresPlan.add(plato.nombre);
    }

    const nuevos: ItemCompra[] = [...nombresPlan]
      .filter((n) => !yaEnLista.has(n.toLowerCase()))
      .map((n) => ({ id: newId(), nombre: n, cantidad: '', comprado: false }));

    if (nuevos.length === 0) return;
    await Promise.all(nuevos.map((i) => saveItemCompra(i)));
    setItems((prev) => [...prev, ...nuevos]);
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

      <button type="button" className={styles.generateButton} onClick={handleGenerarDesdeSemana}>
        Generar desde el plan semanal
      </button>

      {ordenados.length === 0 ? (
        <p className={styles.emptyHint}>Tu lista está vacía. Añade algo arriba.</p>
      ) : (
        <div className={styles.group}>
          {ordenados.map((item) => (
            <CompraItemRow
              key={item.id}
              item={item}
              onToggle={() => handleToggle(item)}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
