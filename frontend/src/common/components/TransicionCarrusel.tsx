import { Component, createRef, type ReactNode } from "react";
import { Flex } from "@chakra-ui/react";
import { useLocation } from "react-router-dom";
import { indiceRuta } from "./menuEntradas";

/** Duración y curva del barrido: a la par de la pestaña blanca de la barra. */
const DURACION = 320;
const CURVA = "cubic-bezier(0.25, 1, 0.5, 1)";

/**
 * Recorrido de cada vista, un poco más que su ancho: entre la que se va y la
 * que llega queda una calle del 3% durante el barrido, así no se ven pegadas
 * a mitad de camino.
 */
const RECORRIDO = 103;

const sinMovimiento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Fondo sólido para la copia de la vista que se va: el del elemento indicado
 * (el degradado del Inicio) o, si es transparente, el del primer ancestro que
 * tenga color. Así una vista corta nunca deja ver la otra por debajo.
 */
function fondoSolido(el: HTMLElement | null): { color: string; imagen: string } {
  let actual = el;
  while (actual) {
    const estilo = getComputedStyle(actual);
    const transparente = estilo.backgroundColor === "rgba(0, 0, 0, 0)" || estilo.backgroundColor === "transparent";
    if (estilo.backgroundImage !== "none" || !transparente) {
      return { color: estilo.backgroundColor, imagen: estilo.backgroundImage };
    }
    actual = actual.parentElement;
  }
  return { color: "white", imagen: "none" };
}

interface PropsBarrido {
  pathname: string;
  /** Elemento cuyo fondo se copia en la vista saliente (el del layout). */
  fondoDe: () => HTMLElement | null;
  children: ReactNode;
}

/** Copia de la vista que se va y hacia dónde barrer (1: entra por la derecha). */
interface Instantanea {
  copia: HTMLElement;
  direccion: 1 | -1;
}

/**
 * Hace el trabajo de `TransicionCarrusel`. Es un componente de clase a
 * propósito: `getSnapshotBeforeUpdate` es el único momento en que React deja
 * leer el DOM viejo justo antes de reemplazarlo por la pantalla nueva. Ahí se
 * toma la copia de la vista que se va; en `componentDidUpdate`, ya con la
 * nueva dibujada, se animan las dos.
 */
class Barrido extends Component<PropsBarrido> {
  private marco = createRef<HTMLDivElement>();
  private contenido = createRef<HTMLDivElement>();
  /** Barrido en curso: la copia que sale y la animación de la que entra. */
  private enCurso: { copia: HTMLElement; entrada: Animation } | null = null;

  /** Corta el barrido en curso: borra la copia y deja la vista actual quieta. */
  private cortar() {
    if (!this.enCurso) return;
    this.enCurso.entrada.cancel();
    this.enCurso.copia.remove();
    this.enCurso = null;
  }

  componentWillUnmount() {
    this.cortar();
  }

  getSnapshotBeforeUpdate(previas: PropsBarrido): Instantanea | null {
    if (previas.pathname === this.props.pathname) return null;
    // Clic rápido sobre otra pestaña con un barrido todavía en curso: se corta
    // y la pantalla nueva aparece directamente, sin encimar tres vistas ni
    // copiar una vista a mitad de camino.
    if (this.enCurso) {
      this.cortar();
      return null;
    }
    const desde = indiceRuta(previas.pathname);
    const hasta = indiceRuta(this.props.pathname);
    const caja = this.marco.current;
    const actual = this.contenido.current;
    if (desde === null || hasta === null || desde === hasta || !caja || !actual || sinMovimiento()) {
      return null;
    }

    const copia = actual.cloneNode(true) as HTMLElement;
    copia.setAttribute("aria-hidden", "true");
    copia.setAttribute("inert", "");
    Object.assign(copia.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      pointerEvents: "none",
      zIndex: "1",
    });
    // El fondo de la pantalla que se va (p. ej. el degradado del Inicio), que
    // cambia en cuanto cambia la ruta: sólido, para tapar lo de abajo.
    const fondo = fondoSolido(this.props.fondoDe());
    copia.style.backgroundColor = fondo.color;
    copia.style.backgroundImage = fondo.imagen;
    caja.appendChild(copia);
    // El scroll no viaja con `cloneNode`: se repone en cada zona con scroll.
    const originales = actual.querySelectorAll<HTMLElement>("*");
    const copiados = copia.querySelectorAll<HTMLElement>("*");
    originales.forEach((el, i) => {
      if ((el.scrollTop || el.scrollLeft) && copiados[i]) {
        copiados[i].scrollTop = el.scrollTop;
        copiados[i].scrollLeft = el.scrollLeft;
      }
    });
    return { copia, direccion: hasta > desde ? 1 : -1 };
  }

  componentDidUpdate(_previas: PropsBarrido, _estado: unknown, instantanea: Instantanea | null) {
    const actual = this.contenido.current;
    if (!instantanea) return;
    const { copia, direccion } = instantanea;
    if (!actual) {
      copia.remove();
      return;
    }
    const tiempo = { duration: DURACION, easing: CURVA };
    // La que llega entra apenas atenuada y la que se va se apaga un poco: el
    // ojo distingue cuál es cuál.
    const entrada = actual.animate(
      [
        { transform: `translateX(${direccion * RECORRIDO}%)`, opacity: 0.85 },
        { transform: "translateX(0)", opacity: 1 },
      ],
      tiempo,
    );
    const salida = copia.animate(
      [
        { transform: "translateX(0)", opacity: 1 },
        { transform: `translateX(${-direccion * RECORRIDO}%)`, opacity: 0.7 },
      ],
      { ...tiempo, fill: "forwards" },
    );
    this.enCurso = { copia, entrada };
    const terminar = () => {
      copia.remove();
      if (this.enCurso?.copia === copia) this.enCurso = null;
    };
    salida.onfinish = terminar;
    salida.oncancel = terminar;
    // Por las dudas (pestaña en segundo plano, animación que no termina): la
    // copia nunca queda tapando la pantalla.
    window.setTimeout(terminar, DURACION + 200);
  }

  render() {
    return (
      // `overflow="hidden"`: durante el barrido nada asoma ni aparece un
      // scroll horizontal; cada pantalla mantiene su scroll vertical adentro.
      <Flex ref={this.marco} position="relative" flex={1} minH={0} w="100%" overflow="hidden" direction="column">
        <Flex ref={this.contenido} flex={1} minH={0} w="100%" direction="column">
          {this.props.children}
        </Flex>
      </Flex>
    );
  }
}

/**
 * Barrido tipo carrusel entre pantallas: la vista que se va sale por un
 * costado y la nueva entra por el otro, las dos al mismo tiempo y pegadas
 * borde con borde, hacia el mismo lado al que se movió la pestaña de la barra
 * (según el orden del menú, ver `indiceRuta`).
 *
 * La vista que se va NO se vuelve a montar en React (eso repetiría sus
 * pedidos a la API y sus estados): se desliza una copia estática de su DOM
 * (con su scroll y su fondo), que se borra al terminar.
 *
 * Solo barre entre pantallas distintas del menú; entre un listado y su ficha
 * (mismo índice), o hacia una ruta fuera del menú, cambia sin animación. Con
 * "reducir movimiento" activado en el sistema, tampoco anima.
 */
export function TransicionCarrusel({
  fondoDe,
  children,
}: {
  fondoDe: () => HTMLElement | null;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  return (
    <Barrido pathname={pathname} fondoDe={fondoDe}>
      {children}
    </Barrido>
  );
}
