import { useState, useEffect } from "react";
import { obtenerDocumento } from "../services/documentoService";
import type { Documento } from "../types/documento";

export function useDocumento(id: number) {
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guarda de desmontaje: si el componente se baja mientras la petición
    // sigue en vuelo, el `setDocumento` de después landingía en un
    // componente inexistente. Antes saltaba el warning de React y, en
    // React 19, además puede pisar el estado si el id cambió rápido.
    let cancelado = false;

    const cargar = async () => {
      try {
        setLoading(true);
        setError(null);
        const resultado = await obtenerDocumento(id);
        if (!cancelado) setDocumento(resultado);
      } catch (err) {
        if (!cancelado) setError("No se pudo cargar el documento");
        if (!cancelado) console.error(err);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    cargar();

    return () => {
      cancelado = true;
    };
  }, [id]);

  return { documento, loading, error };
}