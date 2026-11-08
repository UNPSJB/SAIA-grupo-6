/**
 * Formato de números de toda la app: es-AR (coma decimal, punto de miles).
 *
 * El backend manda las cantidades como string decimal con punto ("316.999").
 * Antes varias pantallas lo pintaban tal cual, así que en Gestión de stock se
 * leía "316.999 Kg" (¿trescientos dieciséis mil?) mientras Stock de insumos
 * mostraba "186,218 L". Todo número que se muestra pasa por acá; nunca
 * `String(valor)`, `toFixed` ni `toLocaleString()` sin locale.
 */

const LOCALE = "es-AR";

function aNumero(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Cantidad en formato es-AR, sin ceros de sobra y con hasta 3 decimales.
 * `vacio` es lo que se muestra cuando no hay valor ("-" por defecto).
 */
export function formatoCantidad(
  valor: string | number | null | undefined,
  vacio = "-",
): string {
  const numero = aNumero(valor);
  if (numero === null) return vacio;
  return numero.toLocaleString(LOCALE, { maximumFractionDigits: 3 });
}

/** Cantidad con su unidad: "20 kg". */
export function cantidadConUnidad(
  valor: string | number | null | undefined,
  unidad?: string | null,
): string {
  const cantidad = formatoCantidad(valor);
  return unidad ? `${cantidad} ${unidad}` : cantidad;
}

/** Variación de stock: "+12,5" / "-3". El cero va sin signo. */
export function formatoConSigno(valor: string | number | null | undefined): string {
  const numero = aNumero(valor);
  if (numero === null) return "-";
  const texto = formatoCantidad(numero);
  return numero > 0 ? `+${texto}` : texto;
}

/** Porcentaje entero: "27 %" se escribe "27%" en toda la app. */
export function formatoPorcentaje(valor: string | number | null | undefined): string {
  const numero = aNumero(valor);
  if (numero === null) return "-";
  return `${Math.round(numero).toLocaleString(LOCALE)}%`;
}

/** Factor de escala de receta: "×1,5". */
export function formatoFactor(valor: string | number | null | undefined): string {
  const numero = aNumero(valor);
  return numero === null ? "-" : `×${formatoCantidad(numero)}`;
}
