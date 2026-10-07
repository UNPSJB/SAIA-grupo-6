import { useState, useEffect } from "react";
import { obtenerDocumento } from "../services/documentoService";
import type { Documento } from "../types/documento";

export function useDocumento(id: number) {
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        setError(null);
        setDocumento(await obtenerDocumento(id));
      } catch (err) {
        setError("No se pudo cargar el documento");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [id]);

  return { documento, loading, error };
}