import { useState, useEffect, useCallback } from "react";
import { listarDocumentos } from "../services/documentoService";
import type { Documento } from "../types/documento";

export function useDocumentos() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarDocumentos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setDocumentos(await listarDocumentos());
    } catch (err) {
      setError("No se pudieron cargar los documentos");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDocumentos();
  }, [cargarDocumentos]);

  return { documentos, loading, error, cargarDocumentos };
}