import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarCertificaciones } from "../services/certificacionService";
import type { CertificacionTransportista } from "../types/certificacion";

export function useCertificaciones(
  transportistaId: number,
  incluirHistorial = false,
) {
  const cargarCertificaciones = useCallback(
    () => listarCertificaciones(transportistaId, incluirHistorial),
    [transportistaId, incluirHistorial]
  );

  const { items, loading, error, recargar } = useLista<CertificacionTransportista[]>({
    cargar: cargarCertificaciones,
    dependencias: [transportistaId, incluirHistorial],
    valorInicial: [],
    mensajeError: "No se pudieron cargar las certificaciones",
  });

  return {
    certificaciones: items,
    loading,
    error,
    cargarCertificaciones: recargar,
  };
}
