import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/*
 * Qué ruta hay en cada posición del historial de esta pestaña, para que las
 * flechas de la app ("Volver a X", la de la barra) puedan volver de verdad
 * (`navigate(-1)`, que recupera los filtros: ver `useEstadoNavegacion`) en vez
 * de abrir la pantalla de cero.
 *
 * React Router guarda en `history.state.idx` la posición de cada entrada.
 */

const PREFIJO = "saia:historial:";

function posicionActual(): number | null {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === "number" ? idx : null;
}

/** Va una vez en el layout: anota la ruta de cada entrada que se visita. */
export function useRegistrarHistorial() {
  const { key, pathname } = useLocation();
  useEffect(() => {
    const idx = posicionActual();
    if (idx === null) return;
    try {
      sessionStorage.setItem(`${PREFIJO}${idx}`, pathname);
    } catch {
      // Sin storage: las flechas abren la pantalla de destino de cero.
    }
  }, [key, pathname]);
}

/** Hay una pantalla de la app antes de esta en el historial. */
export function hayPantallaAnterior(): boolean {
  return (posicionActual() ?? 0) > 0;
}

/** Ruta de la pantalla anterior en el historial, si se conoce. */
export function rutaAnterior(): string | null {
  const idx = posicionActual();
  if (!idx) return null;
  try {
    return sessionStorage.getItem(`${PREFIJO}${idx - 1}`);
  } catch {
    return null;
  }
}
