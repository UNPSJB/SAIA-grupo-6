import { useCallback, useEffect, useRef, useState } from "react";

import type { Pagina } from "../api/paginacion";

/**
 * Carga de un listado con la paginación resuelta en el SERVIDOR.
 *
 * Es la contraparte paginada de `useLista`: en vez de traer todo y recortar
 * en el navegador (`usePaginas`), le pasa `page`/`page_size` al service y
 * solo guarda las filas de la página más el total. Para el usuario se ve
 * igual que antes (mismo componente `Paginacion`), pero la tabla ya no pide
 * miles de filas para mostrar 10.
 *
 * Contrato igual al de `useLista`: `cargar` tiene que venir memoizada con
 * `useCallback`, porque su identidad es dependencia del efecto que pide los
 * datos. Y el `setTimeout(..., 0)` de siempre: sin él, con `React.StrictMode`
 * el montaje de desarrollo dispara el efecto dos veces seguidas.
 *
 * Cuando cambia cualquier `dependencia` (un filtro, el switch de inactivos)
 * se vuelve a la página 1. Es el mismo "ajustar estado durante el render"
 * de `usePaginas`: así el efecto dispara una sola vez, ya con la página
 * correcta, sin renders con la tabla vacía de por medio.
 *
 * ```
 * const { items, total, page, setPage, hayVariasPaginas, loading, error } =
 *   useListaPaginada({
 *     cargar: listarInsumosPaginados,
 *     dependencias: [verInactivos],
 *     valorInicial: [],
 *     mensajeError: "No se pudieron cargar los insumos",
 *   });
 * ```
 */
export interface OpcionesListaPaginada<T> {
  /** Pide una página al backend: recibe (page, pageSize) y devuelve el sobre `Pagina`. */
  cargar: (page: number, pageSize: number) => Promise<Pagina<T>>;
  /** Lo que hay que mirar para volver a pedir desde la página 1 (filtros, fechas, ...). */
  dependencias: readonly unknown[];
  /** Con qué se arma `items` mientras llega la primera respuesta. */
  valorInicial: T[];
  /** Qué se le muestra al usuario si el listado falla. */
  mensajeError: string;
  /** Filas por página. */
  pageSize?: number;
}

export function useListaPaginada<T>(opciones: OpcionesListaPaginada<T>) {
  const { cargar, dependencias, valorInicial, mensajeError, pageSize = 10 } =
    opciones;

  const [items, setItems] = useState<T[]>(valorInicial);
  const [total, setTotal] = useState(0);
  const [paginaPedida, setPaginaPedida] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carrera de respuestas (misma idea que `useLista`): si se pide la página 2
  // y enseguida la 3, y la 3 resuelve primero, la respuesta tardía de la 2 no
  // puede pisar `items` ni `total` ni apagar `loading`.
  const ultimoPedido = useRef(0);

  const resetKey = JSON.stringify(dependencias);
  const [resetKeyVisto, setResetKeyVisto] = useState(resetKey);
  if (resetKey !== resetKeyVisto) {
    setResetKeyVisto(resetKey);
    setPaginaPedida(1);
  }

  /*
   * La página pedida se recorta contra el total de la última respuesta en vez
   * de corregir el estado: si el filtro se acotó (o se borró la última fila
   * de la última página) y la página actual quedó afuera, `page` baja solo al
   * último valor válido y el efecto de abajo vuelve a pedir. Es el mismo
   * "recortar, no corregir" que hace `usePaginas`.
   *
   * Esto también recupera la página fuera de rango: con `total > 0` el
   * backend responde `items` vacíos, `totalPaginas` baja, `page` se ajusta
   * y el efecto re-fetch dispara la última página válida — el usuario nunca
   * queda mirando una tabla vacía sin paginación.
   */
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(paginaPedida, totalPaginas);

  const recargar = useCallback(
    async (pagina?: number) => {
      const pedido = ++ultimoPedido.current;
      try {
        setLoading(true);
        setError(null);

        const respuesta = await cargar(pagina ?? page, pageSize);
        if (pedido !== ultimoPedido.current) return; // llegó tarde: se descarta
        setItems(respuesta.items);
        setTotal(respuesta.total);
      } catch (err) {
        if (pedido !== ultimoPedido.current) return;
        // Igual que `useABM`: si el backend explicó el fallo, ese mensaje es
        // el que sirve; el texto genérico es la red de seguridad.
        setError(
          err instanceof Error ? err.message : mensajeError
        );
      } finally {
        // Solo el último pedido apaga el spinner (ver `useLista`).
        if (pedido === ultimoPedido.current) setLoading(false);
      }
    },
    [cargar, mensajeError, pageSize, page]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void recargar();
    }, 0);

    return () => window.clearTimeout(timeoutId);
    // `dependencias` son los filtros que declara el hook que llama a este,
    // no una constante: eslint no los puede verificar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recargar, ...dependencias]);

  const setPage = useCallback((nueva: number) => setPaginaPedida(nueva), []);
  const primeraPagina = useCallback(() => setPaginaPedida(1), []);

  return {
    items,
    /** Total de filas del filtrado completo: es el `count` de `Paginacion`. */
    total,
    page,
    setPage,
    /** Alias de `setPage` para los call sites que usan el nombre de la acción. */
    irAPagina: setPage,
    primeraPagina,
    totalPaginas,
    hayVariasPaginas: totalPaginas > 1,
    loading,
    error,
    /** Re-pide la página actual (para después de una mutación). */
    recargar,
  };
}
