/**
 * Sobre estándar de los listados paginados en el servidor.
 *
 * Antes cada tabla pedía la lista completa y recortaba en el navegador
 * (`usePaginas`); ahora el backend recibe `page`/`page_size` y devuelve solo
 * las filas de esa página más el total. `total` es la cantidad de FILAS que
 * cumplen el filtro (no de páginas), que es lo que el componente `Paginacion`
 * espera como `count`.
 */
export interface Pagina<T> {
  /** Filas de esta página. */
  items: T[];
  /** Total de filas del filtrado completo. */
  total: number;
  page: number;
  page_size: number;
  total_paginas: number;
}

/**
 * Arma el query string de un pedido de página, con los filtros extra que
 * correspondan. Los valores `undefined` / `null` / `""` se omiten para no
 * ensuciar la URL (el backend ya tiene sus defaults).
 */
export function queryPagina(
  page: number,
  pageSize: number,
  extra?: Record<string, string | number | boolean | undefined | null>
): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (extra) {
    for (const [clave, valor] of Object.entries(extra)) {
      if (valor === undefined || valor === null || valor === "") continue;
      params.set(clave, String(valor));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
