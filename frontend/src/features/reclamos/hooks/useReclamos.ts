import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarReclamos } from "../services/reclamoService";
import type { ReclamoResumen } from "../types/reclamo";

/**
 * Listado de reclamos de clientes, del más reciente al más viejo.
 *
 * Los filtros viajan al backend; la página igual filtra por texto en memoria,
 * igual que el resto de los listados.
 */
export function useReclamos({
  cliente_id,
  lote_id,
  fuera_de_plazo,
  estado,
  incidente_id,
}: {
  cliente_id?: number;
  lote_id?: number;
  fuera_de_plazo?: boolean;
  estado?: "abierto" | "cerrado";
  incidente_id?: number;
} = {}) {
  const cargar = useCallback(
    () =>
      listarReclamos({
        cliente_id,
        lote_id,
        fuera_de_plazo,
        estado,
        incidente_id,
      }),
    [cliente_id, lote_id, fuera_de_plazo, estado, incidente_id]
  );

  const { items, loading, error, recargar } = useLista<ReclamoResumen[]>({
    cargar,
    dependencias: [cliente_id, lote_id, fuera_de_plazo, estado, incidente_id],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los reclamos",
  });

  return { reclamos: items, loading, error, recargarReclamos: recargar };
}
