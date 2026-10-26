import { useState, useEffect } from "react";
import { obtenerHistorial } from "../services/documentoService";
import type { HistorialDocumento } from "../types/documento";

export function useHistorialDocumento(documentoId: number) {
  const [historial, setHistorial] = useState<HistorialDocumento | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guarda de desmontaje, igual que en `useDocumento`: la navegación
    // rápida entre documentos dejaba el `setHistorial` volando.
    let cancelado = false;

    const cargar = async () => {
      try {
        setLoading(true);
        setError(null);
        const resultado = await obtenerHistorial(documentoId);
        if (!cancelado) setHistorial(resultado);
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el historial");
        }
        if (!cancelado) console.error(err);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    cargar();

    return () => {
      cancelado = true;
    };
  }, [documentoId]);

  return { historial, loading, error };
}
