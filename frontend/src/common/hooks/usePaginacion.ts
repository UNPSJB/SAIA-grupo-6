import { useCallback, useMemo, useState } from "react";

/**
 * Filtra por `activo` y pagina en memoria.
 *
 * Antes cada página de listado repetía este cálculo entero, y solo una lo
 * hacía bien: el resto pasaba a `<Pagination.Root count={...}>` la cantidad de
 * FILAS en vez de la de PÁGINAS. Con 12 equipos salían 12 botones de página y
 * 11 tablas vacías.
 *
 * `totalPaginas` es lo que espera el `count` de Chakra, y sale correcto por
 * construcción. Además el filtro se calcula una sola vez: antes algunas
 * páginas lo recomputaban dos veces más solo para obtener el total.
 */
export function usePaginacion<T extends { activo: boolean }>(
  items: T[],
  verInactivos: boolean,
  pageSize = 10,
) {
  const [page, setPage] = useState(1);

  const filtrados = useMemo(
    () => items.filter((item) => (verInactivos ? !item.activo : item.activo)),
    [items, verInactivos],
  );

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / pageSize));

  // Si al cambiar el filtro la página actual queda fuera de rango, se vuelve a
  // la primera. Sin esto, pasar de "activos" a "inactivos" con muchas páginas
  // dejaba la tabla vacía.
  const paginaActual = Math.min(page, totalPaginas);

  const paginados = useMemo(() => {
    const inicio = (paginaActual - 1) * pageSize;
    return filtrados.slice(inicio, inicio + pageSize);
  }, [filtrados, paginaActual, pageSize]);

  const irAPagina = useCallback((nueva: number) => setPage(nueva), []);
  const primeraPagina = useCallback(() => setPage(1), []);

  return {
    filtrados,
    paginados,
    totalPaginas,
    totalFiltrados: filtrados.length,
    page: paginaActual,
    irAPagina,
    /** Alias de `irAPagina`, para los `onPageChange` que ya usan `setPage`. */
    setPage: irAPagina,
    primeraPagina,
    hayVariasPaginas: totalPaginas > 1,
  };
}

/**
 * Variante que además controla el switch de "ver inactivos".
 * Evita que cada página sincronice a mano el filtro con el número de página.
 */
export function usePaginacionConFiltro<T extends { activo: boolean }>(
  items: T[],
  pageSize = 10,
) {
  const [verInactivos, setVerInactivos] = useState(false);
  const paginacion = usePaginacion(items, verInactivos, pageSize);

  const cambiarFiltro = useCallback((nuevo: boolean) => {
    setVerInactivos(nuevo);
    // Al cambiar el filtro la página 1 siempre es válida, y evita quedar en una
    // página vacía.
    paginacion.primeraPagina();
  }, [paginacion]);

  return { ...paginacion, verInactivos, cambiarFiltro };
}