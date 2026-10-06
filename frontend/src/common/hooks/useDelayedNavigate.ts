import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type TimeoutId = ReturnType<typeof setTimeout>;

/**
 * Ejecuta un callback despues de un delay y lo cancela si el componente se
 * desmonta antes.
 *
 * Antes guardaba UN solo id en un ref: una segunda llamada sobreescribia la
 * primera y el timer anterior quedaba huerfano, con su `setState`/`navigate`
 * ejecutandose sobre un componente ya desmontado. Eso es justo lo que pasaba en
 * `PersonalCreatePage`, que programaba la navegacion dos veces. Ahora se trackea
 * un Set y se limpian todos al desmontar.
 *
 * La funcion devuelta es estable (`useCallback`) para poder usarse dentro de
 * arrays de dependencias sin re-crear efectos.
 */
export function useSafeTimeout() {
  const timeoutsRef = useRef<Set<TimeoutId> | null>(null);
  if (timeoutsRef.current === null) {
    timeoutsRef.current = new Set<TimeoutId>();
  }

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts?.forEach((id) => clearTimeout(id));
      timeouts?.clear();
    };
  }, []);

  return useCallback((callback: () => void, delayMs: number) => {
    const timeouts = timeoutsRef.current;
    const id = setTimeout(() => {
      timeouts?.delete(id);
      callback();
    }, delayMs);
    timeouts?.add(id);
  }, []);
}

/**
 * Navega a una ruta despues de un delay, cancelando la navegacion pendiente si
 * el componente se desmonta antes de que se cumpla el tiempo.
 */
export function useDelayedNavigate() {
  const navigate = useNavigate();
  const delayed = useSafeTimeout();

  return useCallback(
    (path: string, delayMs = 2000) => {
      delayed(() => navigate(path), delayMs);
    },
    [delayed, navigate],
  );
}

/**
 * Estado que se limpia solo pasado un tiempo.
 *
 * Reemplaza los `setTimeout(() => setMensaje(null), 3500)` escritos a mano en
 * `IncidentesListPage` y `ReportarIncidentePage`, que se apilaban con cada
 * click y lanzaban un `setState` sobre un componente ya desmontado.
 */
export function useAvisoTemporal<T>(duracionMs = 3500) {
  const [valor, setValor] = useState<T | null>(null);
  const programar = useSafeTimeout();

  const avisar = useCallback(
    (nuevo: T) => {
      setValor(nuevo);
      programar(() => setValor(null), duracionMs);
    },
    [programar, duracionMs],
  );

  const limpiar = useCallback(() => setValor(null), []);

  return useMemo(() => ({ valor, avisar, limpiar }), [valor, avisar, limpiar]);
}