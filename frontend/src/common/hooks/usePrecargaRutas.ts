import {
  isValidElement,
  lazy,
  useEffect,
  type LazyExoticComponent,
  type ReactNode,
} from "react";
import { matchRoutes, type RouteObject } from "react-router-dom";

/**
 * Precarga del código de cada pantalla antes del clic.
 *
 * Cada página se baja en su propio chunk (`lazy()` en `router.tsx`). La
 * primera vez que se abre una, React Router navega dentro de una transición y
 * deja la pantalla vieja quieta hasta que llega el chunk: medio segundo o más
 * en que el clic parece no hacer nada, y después el barrido entre pantallas
 * (`TransicionCarrusel`) arranca tarde. Pidiendo el chunk cuando el puntero
 * pasa por el enlace (o el teclado lo enfoca), al hacer clic ya está.
 */

type Cargador = () => Promise<unknown>;

/** Lo que acepta `lazy()` como componente (sale de su firma, sin escribir `any`). */
type ComponenteLazy = Awaited<ReturnType<Parameters<typeof lazy>[0]>>["default"];

/** Componente lazy → la función que baja su chunk. */
const cargadores = new WeakMap<object, Cargador>();

/**
 * Igual que `lazy()`, pero recuerda cómo bajar el chunk para poder pedirlo
 * antes de que se renderice. `import()` cachea el módulo: pedirlo antes no
 * lo baja dos veces.
 */
export function lazyPrecargable<T extends ComponenteLazy>(
  cargar: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  const componente = lazy(cargar);
  cargadores.set(componente, cargar);
  return componente;
}

/** Junta los chunks de los componentes lazy que aparecen en un elemento de ruta. */
function cargadoresDe(nodo: ReactNode, salida: Cargador[]) {
  if (Array.isArray(nodo)) {
    nodo.forEach((hijo) => cargadoresDe(hijo, salida));
    return;
  }
  if (!isValidElement(nodo)) return;
  if (typeof nodo.type !== "string") {
    const cargar = cargadores.get(nodo.type);
    if (cargar) salida.push(cargar);
  }
  cargadoresDe((nodo.props as { children?: ReactNode }).children, salida);
}

/** Rutas ya pedidas: cada una se precarga una sola vez. */
const yaPedidas = new Set<string>();

/** Baja los chunks de las pantallas que se abrirían en `pathname`. */
export function precargarRuta(rutas: RouteObject[], pathname: string) {
  if (yaPedidas.has(pathname)) return;
  yaPedidas.add(pathname);
  const cargas: Cargador[] = [];
  matchRoutes(rutas, pathname)?.forEach(({ route }) => cargadoresDe(route.element, cargas));
  // Si falla (sin red), se puede volver a intentar en la próxima pasada.
  cargas.forEach((cargar) => cargar().catch(() => yaPedidas.delete(pathname)));
}

/**
 * Escucha en todo el documento cuándo el puntero pasa por un enlace interno o
 * el teclado lo enfoca, y precarga su pantalla. Va en un solo lugar (el
 * layout) y cubre todos los enlaces: barra, migas, tarjetas del Inicio, etc.
 *
 * `rutas` es una función para leer las rutas del router recién al usarlas:
 * el layout se declara antes que el router.
 */
export function usePrecargaRutas(rutas: () => RouteObject[]) {
  useEffect(() => {
    const alApuntar = (evento: Event) => {
      if (!(evento.target instanceof Element)) return;
      const enlace = evento.target.closest("a[href]");
      if (!(enlace instanceof HTMLAnchorElement) || enlace.origin !== window.location.origin) return;
      precargarRuta(rutas(), enlace.pathname);
    };
    const opciones = { capture: true, passive: true };
    document.addEventListener("pointerover", alApuntar, opciones);
    document.addEventListener("focusin", alApuntar, opciones);
    // En el celular no hay hover: el dedo apoyado ya adelanta unos ms.
    document.addEventListener("touchstart", alApuntar, opciones);
    return () => {
      document.removeEventListener("pointerover", alApuntar, opciones);
      document.removeEventListener("focusin", alApuntar, opciones);
      document.removeEventListener("touchstart", alApuntar, opciones);
    };
  }, [rutas]);
}
