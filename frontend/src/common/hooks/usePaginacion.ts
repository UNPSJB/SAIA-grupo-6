import { useCallback, useMemo, useState } from "react";
import { usePaginas } from "./usePaginas";

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
 *
 * La paginación en sí vive en `usePaginas`; acá solo se agrega el filtro de
 * baja lógica y se le pasan los datos ya filtrados.
 */
export function usePaginacion<T extends { activo: boolean }>(
  items: T[],
  verInactivos: boolean,
  pageSize = 10,
) {
  const filtrados = useMemo(
    () => items.filter((item) => (verInactivos ? !item.activo : item.activo)),
    [items, verInactivos],
  );

  const paginacion = usePaginas(filtrados, pageSize);

  return {
    filtrados,
    ...paginacion,
    totalFiltrados: filtrados.length,
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

  const cambiarFiltro = useCallback(
    (nuevo: boolean) => {
      setVerInactivos(nuevo);
      // Al cambiar el filtro la página 1 siempre es válida, y evita quedar en una
      // página vacía.
      paginacion.primeraPagina();
    },
    [paginacion],
  );

  return { ...paginacion, verInactivos, cambiarFiltro };
}