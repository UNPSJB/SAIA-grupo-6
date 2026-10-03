import { useEffect, useState } from "react";
import { obtenerAptitud } from "../services/aptitudService";
import type { Aptitud } from "../types/aptitud";

export function useAptitud(id: number | null) {
  const [aptitud, setAptitud] = useState<Aptitud | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === null || isNaN(id)) return;

    const cargarAptitud = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await obtenerAptitud(id);
        setAptitud(data);
      } catch (err) {
        setError("No se pudo cargar la aptitud");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    cargarAptitud();
  }, [id]);

  return { aptitud, loading, error };
}