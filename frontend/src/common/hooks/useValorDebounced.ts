import { useEffect, useState } from "react";

/**
 * Copia con demora de un valor que cambia mientras se escribe.
 *
 * El buscador actualiza el valor con cada tecla; el fetch quiere la versión
 * "terminada". Con este hook, la recarga espera a que el usuario deje de
 * escribir (300 ms por defecto) en vez de disparar un pedido por tecla. El
 * patrón venía inline en `useDocumentosVigentes`; acá queda reutilizable
 * para todos los buscadores.
 *
 * ```
 * const [busqueda, setBusqueda] = useState("");
 * const busquedaAplicada = useValorDebounced(busqueda);
 * // el input actualiza `busqueda`; el efecto de carga depende de `busquedaAplicada`
 * ```
 */
export function useValorDebounced<T>(valor: T, demoraMs = 300): T {
  const [valorDebounced, setValorDebounced] = useState(valor);

  useEffect(() => {
    // La primera pasada no arma timer: `valor` ya es el estado inicial, y
    // demorar el primer fetch solo suma latencia a la carga de la página.
    // Tampoco lo arma si el usuario borró y volvió al valor ya aplicado:
    // la tabla ya muestra exactamente esos resultados.
    if (valor === valorDebounced) return;

    const timer = window.setTimeout(() => setValorDebounced(valor), demoraMs);
    return () => window.clearTimeout(timer);
  }, [valor, demoraMs, valorDebounced]);

  return valorDebounced;
}
