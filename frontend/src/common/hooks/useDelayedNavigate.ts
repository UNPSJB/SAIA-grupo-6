import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Ejecuta un callback después de un delay, cancelándolo si el componente
 * se desmonta antes de que se cumpla el tiempo.
 */
export function useSafeTimeout() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (callback: () => void, delayMs: number) => {
    timeoutRef.current = setTimeout(callback, delayMs);
  };
}

/**
 * Navega a una ruta después de un delay, cancelando la navegación
 * pendiente si el componente se desmonta antes de que se cumpla el tiempo.
 */
export function useDelayedNavigate() {
  const navigate = useNavigate();
  const delayed = useSafeTimeout();

  return (path: string, delayMs = 2000) => {
    delayed(() => navigate(path), delayMs);
  };
}
