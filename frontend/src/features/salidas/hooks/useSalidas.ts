import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarSalidas } from "../services/salidaService";
import type { EstadoSalida, Salida } from "../types/salida";

export function useSalidas({
  estado,
  lote_id,
  cliente_id,
}: {
  estado?: EstadoSalida | "";
  lote_id?: number;
  cliente_id?: number;
}) {
  const cargar = useCallback(
    () => listarSalidas({ estado, lote_id, cliente_id }),
    [estado, lote_id, cliente_id]
  );

  const { items, loading, error, recargar } = useLista<Salida[]>({
    cargar,
    dependencias: [estado, lote_id, cliente_id],
    valorInicial: [],
    mensajeError: "No se pudieron cargar las salidas",
  });

  return { salidas: items, loading, error, recargarSalidas: recargar };
}
