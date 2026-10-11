import { useCallback, useMemo, useState } from "react";

/**
 * Pagina una lista que ya viene filtrada.
 *
 * Es la base de toda la paginación de la app. No sabe nada de `activo`: la
 * lista que recibe ya viene filtrada por el hook o el servicio de la feature.
 * Para el caso de los catálogos que además filtran por baja lógica está
 * `usePaginacion`, queenvuelve a esta.
 *
 * `resetKey` es lo que hace que la paginación no se rompa al cambiar un filtro:
 * si el contenido se acota (por ejemplo, de 12 equipos a 1) y seguís en la
 * página 3, la tabla queda vacía sin explicación. El key es una cadena con los
 * filtros que apliquen; al cambiar, se vuelve a la primera página.
 *
 * ```
 * const { paginados, page, setPage, totalPaginas, hayVariasPaginas } =
 *   usePaginas(items, 10, `${desde}|${hasta}|${equipo}`);
 * ```
 */
export function usePaginas<T>(
  items: T[],
  pageSize = 10,
  resetKey?: string,
) {
  const [paginaPedida, setPaginaPedida] = useState(1);

  /*
   * Volver a la primera se ajusta durante el render, no en un `useEffect`: con
   * el efecto hay un render en el que la tabla ya se pintó vacía (página 3 de
   * una lista que ahora tiene 1) antes de corregirla. Es el patrón que
   * documenta React para "ajustar estado cuando cambia una prop", y evita el
   * render de más.
   */
  const [resetKeyVisto, setResetKeyVisto] = useState(resetKey);
  if (resetKey !== resetKeyVisto) {
    setResetKeyVisto(resetKey);
    setPaginaPedida(1);
  }

  const totalPaginas = Math.max(1, Math.ceil(items.length / pageSize));

  /*
   * La página pedida se recorta al rango válido en vez de corregir el estado:
   * si el filtro se acota desde la página 5 a una lista de 1 página, `page`
   * devuelve 1 y la tabla muestra algo, sin importar cuántas veces más se
   * escriba el 1.
   */
  const page = Math.min(paginaPedida, totalPaginas);

  const paginados = useMemo(() => {
    const inicio = (page - 1) * pageSize;
    return items.slice(inicio, inicio + pageSize);
  }, [items, page, pageSize]);

  const setPage = useCallback((nueva: number) => setPaginaPedida(nueva), []);
  const primeraPagina = useCallback(() => setPaginaPedida(1), []);

  return {
    paginados,
    page,
    setPage,
    /** Alias de `setPage` para los call sites que usan el nombre de la acción. */
    irAPagina: setPage,
    primeraPagina,
    totalPaginas,
    total: items.length,
    hayVariasPaginas: totalPaginas > 1,
  };
}