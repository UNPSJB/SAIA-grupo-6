import { cantidadConUnidad } from "../../../common/utils/numeros";
import type { VersionResumen } from "../types/receta";

/** "Frasco de 0,454 kg", "12 u" o null si la versión no tiene porción. */
export function textoPorcion(version: VersionResumen): string | null {
  if (!version.porcion_cantidad || !version.porcion_unidad_medida) {
    return version.porcion_descripcion || null;
  }
  const cantidad = cantidadConUnidad(version.porcion_cantidad, version.porcion_unidad_medida.simbolo);
  return version.porcion_descripcion ? `${version.porcion_descripcion} de ${cantidad}` : cantidad;
}
