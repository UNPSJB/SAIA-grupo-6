import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarUnidadesMedida } from "../services/unidadMedidaService";
import type { UnidadMedida } from "../types/unidadMedida";

export function useUnidadesMedida(incluirInactivos = false) {
  const cargarUnidades = useCallback(() => listarUnidadesMedida(incluirInactivos), [incluirInactivos]);

  const { items, loading, error, recargar } = useLista<UnidadMedida[]>({
    cargar: cargarUnidades,
    dependencias: [incluirInactivos],
    valorInicial: [],
    mensajeError: "No se pudieron cargar las unidades de medida",
  });

  return { unidades: items, loading, error, cargarUnidades: recargar };
}