import type { CSSProperties } from "react";

/**
 * Tokens de estilo compartidos por toda la aplicación.
 *
 * CAPA DE COMPATIBILIDAD (paso 1 de la migración a Chakra v3): los ~80
 * archivos que todavía importan desde acá siguen compilando sin tocar
 * nada, pero la fuente de verdad ya no es este archivo, sino el sistema
 * de Chakra en `src/theme/index.ts`, que define la paleta `brand`.
 *
 * Cada constante está anotada con el token del tema que la reemplaza.
 * El siguiente paso del refactor es reemplazar estos imports por
 * referencias al tema (`brand.500`, `colorPalette="brand"`, `color`
 * semánticos de Chakra) hasta que acá quede solo `estiloInput` y
 * `estiloLabel` (y eventualmente desaparezca).
 */

/* ── Paleta de marca → {colors.brand.*} ─────────────────────────── */

/** Teal de marca. Botones primarios ("Agregar"), acentos y enlaces → `brand.500`. */
export const TEAL = "#468189"; // {colors.brand.500}

/** Variante clara del teal de marca: bordes de inputs y separadores → `brand.300`. */
export const TEAL_CLARO = "#90BEBB"; // {colors.brand.300}

/** Teal de marca oscurecido, usado como estado `hover` → `brand.700`. */
export const TEAL_OSCURO = "#37666d"; // {colors.brand.700}

/* ── Semánticos: peligro → {colors.red.*} ───────────────────────── */

/** Rojo de acciones destructivas: botones "Eliminar"/"Dar de baja" → `red.solid`. */
export const PELIGRO = "#d9534f"; // {colors.red.600}

/** Estado `hover` de `PELIGRO` → `red.solid` +1 escalón. */
export const PELIGRO_HOVER = "#c9302c"; // {colors.red.700}

/** Rojo para texto de error (validaciones inline, avisos) → `red.fg`. */
export const PELIGRO_TEXTO = "#c92a2a"; // {colors.red.700}

/* ── Semánticos: advertencia → {colors.orange.*} ───────────────── */

/** Ámbar del botón "Modificar" → `orange.solid`. */
export const ADVERTENCIA = "#f0ad4e"; // {colors.orange.400}

/**
 * Estado `hover` del botón "Modificar".
 *
 * Estandarizado en `#ec971f` (la variante más oscura de `ADVERTENCIA`).
 * Antes el hover estaba partido: cinco archivos usaban `#ec971f` y otros
 * seis repetían `#f0ad4e`, con lo cual el botón no daba ninguna señal
 * visual al pasar el cursor. Se elige el tono más oscuro porque un `hover`
 * que no se distingue del estado base es indistinguible.
 */
export const ADVERTENCIA_HOVER = "#ec971f"; // {colors.orange.500}

/* ── Semánticos: éxito → {colors.green.*} ──────────────────────── */

/** Verde de acciones positivas: "Reactivar", "Guardar" → `green.solid`. */
export const EXITO = "#28a745"; // {colors.green.500}

/** Estado `hover` de `EXITO` → `green.solid` +1 escalón. */
export const EXITO_HOVER = "#218838"; // {colors.green.600}

/** Verde alternativo para indicadores de porcentaje (barras de progreso) → `green.600` aprox. */
export const EXITO_ALT = "#2f9e44"; // {colors.green.600}

/** Fondo de banners de éxito → `green.muted`. */
export const EXITO_FONDO = "#d4edda"; // {colors.green.100}

/** Fondo de avisos de éxito inline → `green.subtle`. */
export const EXITO_FONDO_CLARO = "#f0fff4"; // {colors.green.50}

/** Texto de banners y avisos de éxito → `green.fg`. */
export const EXITO_TEXTO = "#276749"; // {colors.green.700}

/** Estado `hover` de `EXITO_TEXTO` → `green.emphasized`. */
export const EXITO_TEXTO_HOVER = "#155724"; // {colors.green.800}

/* ── Semánticos: error → {colors.red.*} ────────────────────────── */

/** Fondo del banner de error de los formularios → `red.muted`. */
export const ERROR_FONDO = "#f8d7da"; // {colors.red.100}

/** Borde del banner de error de los formularios → `red.muted` +1 escalón. */
export const ERROR_BORDE = "#f5c6cb"; // {colors.red.200}

/** Texto del banner de error de los formularios → `red.fg`. */
export const ERROR_TEXTO = "#721c24"; // {colors.red.800}

/* ── Neutros: superficies → {colors.gray.*} / white ────────────── */

