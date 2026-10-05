import { useState } from "react";
import { useAuth } from "../../../common/context/AuthContext";
import { crearDocumento, subirNuevaVersion } from "../services/documentoService";
import type { DocumentoFormValues } from "../types/documento";

export function useDocumentoABM() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ejecuta una acción manejando loading/error de forma uniforme.
  const ejecutar = async <T,>(accion: (autorId: number) => Promise<T>, msgPorDefecto: string) => {
    if (!user) {
      const mensaje = "No se pudo identificar al usuario logueado.";
      setError(mensaje);
      throw new Error(mensaje);
    }
    try {
      setLoading(true);
      setError(null);
      return await accion(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : msgPorDefecto);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const alta = (values: DocumentoFormValues) =>
    ejecutar(
      (autorId) =>
        crearDocumento({
          nombre: values.nombre,
          tipo: values.tipo,
          autor_id: autorId,
          archivo: values.archivo as File,
        }),
      "No se pudo subir el documento"
    );

  const subirVersion = (documentoId: number, values: DocumentoFormValues) =>
    ejecutar(
      (autorId) =>
        subirNuevaVersion(documentoId, { autor_id: autorId, archivo: values.archivo as File }),
      "No se pudo subir la nueva versión"
    );

  return { alta, subirVersion, loading, error };
}