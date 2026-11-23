import { useCallback, useEffect, useRef } from "react";
import { useEstadoNavegacion } from "./useEstadoNavegacion";

export type DireccionOrden = "asc" | "desc";

export type ClaveOrden<C extends string> = `${C}_asc` | `${C}_desc`;

export interface OrdenTabla<
  C extends string,
  D extends string = ClaveOrden<C>,
> {
  columna: C | null;
  direccion: DireccionOrden;
  orden: ClaveOrden<C> | D;
  esPorDefecto: boolean;
  ordenar: (columna: C) => void;
  reiniciar: () => void;
}

/**
 * Orden por columna para listados del servidor.
 * `columnaPorDefecto` marca el header activo al abrir (p. ej. próximo vencimiento).
 * `alCambiar` suele ser `() => setPage(1)` cuando la página maneja el page a mano.
 */
export function useOrdenTabla<
  C extends string,
  D extends string = ClaveOrden<C>,
>(
  porDefecto: D,
  columnaPorDefecto?: C,
  alCambiar?: () => void,
): OrdenTabla<C, D> {
  const direccionPorDefecto: DireccionOrden = porDefecto.endsWith("_desc")
    ? "desc"
    : "asc";

  const alCambiarRef = useRef(alCambiar);
  useEffect(() => {
    alCambiarRef.current = alCambiar;
  }, [alCambiar]);

  // El orden sobrevive a ir y volver con "atrás" (ver useEstadoNavegacion).
  const [estado, setEstado] = useEstadoNavegacion<{
    columna: C | null;
    direccion: DireccionOrden;
  }>("useOrdenTabla.orden", () => ({
    columna: columnaPorDefecto ?? null,
    direccion: direccionPorDefecto,
  }));

  const ordenar = useCallback((nueva: C) => {
    setEstado((actual) =>
      actual.columna === nueva
        ? {
            columna: nueva,
            direccion: actual.direccion === "asc" ? "desc" : "asc",
          }
        : { columna: nueva, direccion: "asc" },
    );
    alCambiarRef.current?.();
  }, [setEstado]);

  const reiniciar = useCallback(() => {
    setEstado({
      columna: columnaPorDefecto ?? null,
      direccion: direccionPorDefecto,
    });
    alCambiarRef.current?.();
  }, [columnaPorDefecto, direccionPorDefecto, setEstado]);

  return {
    columna: estado.columna,
    direccion: estado.direccion,
    orden: estado.columna
      ? (`${estado.columna}_${estado.direccion}` as ClaveOrden<C>)
      : porDefecto,
    esPorDefecto:
      estado.columna === (columnaPorDefecto ?? null) &&
      estado.direccion === direccionPorDefecto,
    ordenar,
    reiniciar,
  };
}
