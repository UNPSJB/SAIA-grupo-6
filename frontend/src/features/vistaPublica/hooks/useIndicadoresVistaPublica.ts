import { useEffect, useState } from "react";

import {
  actualizarIndicadoresVistaPublica,
  obtenerIndicadoresVistaPublica,
} from "../services/vistaPublicaService";
import type { IndicadorVistaPublica } from "../types/vistaPublica";

export function useIndicadoresVistaPublica() {
  const [indicadores, setIndicadores] = useState<IndicadorVistaPublica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoClave, setGuardandoClave] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      try {
        setCargando(true);
        setError(null);
        const datos = await obtenerIndicadoresVistaPublica();
        if (!cancelado) setIndicadores(datos);
      } catch (e) {
        if (!cancelado) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron cargar los indicadores.",
          );
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    };

    // Diferir la carga evita una actualización de estado durante el efecto.
    const timeoutId = window.setTimeout(() => void cargar(), 0);
    return () => {
      cancelado = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  const cambiar = async (clave: string, habilitado: boolean) => {
    const anteriores = indicadores;
    const siguientes = indicadores.map((indicador) =>
      indicador.clave === clave ? { ...indicador, habilitado } : indicador,
    );

    // Optimista: el switch responde al instante y se revierte si el PUT falla.
    setIndicadores(siguientes);
    setGuardandoClave(clave);
    setError(null);
    setExito(null);

    try {
      const guardados = await actualizarIndicadoresVistaPublica(
        siguientes.map(({ clave: claveActual, habilitado: valor }) => ({
          clave: claveActual,
          habilitado: valor,
        })),
      );
      setIndicadores(guardados);

      const etiqueta =
        anteriores.find((indicador) => indicador.clave === clave)?.etiqueta ??
        "El indicador";
      setExito(
        `${etiqueta}: ${habilitado ? "ahora se muestra" : "ya no se muestra"} en la vista pública.`,
      );
    } catch (e) {
      setIndicadores(anteriores);
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo actualizar el indicador.",
      );
    } finally {
      setGuardandoClave(null);
    }
  };

  return { indicadores, cargando, guardandoClave, error, exito, cambiar };
}
