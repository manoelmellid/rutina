import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import sharedStyles from '../features/comidas/AsignarComidaPanel.module.css';
import styles from './DespensaScreen.module.css';
import type { LayoutContext } from '../lib/layoutContext';
import { IconPlus } from '../components/icons';
import { formatCantidad, parseCantidad, UNIDAD_LABEL } from '../lib/units';
import {
  addToDespensa,
  deleteDespensaEntry,
  getAllIngredientes,
  getDespensa,
  saveDespensaEntry,
  type DespensaEntry,
  type Ingrediente,
} from '../lib/db';

type View = { mode: 'list' } | { mode: 'add' } | { mode: 'detail'; ingredienteId: string };

export function DespensaScreen() {
  const [entries, setEntries] = useState<DespensaEntry[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ mode: 'list' });
  const { setTopLeftBack, setTitle, setTopRightAction } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();

  async function refetch() {
    const [e, i] = await Promise.all([getDespensa(), getAllIngredientes()]);
    setEntries(e);
    setIngredientes(i);
    setLoading(false);
  }

  useEffect(() => {
    refetch();
  }, []);

  const ingMap = useMemo(
    () => new Map(ingredientes.map((i) => [i.id, i])),
    [ingredientes],
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

  // ---- agrupado por ingrediente ----
  const grupos = new Map<string, DespensaEntry[]>();
  for (const e of entries) {
    const arr = grupos.get(e.ingredienteId) ?? [];
    arr.push(e);
    grupos.set(e.ingredienteId, arr);
  }
  const gruposOrdenados = [...grupos.entries()].sort((a, b) =>
    (ingMap.get(a[0])?.nombre ?? '').localeCompare(ingMap.get(b[0])?.nombre ?? '', 'es'),
  );

  function resumen(loteList: DespensaEntry[], ing: Ingrediente | undefined): string {
    const total = loteList.reduce((s, e) => s + e.cantidad, 0);
    const nLotes = loteList.length;
    const cant = ing ? formatCantidad(total, ing.unidad) : String(total);
    const abiertos = loteList.filter((e) => e.abiertoEl !== null).length;
    const lotesTxt = nLotes === 1 ? '1 entrada' : `${nLotes} entradas`;
    return abiertos > 0 ? `${lotesTxt} · ${cant} · ${abiertos} abierta(s)` : `${lotesTxt} · ${cant}`;
  }

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
    const lotes = grupos.get(view.ingredienteId) ?? [];
    const ing = ingMap.get(view.ingredienteId);
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
          const rest = (grupos.get(view.ingredienteId) ?? []).filter((e) => e.id !== id);
          if (rest.length === 0) setView({ mode: 'list' });
        }}
      />
    );
  }

  return (
    <div>
      <p className={sharedStyles.dateLabel}>
        Lo que hay en casa. Se llenará solo al pulsar “Compra finalizada”; aquí puedes añadir
        o corregir a mano.
      </p>
      {gruposOrdenados.length === 0 ? (
        <p className={sharedStyles.emptyHint}>La despensa está vacía. Usa “+” para añadir algo.</p>
      ) : (
        <div className={sharedStyles.group}>
          {gruposOrdenados.map(([ingredienteId, loteList]) => {
            const ing = ingMap.get(ingredienteId);
            return (
              <button
                key={ingredienteId}
                type="button"
                className={sharedStyles.row}
                onClick={() => setView({ mode: 'detail', ingredienteId })}
              >
                <span className={styles.rowMain}>
                  <span>{ing?.nombre ?? '(eliminado)'}</span>
                  <span className={sharedStyles.rowSecondary}>{resumen(loteList, ing)}</span>
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
          <p className={sharedStyles.emptyHint}>
            No hay ingredientes en el catálogo. Créalos primero en la pantalla Ingredientes.
          </p>
        ) : (
          <div className={sharedStyles.group}>
            {filtered.map((i) => (
              <button
                key={i.id}
                type="button"
                className={sharedStyles.row}
                onClick={() => {
                  setPickedId(i.id);
                  setError(null);
                }}
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
          picked.tamanoPaquete !== null
            ? `paquete: ${formatCantidad(picked.tamanoPaquete, picked.unidad)}`
            : picked.unidad === 'ud'
              ? 'ej. 6'
              : 'ej. 400 g'
        }
        value={cantidad}
        onChange={(e) => {
          setCantidad(e.target.value);
          setError(null);
        }}
      />

      <button
        type="button"
        className={`${styles.granelToggle} ${abierto ? styles.granelToggleOn : ''}`}
        onClick={() => setAbierto((v) => !v)}
      >
        {abierto ? 'Ya abierto ✓' : 'Ya está abierto'}
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
        Cada línea es una entrada (un bote, un paquete…). Ajusta la cantidad solo para
        corregir errores; lo normal es que baje sola al pasar los días.
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
        <span className={sharedStyles.rowSecondary}>
          {lote.abiertoEl ? `abierto el ${lote.abiertoEl}` : 'sin abrir'}
        </span>
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
