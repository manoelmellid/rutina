import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import sharedStyles from '../features/comidas/AsignarComidaPanel.module.css';
import styles from './DespensaScreen.module.css';
import type { LayoutContext } from '../lib/layoutContext';
import { IconPlus } from '../components/icons';
import { formatCantidad, parseCantidad, UNIDAD_LABEL } from '../lib/units';
import { agruparDespensa, etiquetaLote, ingredientesEnPlan, resumenLotes } from '../lib/despensa';
import { getWeekDays, toISODate } from '../lib/week';
import {
  addToDespensa,
  deleteDespensaEntry,
  getAllIngredientes,
  getAllPlatos,
  getComidasEnRango,
  getDespensa,
  saveDespensaEntry,
  type Comida,
  type DespensaEntry,
  type Ingrediente,
  type Plato,
} from '../lib/db';

type View = { mode: 'list' } | { mode: 'add' } | { mode: 'detail'; ingredienteId: string };

export function DespensaScreen() {
  const [entries, setEntries] = useState<DespensaEntry[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [comidas, setComidas] = useState<Comida[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ mode: 'list' });
  const { setTopLeftBack, setTitle, setTopRightAction } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();

  async function refetch() {
    const days = getWeekDays(0);
    const [e, i, p, c] = await Promise.all([
      getDespensa(),
      getAllIngredientes(),
      getAllPlatos(),
      getComidasEnRango(toISODate(days[0]), toISODate(days[6])),
    ]);
    setEntries(e);
    setIngredientes(i);
    setPlatos(p);
    setComidas(c);
    setLoading(false);
  }

  useEffect(() => {
    refetch();
  }, []);

  const ingMap = useMemo(
    () => new Map(ingredientes.map((i) => [i.id, i])),
    [ingredientes],
  );

  const enPlan = useMemo(
    () => ingredientesEnPlan(comidas, new Map(platos.map((p) => [p.id, p]))),
    [comidas, platos],
  );

  useEffect(() => {
    if (view.mode === 'list') {
      setTitle(null);
      setTopLeftBack({ label: 'Compra', onClick: () => navigate('/compra') });
      setTopRightAction({ icon: <IconPlus />, label: 'Añadir', onClick: () => setView({ mode: 'add' }) });
    } else if (view.mode === 'add') {
      setTitle('Añadir a la despensa');
      setTopLeftBack({ label: 'Despensa', onClick: () => setView({ mode: 'list' }) });
      setTopRightAction(null);
    } else {
      setTitle(ingMap.get(view.ingredienteId)?.nombre ?? 'Ingrediente');
      setTopLeftBack({ label: 'Despensa', onClick: () => setView({ mode: 'list' }) });
      setTopRightAction(null);
    }
    return () => {
      setTitle(null);
      setTopLeftBack(null);
      setTopRightAction(null);
    };
  }, [view, ingMap, setTitle, setTopLeftBack, setTopRightAction, navigate]);

  if (loading) return null;

  const grupos = agruparDespensa(entries, ingMap);

  if (view.mode === 'add') {
    return (
      <AddForm
        ingredientes={ingredientes}
        onAdd={async (ingredienteId, cantidad, abierto) => {
          await addToDespensa(ingredienteId, cantidad, abierto);
          await refetch();
          setView({ mode: 'list' });
        }}
      />
    );
  }

  if (view.mode === 'detail') {
    const grupo = grupos.find((g) => g.ingredienteId === view.ingredienteId);
    const lotes = grupo ? [grupo.sinAbrir, grupo.abierto].filter((l): l is DespensaEntry => l !== null) : [];
    const ing = ingMap.get(view.ingredienteId);
    if (lotes.length === 0) {
      return (
        <p className={sharedStyles.emptyHint}>No quedan lotes de este ingrediente.</p>
      );
    }
    return (
      <DetailView
        ing={ing}
        lotes={lotes}
        onChange={async (updated) => {
          await saveDespensaEntry(updated);
          await refetch();
        }}
        onDelete={async (id) => {
          await deleteDespensaEntry(id);
          await refetch();
          const rest = lotes.filter((e) => e.id !== id);
          if (rest.length === 0) setView({ mode: 'list' });
        }}
      />
    );
  }

  return (
    <div>
      <p className={sharedStyles.dateLabel}>
        Lo que hay en casa. Se llenará al pulsar “Compra finalizada” (Fase 4); aquí puedes
        añadir o corregir a mano. Lo marcado <strong>en el plan</strong> lo usa un plato ya
        asignado esta semana.
      </p>
      {grupos.length === 0 ? (
        <p className={sharedStyles.emptyHint}>La despensa está vacía. Usa “+” para añadir algo.</p>
      ) : (
        <div className={sharedStyles.group}>
          {grupos.map((grupo) => {
            const ing = ingMap.get(grupo.ingredienteId);
            return (
              <button
                key={grupo.ingredienteId}
                type="button"
                className={sharedStyles.row}
                onClick={() => setView({ mode: 'detail', ingredienteId: grupo.ingredienteId })}
              >
                <span className={styles.rowMain}>
                  <span>
                    {ing?.nombre ?? '(eliminado)'}
                    {enPlan.has(grupo.ingredienteId) && (
                      <span className={styles.planBadge}>en el plan</span>
                    )}
                  </span>
                  <span className={sharedStyles.rowSecondary}>{resumenLotes(grupo, ing)}</span>
                </span>
                <span className={sharedStyles.rowSecondary}>›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function AddForm({
  ingredientes,
  onAdd,
}: {
  ingredientes: Ingrediente[];
  onAdd: (ingredienteId: string, cantidad: number, abierto: boolean) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const picked = ingredientes.find((i) => i.id === pickedId) ?? null;
  const filtered = useMemo(() => {
    const sorted = [...ingredientes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const q = query.trim().toLowerCase();
    return q ? sorted.filter((i) => i.nombre.toLowerCase().includes(q)) : sorted;
  }, [ingredientes, query]);

  /** Prerrellena la cantidad con el paquete entero (vacío si es a granel). */
  function pick(i: Ingrediente) {
    setPickedId(i.id);
    setCantidad(i.tamanoPaquete !== null ? formatCantidad(i.tamanoPaquete, i.unidad) : '');
    setAbierto(false);
    setError(null);
  }

  async function submit() {
    if (!picked) {
      setError('Elige un ingrediente.');
      return;
    }
    const parsed = parseCantidad(cantidad, picked.unidad);
    if (parsed === null || parsed <= 0) {
      setError('Cantidad no válida para la unidad del ingrediente.');
      return;
    }
    await onAdd(picked.id, parsed, abierto);
  }

  if (!picked) {
    return (
      <div>
        <input
          className={sharedStyles.search}
          placeholder="Buscar ingrediente…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {ingredientes.length === 0 ? (
          <button
            type="button"
            className={sharedStyles.saveButton}
            onClick={() => navigate('/compra/ingredientes')}
          >
            No hay ingredientes. Crear el primero
          </button>
        ) : (
          <div className={sharedStyles.group}>
            {filtered.map((i) => (
              <button
                key={i.id}
                type="button"
                className={sharedStyles.row}
                onClick={() => pick(i)}
              >
                <span>{i.nombre}</span>
                <span className={sharedStyles.rowSecondary}>{UNIDAD_LABEL[i.unidad]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className={sharedStyles.group}>
        <div className={sharedStyles.row}>
          <span>{picked.nombre}</span>
          <button
            type="button"
            className={sharedStyles.rowAccent}
            onClick={() => {
              setPickedId(null);
              setError(null);
            }}
          >
            Cambiar
          </button>
        </div>
      </div>

      <p className={styles.fieldLabel}>Cantidad ({UNIDAD_LABEL[picked.unidad]})</p>
      <input
        className={sharedStyles.search}
        inputMode="decimal"
        placeholder={
          picked.unidad === 'ud' ? 'ej. 6' : picked.unidad === 'ml' ? 'ej. 500 ml' : 'ej. 400 g'
        }
        value={cantidad}
        onChange={(e) => {
          setCantidad(e.target.value);
          setError(null);
        }}
      />

      <button
        type="button"
        className={`${styles.abiertoToggle} ${abierto ? styles.abiertoToggleOn : ''}`}
        onClick={() => setAbierto((v) => !v)}
      >
        {abierto ? 'Ya estaba abierto ✓' : 'Ya estaba abierto'}
      </button>

      {error && <p className={styles.error}>{error}</p>}

      <button type="button" className={sharedStyles.saveButton} onClick={submit}>
        Añadir a la despensa
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function DetailView({
  ing,
  lotes,
  onChange,
  onDelete,
}: {
  ing: Ingrediente | undefined;
  lotes: DespensaEntry[];
  onChange: (updated: DespensaEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div>
      <p className={sharedStyles.dateLabel}>
        Un lote sin abrir y, como mucho, uno abierto. Ajusta la cantidad solo para corregir;
        lo normal es que baje sola al pasar los días.
      </p>
      <div className={sharedStyles.group}>
        {lotes.map((lote) => (
          <LoteRow
            key={`${lote.id}:${lote.cantidad}`}
            lote={lote}
            ing={ing}
            onChange={onChange}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function LoteRow({
  lote,
  ing,
  onChange,
  onDelete,
}: {
  lote: DespensaEntry;
  ing: Ingrediente | undefined;
  onChange: (updated: DespensaEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(
    ing ? formatCantidad(lote.cantidad, ing.unidad) : String(lote.cantidad),
  );
  const [confirming, setConfirming] = useState(false);

  function commit() {
    if (!ing) return;
    const parsed = parseCantidad(draft, ing.unidad);
    if (parsed === null || parsed < 0) {
      setDraft(formatCantidad(lote.cantidad, ing.unidad));
      return;
    }
    if (parsed === 0) {
      onDelete(lote.id);
      return;
    }
    if (parsed !== lote.cantidad) onChange({ ...lote, cantidad: parsed });
  }

  return (
    <div className={sharedStyles.row}>
      <span className={styles.rowMain}>
        <input
          className={styles.loteInput}
          value={draft}
          inputMode="decimal"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <span className={sharedStyles.rowSecondary}>{etiquetaLote(lote)}</span>
      </span>
      <button
        type="button"
        className={confirming ? sharedStyles.rowDanger : sharedStyles.rowSecondary}
        onClick={() => {
          if (confirming) onDelete(lote.id);
          else setConfirming(true);
        }}
      >
        {confirming ? '¿Seguro?' : 'Quitar'}
      </button>
    </div>
  );
}
