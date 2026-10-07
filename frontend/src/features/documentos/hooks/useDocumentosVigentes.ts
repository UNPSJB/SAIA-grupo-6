import { useState, useEffect } from "react";
import { listarDocumentosVigentes } from "../services/documentoService";
import type { DocumentoVigente, TipoDocumento } from "../types/documento";

export function useDocumentosVigentes(buscar: string, tipo: TipoDocumento | "") {
  const [documentos, setDocumentos] = useState<DocumentoVigente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await listarDocumentosVigentes(buscar, tipo);
        if (!cancelado) setDocumentos(data);
      } catch (err) {
        if (!cancelado) {
          setError("No se pudieron cargar los documentos");
          console.error(err);
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [buscar, tipo]);

  return { documentos, loading, error };
}