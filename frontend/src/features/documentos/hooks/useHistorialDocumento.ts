import { useState, useEffect } from "react";
import { useAuth } from "../../../common/context/useAuth";
import { obtenerHistorial } from "../services/documentoService";
import type { HistorialDocumento } from "../types/documento";

export function useHistorialDocumento(documentoId: number) {
  const { user } = useAuth();
  const usuarioId = user?.id;

  const [historial, setHistorial] = useState<HistorialDocumento | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (usuarioId === undefined) return;

    const cargar = async () => {
      try {
        setLoading(true);
        setError(null);
        setHistorial(await obtenerHistorial(documentoId, usuarioId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar el historial");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [documentoId, usuarioId]);

  return { historial, loading, error };
}