/** Blanco de tarjetas, diálogos e inputs → `white` de Chakra. */
export const BLANCO = "#ffffff"; // {colors.white}

/** Fondo muy claro de tarjetas y filas alternadas → `gray.50`. */
export const FONDO_CARD = "#f7faf9"; // {colors.gray.50}

/** Fondo gris neutro de bloques informativos → `gray.50`. */
export const FONDO_NEUTRO = "#f9f9f9"; // {colors.gray.50}

/** Fondo de la aplicación (layout general) → `gray.50` con matiz verde. */
export const FONDO_APP = "#f4f7f6"; // {colors.gray.50}

/** Fondo con matiz teal, para bloques relacionados a la marca → `brand.100`. */
export const FONDO_TEAL = "#EAF3F2"; // {colors.brand.100}

/* ── Neutros: bordes y botones → {colors.gray.*} ───────────────── */

/** Gris medio: botones secundarios ("Volver a la lista") y texto apagado → `gray.solid`. */
export const GRIS_MEDIO = "#6c757d"; // {colors.gray.500}

/** Gris claro: fondo de botones "Cancelar" → `gray.muted`. */
export const GRIS_CLARO = "#e0e0e0"; // {colors.gray.200}

/** Gris de borde de controles secundarios y separadores → `gray.300`. */
export const BORDE_CONTROL = "#ccc"; // {colors.gray.300}

/** Borde suave de tarjetas y separadores de tablas → `gray.200`. */
export const BORDE_SUAVE = "#e2e8f0"; // {colors.gray.200}

/* ── Neutros: texto → {colors.gray.*} ──────────────────────────── */

/** Texto principal → `gray.800`. */
export const TEXTO_PRIMARIO = "#333"; // {colors.gray.800}

/** Texto secundario: labels de formulario → `gray.600`. */
export const TEXTO_SECUNDARIO = "#555"; // {colors.gray.600}

/** Texto terciario: textos de apoyo dentro de diálogos → `gray.600`. */
export const TEXTO_TERCIARIO = "#666"; // {colors.gray.600}

/** Texto atenuado: placeholders y metadatos → `gray.400`. */
export const TEXTO_TENUE = "#888"; // {colors.gray.400}

/** Texto de cuerpo de tablas y listas → `gray.700`. */
export const TEXTO_SUAVE = "#4a5568"; // {colors.gray.700}

/** Texto de máxima jerarquía (títulos de sección) → `gray.900`. */
export const TEXTO_FUERTE = "#1a202c"; // {colors.gray.900}

/* ── Estilos compartidos de formulario ────────────────────────── */

/**
 * Input de formulario de ancho acotado a 500px.
 * Es el estilo por defecto de los formularios de alta/edición; los
 * formularios que necesitan otra medida lo ajustan con un spread.
 * En la migración estos objetos pasan a ser props de los snippets
 * (`Input` de Chakra ya incluye borde/fondo, solo hay que pasar
 * `borderColor="brand.300"`), por lo que se irán eliminando.
 */
export const estiloInput: CSSProperties = {
  backgroundColor: BLANCO,
  padding: "12px",
  width: "100%",
  maxWidth: "500px",
  borderRadius: "8px",
  border: `2px solid ${TEAL_CLARO}`,
  fontSize: "16px",
  outline: "none",
  color: TEXTO_PRIMARIO,
};

/**
 * Igual que `estiloInput` pero sin el tope de ancho: el input ocupa todo el
 * ancho disponible del contenedor. Se usa en formularios que ya viven dentro
 * de una columna acotada.
 */
export const estiloInputAncho: CSSProperties = {
  backgroundColor: BLANCO,
  padding: "12px",
  width: "100%",
  borderRadius: "8px",
  border: `2px solid ${TEAL_CLARO}`,
  fontSize: "16px",
  outline: "none",
  color: TEXTO_PRIMARIO,
};

/**
 * Versión compacta de `estiloInput` (padding y tipografía más chicos).
 * Es la variante de los filtros y selects de las páginas de listado.
 */
export const estiloInputCompacto: CSSProperties = {
  backgroundColor: BLANCO,
  padding: "10px 14px",
  borderRadius: "8px",
  border: `2px solid ${TEAL_CLARO}`,
  fontSize: "15px",
  color: TEXTO_PRIMARIO,
};

/** Label de formulario. */
export const estiloLabel: CSSProperties = {
  display: "block",
  fontSize: "14px",
  fontWeight: "bold",
  marginBottom: "8px",
  color: TEXTO_SECUNDARIO,
};