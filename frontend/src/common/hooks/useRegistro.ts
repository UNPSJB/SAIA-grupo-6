import { useCallback, useEffect, useState } from "react";

/**
 * Carga de un registro único por id, genérica.
 *
 * Reemplaza el `useEffect` + `useState` + `try/catch` que estaba repetido en los
 * nueve hooks de detalle (`useInsumo`, `useEquipo`, `usePersonal`, ...).
 *
 * A diferencia de los hooks de listado, estos hooks NO tienen guarda de
 * cancelación: si el usuario abre el registro A y enseguida el B, la respuesta
 * más lenta (la de A) podía llegar última y dejar la página mostrando el
 * registro equivocado. El flag `vigente` es el mismo patrón que ya usaban
 * `useIncidente` y `useImagenAutenticada`.
 *
 * `cargar` tiene que ser la función del service importada (o sea, de identidad
 * estable entre renders): si cambia en cada render, el efecto de abajo se
 * vuelve a disparar en loop.
 */
export interface OpcionesRegistro<T> {
  /** GET del registro por id. */
  cargar: (id: number) => Promise<T>;
  /** Id a cargar, o `null`/`undefined` si todavía no hay uno válido. */
  id: number | null | undefined;
  /** Cómo se llama la entidad en el mensaje de error, con artículo: "el insumo". */
  etiqueta: string;
}

/** Estado del registro. `registro` mantiene el valor anterior mientras se recarga. */
export interface Registro<T> {
  registro: T | null;
  loading: boolean;
  error: string | null;
  /** Vuelve a pedir el registro (el que se llama después de cerrarlo, etc.). */
  recargar: () => Promise<void>;
}

export function useRegistro<T>(opciones: OpcionesRegistro<T>): Registro<T> {
  const { cargar, id, etiqueta } = opciones;

  const [registro, setRegistro] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pedir = useCallback(
    async (vigente: () => boolean) => {
      // El `Number.isNaN` no es un detalle: `Number(id)` de una URL como
      // "/personal/abc" da NaN, y sin esta guarda se disparaba un GET /personal/NaN.
      if (id == null || Number.isNaN(id)) return;

      try {
        setLoading(true);
        setError(null);

        const datos = await cargar(id);

        if (!vigente()) return;
        setRegistro(datos);
      } catch (err) {
        if (!vigente()) return;
        // Mismo criterio que `useABM`: el mensaje del servidor explica mejor el
        // fallo que un texto genérico ("No se pudo cargar el equipo").
        setError(err instanceof Error ? err.message : `No se pudo cargar ${etiqueta}`);
        console.error(err);
      } finally {
        if (vigente()) setLoading(false);
      }
    },
    [cargar, id, etiqueta],
  );

  useEffect(() => {
    let vigente = true;

    // Mismo `setTimeout(..., 0)` que usa `useLista`: setear estado de forma
    // síncrona dentro del efecto provoca un render en cascada, y con
    // `React.StrictMode` el montaje de desarrollo además dispararía el pedido
    // dos veces (la primera sin poder cancelarse).
    const timeoutId = window.setTimeout(() => {
      void pedir(() => vigente);
    }, 0);

    return () => {
      vigente = false;
      window.clearTimeout(timeoutId);
    };
  }, [pedir]);

  const recargar = useCallback(async () => {
    // Una recarga manual la dispara el usuario desde un click: no compite con
    // otro pedido por el mismo registro, así que siempre "sigue vigente".
    await pedir(() => true);
  }, [pedir]);

  return { registro, loading, error, recargar };
}