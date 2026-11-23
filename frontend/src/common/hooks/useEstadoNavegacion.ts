import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useLocation } from "react-router-dom";

/*
 * Estado de una pantalla que sobrevive a ir y volver con "atrás".
 *
 * Es un `useState` cuyo valor queda guardado en `sessionStorage` atado a la
 * entrada del historial (`location.key`). Al volver con la flecha del
 * navegador (o con la de la barra, o con "Volver"), React Router restaura esa
 * misma entrada, la pantalla se monta de nuevo y recupera sus filtros, su
 * página y su orden tal como estaban. Entrar a la pantalla desde el menú crea
 * una entrada nueva: arranca limpia, como siempre.
 *
 * Se usa para los filtros de los listados, no para datos: lo que viene del
 * servidor se vuelve a pedir igual.
 *
 *   const [busqueda, setBusqueda] = useEstadoNavegacion("SectorPage.busqueda", "");
 *
 * La clave tiene que ser única dentro de la pantalla (dos pestañas de una
 * misma ruta no deben compartirla): por eso lleva el nombre del componente.
 */

const PREFIJO = "saia:estado:";
/** Entradas guardadas como máximo; al pasarse se borran las más viejas. */
const MAXIMO = 400;

interface Guardado<T> {
  /** Cuándo se guardó, para podar las más viejas. */
  t: number;
  v: T;
}

function leer<T>(id: string): Guardado<T> | null {
  try {
    const texto = sessionStorage.getItem(id);
    return texto ? (JSON.parse(texto) as Guardado<T>) : null;
  } catch {
    return null;
  }
}

function podar() {
  const propias: { id: string; t: number }[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const id = sessionStorage.key(i);
    if (id?.startsWith(PREFIJO)) propias.push({ id, t: leer(id)?.t ?? 0 });
  }
  if (propias.length <= MAXIMO) return;
  propias
    .sort((a, b) => a.t - b.t)
    .slice(0, propias.length - MAXIMO + 50)
    .forEach(({ id }) => sessionStorage.removeItem(id));
}

function guardar<T>(id: string, valor: T) {
  try {
    sessionStorage.setItem(id, JSON.stringify({ t: Date.now(), v: valor } satisfies Guardado<T>));
    podar();
  } catch {
    // Sin storage (modo privado, cuota llena): la pantalla funciona igual,
    // solo que "atrás" no recupera los filtros.
  }
}

export function useEstadoNavegacion<T>(
  clave: string,
  inicial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const { key, pathname } = useLocation();
  // "default" es la clave de toda entrada abierta escribiendo la URL (sin
  // historial previo): no identifica una visita, así que no se guarda ni se
  // recupera nada. Al recargar (F5) la entrada conserva su clave real.
  const persistir = key !== "default";
  const id = `${PREFIJO}${key}|${pathname}|${clave}`;

  const [valor, setValor] = useState<T>(() => {
    const guardado = persistir ? leer<T>(id) : null;
    if (guardado) return guardado.v;
    return typeof inicial === "function" ? (inicial as () => T)() : inicial;
  });

  // Si la entrada cambia sin desmontar (p. ej. cambia un parámetro de la URL
  // con `replace`), el valor actual se guarda en la entrada nueva.
  useEffect(() => {
    if (persistir) guardar(id, valor);
  }, [id, valor, persistir]);

  return [valor, setValor];
}
