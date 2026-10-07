import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Carga de un listado genérica: el `useEffect` + `useState` + `try/catch` que
 * estaba copiado en los 13 hooks de listado (insumos, equipos, personales,
 * aptitudes, incidentes, notificaciones, ...).
 *
 * Se mantiene el `setTimeout(..., 0)` de siempre: sin él, el estado se setea
 * de forma síncrona dentro del efecto, y con `React.StrictMode` (activo en
 * `main.tsx`) el montaje de desarrollo dispara el efecto dos veces seguidas y
 * el primero queda escribiendo estado sobre un componente ya desmontado.
 *
 * `cargar` tiene que venir memoizada con `useCallback` en el hook que llama a
 * este, como se hacía antes: si su identidad cambia en cada render, el efecto
 * de abajo se vuelve a disparar en loop.
 */
export interface OpcionesLista<T> {
  /** Pide los datos al backend. Si rechaza, se muestra el error. */
  cargar: () => Promise<T>;
  /** Lo que hay que mirar para volver a pedir los datos (filtros, fechas, ...). */
  dependencias: readonly unknown[];
  /** Con qué se arma `items` mientras llega la primera respuesta. */
  valorInicial: T;
  /** Qué se le muestra al usuario si el listado falla. */
  mensajeError: string;
  /** Para los hooks cuyo fetcher ya sabe explicarse (validación previa) o que ya
   *  venían mostrando el mensaje del backend: en vez del texto de arriba se usa
   *  el mensaje del error. */
  preferirMensajeDelBackend?: boolean;
  /** Vuelve a `valorInicial` cuando la carga falla. Por defecto `items`
   *  conserva lo último que se cargó, para que un refresh fallido no tire la
   *  tabla; lo necesita el historial de checklists, donde el error significa
   *  "este rango no sirve" y lo que queda en pantalla es de otro período. */
  vaciarAlFallar?: boolean;
}

/** Estado del listado. */
export interface Lista<T> {
  items: T;
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
}

export function useLista<T>(opciones: OpcionesLista<T>): Lista<T> {
  const {
    cargar,
    dependencias,
    valorInicial,
    mensajeError,
    preferirMensajeDelBackend,
    vaciarAlFallar,
  } = opciones;

  const [items, setItems] = useState<T>(valorInicial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `valorInicial` se captura una sola vez: si fuera una dependencia de
  // `recargar`, el `[]` que pasan los hooks de listado sería un array nuevo en
  // cada render y el efecto se re-dispararía en loop pidiendo la lista entera
  // una y otra vez.
  const valorInicialRef = useRef(valorInicial);

  const recargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      setItems(await cargar());
    } catch (err) {
      // A diferencia de `useABM`, acá no se pisa el mensaje del backend: cada
      // listado tiene su propio texto y así se sigue mostrando el de siempre.
      if (preferirMensajeDelBackend && err instanceof Error) {
        setError(err.message);
      } else {
        setError(mensajeError);
      }

      if (vaciarAlFallar) setItems(valorInicialRef.current);
    } finally {
      setLoading(false);
    }
  }, [cargar, mensajeError, preferirMensajeDelBackend, vaciarAlFallar]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void recargar();
    }, 0);

    return () => window.clearTimeout(timeoutId);
    // `dependencias` es el filtro / las fechas / ... que declara el hook que
    // llama a useLista, no una constante, así que eslint no lo puede verificar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recargar, ...dependencias]);

  return { items, loading, error, recargar };
}