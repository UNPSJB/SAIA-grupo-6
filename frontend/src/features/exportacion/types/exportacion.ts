/** Tipos del módulo de exportación / reportes.

El backend expone `GET /exportacion/tablas` (lista de tablas con sus columnas)
y `GET /exportacion/{tabla}?formato=csv|pdf&columna=valor` (descarga directa).
Este front consume ambos de forma genérica: no sabe de tablas concretas,
solo lee el registro del backend y renderiza la UI correspondiente.
*/

export interface ColumnaExport {
  nombre: string;   // nombre de la columna en la BD
  etiqueta: string; // encabezado que se muestra en la UI
}

export interface TablaExport {
  nombre_tabla: string;
  etiqueta: string;
  columnas: string[];      // nombres de columna
  encabezados: string[];   // etiquetas de columna
  pk: string;
}

export type FormatoExport = "csv" | "pdf";

export interface FiltrosExport {
  [columna: string]: string | undefined;
}
