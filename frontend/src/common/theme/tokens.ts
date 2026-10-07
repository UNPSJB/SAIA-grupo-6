import type { CSSProperties } from "react";

/**
 * Tokens de color y de estilo compartidos por toda la aplicación.
 *
 * Antes de que existiera este archivo, cada feature repetía sus propios
 * `const TEAL = "#468189"` (34 veces) y sus propios objetos `estiloInput` /
 * `estiloLabel`, con ligeras variaciones que se colaban sin que nadie las
 * notara. Acá vive la fuente de verdad: si un color cambia, cambia una vez.
 *
 * Estos valores son CSS plano a propósito (no tokens semánticos de Chakra)
 * porque el proyecto los consume tanto desde props `bg`/`color` como desde
 * objetos `style`; una única forma funciona en los dos mundos.
 */

/* ── Paleta de marca ──────────────────────────────────────────────── */

/** Teal de marca. Botones primarios ("Agregar"), acentos y enlaces. */
export const TEAL = "#468189";

/** Variante clara del teal de marca: bordes de inputs y separadores. */
export const TEAL_CLARO = "#90BEBB";

/** Teal de marca oscurecido, usado como estado `hover`. */
export const TEAL_OSCURO = "#37666d";

/* ── Semánticos: peligro ──────────────────────────────────────────── */

/** Rojo de acciones destructivas: botones "Eliminar"/"Dar de baja". */
export const PELIGRO = "#d9534f";

/** Estado `hover` de `PELIGRO`. */
export const PELIGRO_HOVER = "#c9302c";

/** Rojo para texto de error (validaciones inline, avisos). */
export const PELIGRO_TEXTO = "#c92a2a";

/* ── Semánticos: advertencia ──────────────────────────────────────── */

/** Ámbar del botón "Modificar". */
export const ADVERTENCIA = "#f0ad4e";

/**
 * Estado `hover` del botón "Modificar".
 *
 * Estandarizado en `#ec971f` (la variante más oscura de `ADVERTENCIA`).
 * Antes el hover estaba partido: cinco archivos usaban `#ec971f` y otros
 * seis repetían `#f0ad4e`, con lo cual el botón no daba ninguna señal
 * visual al pasar el cursor. Se elige el tono más oscuro porque un `hover`
 * que no se distingue del estado base es indistinguible.
 */
export const ADVERTENCIA_HOVER = "#ec971f";

/* ── Semánticos: éxito ─────────────────────────────────────────────── */

/** Verde de acciones positivas: "Reactivar", "Guardar". */
export const EXITO = "#28a745";

/** Estado `hover` de `EXITO`. */
export const EXITO_HOVER = "#218838";

/** Verde alternativo para indicadores de porcentaje (barras de progreso). */
export const EXITO_ALT = "#2f9e44";

/** Fondo de banners de éxito. */
export const EXITO_FONDO = "#d4edda";

/** Fondo de avisos de éxito inline. */
export const EXITO_FONDO_CLARO = "#f0fff4";

/** Texto de banners y avisos de éxito. */
export const EXITO_TEXTO = "#276749";

/** Estado `hover` de `EXITO_TEXTO`. */
export const EXITO_TEXTO_HOVER = "#155724";

/* ── Semánticos: error ────────────────────────────────────────────── */

/** Fondo del banner de error de los formularios. */
export const ERROR_FONDO = "#f8d7da";

/** Borde del banner de error de los formularios. */
export const ERROR_BORDE = "#f5c6cb";

/** Texto del banner de error de los formularios. */
export const ERROR_TEXTO = "#721c24";

/* ── Neutros: superficies ─────────────────────────────────────────── */

/** Blanco de tarjetas, diálogos e inputs. */
export const BLANCO = "#ffffff";

/** Fondo muy claro de tarjetas y filas alternadas. */
export const FONDO_CARD = "#f7faf9";

/** Fondo gris neutro de bloques informativos. */
export const FONDO_NEUTRO = "#f9f9f9";

/** Fondo de la aplicación (layout general). */
export const FONDO_APP = "#f4f7f6";

/** Fondo con matiz teal, para bloques relacionados a la marca. */
export const FONDO_TEAL = "#EAF3F2";

/* ── Neutros: bordes y botones ────────────────────────────────────── */

/** Gris medio: botones secundarios ("Volver a la lista") y texto apagado. */
export const GRIS_MEDIO = "#6c757d";

/** Gris claro: fondo de botones "Cancelar". */
export const GRIS_CLARO = "#e0e0e0";

/** Gris de borde de controles secundarios y separadores. */
export const BORDE_CONTROL = "#ccc";

/** Borde suave de tarjetas y separadores de tablas. */
export const BORDE_SUAVE = "#e2e8f0";

/* ── Neutros: texto ───────────────────────────────────────────────── */

/** Texto principal. */
export const TEXTO_PRIMARIO = "#333";

/** Texto secundario: labels de formulario. */
export const TEXTO_SECUNDARIO = "#555";

/** Texto terciario: textos de apoyo dentro de diálogos. */
export const TEXTO_TERCIARIO = "#666";

/** Texto atenuado: placeholders y metadatos. */
export const TEXTO_TENUE = "#888";

/** Texto de cuerpo de tablas y listas. */
export const TEXTO_SUAVE = "#4a5568";

/** Texto de máxima jerarquía (títulos de sección). */
export const TEXTO_FUERTE = "#1a202c";

/* ── Estilos compartidos de formulario ────────────────────────────── */

/**
 * Input de formulario de ancho acotado a 500px.
 * Es el estilo por defecto de los formularios de alta/edición; los
 * formularios que necesitan otra medida lo ajustan con un spread.
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