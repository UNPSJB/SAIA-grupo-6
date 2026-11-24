interface TablaGuardada {
  version_id?: number | null;
  estado?: string | null;
  problemas?: string[] | null;
  filas?: { nombre?: string; faltan_datos?: boolean }[] | null;
}

/**
 * Estado de la tabla nutricional guardada en el rótulo. Mismo criterio que el
 * backend (`_nutricion_previsualizacion`): no alcanza con que exista, tiene
 * que ser de la versión de receta del borrador y no faltarle datos.
 */
export function evaluarNutricion(
  json: string | null | undefined,
  versionId: number | null,
): { estado: "completo" | "pendiente" | "sin_datos_origen"; motivo?: string } {
  if (!json?.trim()) return { estado: "sin_datos_origen" };
  let tabla: TablaGuardada | null;
  try {
    tabla = JSON.parse(json) as TablaGuardada | null;
  } catch {
    tabla = null;
  }
  if (tabla === null || typeof tabla !== "object") {
    return { estado: "pendiente", motivo: "La tabla guardada no se pudo leer." };
  }
  if (versionId === null) return { estado: "pendiente", motivo: "No hay una versión de receta verificable." };
  if (tabla.version_id == null) {
    return { estado: "pendiente", motivo: "La tabla guardada no registra su versión de receta." };
  }
  if (tabla.version_id !== versionId) {
    return { estado: "pendiente", motivo: "La tabla guardada es de otra versión de receta: recalculala." };
  }
  const problemas = tabla.problemas ?? [];
  const filas = tabla.filas ?? [];
  const faltan = filas.filter((fila) => fila.faltan_datos);
  if (tabla.estado === "completa" && filas.length > 0 && problemas.length === 0 && faltan.length === 0) {
    return { estado: "completo" };
  }
  const motivo = problemas.length > 0
    ? problemas.join(" ")
    : faltan.length > 0 && faltan.length < filas.length
      ? `Faltan datos de: ${faltan.map((fila) => fila.nombre).join(", ")}.`
      : "Tabla nutricional incompleta.";
  return { estado: "pendiente", motivo };
}
