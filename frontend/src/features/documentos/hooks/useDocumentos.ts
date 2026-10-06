import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarDocumentos } from "../services/documentoService";
import type { Documento } from "../types/documento";

export function useDocumentos() {
  const cargarDocumentos = useCallback(() => listarDocumentos(), []);

  const { items, loading, error, recargar } = useLista<Documento[]>({
    cargar: cargarDocumentos,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los documentos",
    preferirMensajeDelBackend: true,
  });

  return { documentos: items, loading, error, cargarDocumentos: recargar };
}
