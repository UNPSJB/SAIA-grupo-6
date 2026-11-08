/**
 * El backend manda las cantidades como string decimal ("20.000"). Se muestran
 * en formato es-AR, sin ceros de sobra y con hasta 3 decimales.
 */
export function formatoCantidad(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "-";
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "-";
  return numero.toLocaleString("es-AR", { maximumFractionDigits: 3 });
}

/** Cantidad con su unidad: "20 kg". */
export function cantidadConUnidad(
  valor: string | number | null | undefined,
  unidad?: string | null,
): string {
  const cantidad = formatoCantidad(valor);
  return unidad ? `${cantidad} ${unidad}` : cantidad;
}
