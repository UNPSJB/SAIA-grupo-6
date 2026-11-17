import { useCallback, useRef } from "react";
import { useLista } from "../../../common/hooks/useLista";
import type { BloquePanel } from "./useDashboard";

/**
 * Un pedido de un panel de categoría, con su carga y su error propios: si una
 * fuente falla, el resto del panel se sigue viendo.
 *
 * `cargar` tiene que ser estable (una función de módulo o memoizada).
 * Con `habilitado = false` no se pide nada y queda `valorInicial`: sirve para
 * los bloques que solo ve quien administra.
 */
export function useBloque<T>(
  cargar: () => Promise<T>,
  valorInicial: T,
  mensajeError: string,
  habilitado = true,
): BloquePanel<T> {
  const inicial = useRef(valorInicial);
  const efectiva = useCallback(
    () => (habilitado ? cargar() : Promise.resolve(inicial.current)),
    [cargar, habilitado],
  );

  const { items, loading, error } = useLista<T>({
    cargar: efectiva,
    dependencias: [],
    valorInicial,
    mensajeError,
  });

  return { datos: items, loading, error };
}
