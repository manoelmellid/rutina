import { useCallback, useEffect, useRef } from 'react';

let subViewSeq = 0;

export interface UseSubViewHistoryResult {
  /**
   * Usar como el onClick del botón "‹ Volver" en pantalla (y de cualquier "Cancelar" que cierre
   * la sub-vista) — nunca cerrar una sub-vista llamando a `onClose` directamente desde ahí. Las
   * acciones que COMPLETAN la sub-vista (guardar, aceptar, borrar) siguen llamando a `onClose`
   * directamente, sin pasar por aquí.
   */
  close: () => void;
}

/**
 * Sincroniza una sub-vista "en el sitio" (lista → detalle dentro de la MISMA ruta, vía useState,
 * sin cambiar la URL — el patrón de `selectedId`/`view` usado en Platos, Ingredientes, Comidas y
 * Despensa) con el historial real del navegador, para que el gesto nativo de "volver" de iOS
 * (swipe desde el borde) cierre la sub-vista en vez de saltarse un nivel de navegación entero.
 *
 * Sin esto, entrar a un detalle nunca deja rastro en `history` (todas las transiciones lista→
 * detalle de esta app son solo cambios de estado local) — el gesto de iOS hace `history.back()`
 * sobre el historial real, que salta directo a la última RUTA real anterior.
 *
 * `active`: booleano derivado por cada sitio (`selectedId !== null`, `view.mode !== 'list'`...).
 * `onClose`: vuelve al estado "sin sub-vista" (p. ej. `() => setSelectedId(null)`).
 *
 * Deliberadamente SIN cleanup al desmontar: si el componente se desmonta por una navegación real
 * (p. ej. tocar otra pestaña de la tab bar) con la sub-vista aún abierta, no hay forma segura de
 * "hacer pop" de la entrada sintética sin pelearse con esa navegación — la Web History API solo
 * puede tocar la entrada superior. Coste aceptado: un swipe-atrás extra en ese caso concreto y
 * poco común; nunca navega mal ni pierde datos. Ver CLAUDE.md.
 */
export function useSubViewHistory(active: boolean, onClose: () => void): UseSubViewHistoryResult {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const pushedRef = useRef(false); // ¿tenemos ahora mismo una entrada sintética sin hacer pop?
  const tokenRef = useRef<number | null>(null);
  const prevActiveRef = useRef(false);

  const handlePopState = useCallback(() => {
    if (!pushedRef.current) return; // esta instancia no es la dueña de lo que acaba de pasar
    pushedRef.current = false;
    onCloseRef.current();
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handlePopState]);

  // Bookkeeping de push/pop. Sin cleanup a propósito (ver el comentario del JSDoc).
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = active;

    if (active && !wasActive) {
      const token = ++subViewSeq;
      tokenRef.current = token;
      window.history.pushState({ ...(window.history.state ?? {}), __subViewToken: token }, '');
      pushedRef.current = true;
    } else if (!active && wasActive && pushedRef.current) {
      // Se cerró por una vía que NO fue nuestro popstate (guardar/aceptar/borrar) — la entrada
      // sintética queda colgando, la quitamos nosotros.
      pushedRef.current = false;
      window.history.back();
    }
  }, [active]);

  const close = useCallback(() => {
    if (pushedRef.current) window.history.back();
    else onCloseRef.current();
  }, []);

  return { close };
}
