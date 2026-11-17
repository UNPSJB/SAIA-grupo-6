import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { obtenerInicio } from "../services/panelService";
import type { PanelInicio } from "../types/paneles";

const SIN_DATOS: PanelInicio = { areas: [], atencion: [], atencion_total: 0 };

/**
 * Estado de hoy de cada área y lo que requiere atención. Un solo pedido: el
 * backend arma todo con los mismos cálculos de los paneles de cada área.
 * Con `habilitado` en false (sin permisos para el panel) no se pide nada.
 */
export function useInicio(habilitado: boolean) {
  const cargar = useCallback(
    () => (habilitado ? obtenerInicio() : Promise.resolve(SIN_DATOS)),
    [habilitado],
  );

  const { items, loading, error, recargar } = useLista<PanelInicio>({
    cargar,
    dependencias: [habilitado],
    valorInicial: SIN_DATOS,
    mensajeError: "No se pudo cargar el estado de las áreas",
    preferirMensajeDelBackend: true,
  });

  return { inicio: items, loading, error, recargar };
}
