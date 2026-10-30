import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarSectores } from "../services/sectorService";
import type { Sector } from "../types/sector";

export function useSectores(incluirInactivos = false) {
  const cargarSectores = useCallback(() => listarSectores(incluirInactivos), [incluirInactivos]);

  const { items, loading, error, recargar } = useLista<Sector[]>({
    cargar: cargarSectores,
    dependencias: [incluirInactivos],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los sectores",
  });

  return { sectores: items, loading, error, cargarSectores: recargar };
}