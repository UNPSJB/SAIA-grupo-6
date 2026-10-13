import { useCallback, useMemo, useState } from "react";
import { usePaginas } from "./usePaginas";

/**
 * Filtra por `activo` y pagina en memoria.
 *
 * La paginación en sí vive en `usePaginas`; acá solo se agrega el filtro de
 * baja lógica y se le pasan los datos ya filtrados. `totalFiltrados` es lo
 * que hay que pasarle como `count` al componente `Paginacion` (que espera
 * el total de filas, no de páginas).
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