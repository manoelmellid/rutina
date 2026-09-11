/**
 * True si `nombre` coincide, sin distinguir mayúsculas/minúsculas ni espacios sueltos al principio
 * o al final, con el nombre de alguno de `existentes`. `excluirId` evita el falso positivo de
 * comparar un plato/ingrediente consigo mismo mientras se edita sin cambiar el nombre.
 */
export function hayCoincidencia<T extends { id: string; nombre: string }>(
  nombre: string,
  existentes: T[],
  excluirId?: string,
): boolean {
  const q = nombre.trim().toLowerCase();
  if (!q) return false;
  return existentes.some((e) => e.id !== excluirId && e.nombre.trim().toLowerCase() === q);
}
