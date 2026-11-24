import { useEffect, useState } from "react";

/** Ancho del desvanecido en cada borde. */
const FRANJA = "28px";

/**
 * Pista de que un bloque tiene más contenido de costado: desvanece el borde
 * del lado donde sigue. Las barras de scroll están ocultas en toda la app
 * (`index.css`), así que sin esto una tabla cortada parecía completa.
 *
 * Devuelve la `ref` que va en el elemento con `overflow-x: auto` y la máscara
 * para su `style`. Es una máscara y no un degradado encima: sirve sobre
 * cualquier fondo. Con `izquierda: false` ese borde no se desvanece (para una
 * primera columna fija, que tiene que leerse siempre).
 */
export function usePistaScroll({ izquierda = true }: { izquierda?: boolean } = {}) {
  const [elemento, setElemento] = useState<HTMLElement | null>(null);
  const [masALaIzquierda, setMasALaIzquierda] = useState(false);
  const [masALaDerecha, setMasALaDerecha] = useState(false);

  useEffect(() => {
    if (!elemento) return;
    const medir = () => {
      setMasALaIzquierda(elemento.scrollLeft > 2);
      setMasALaDerecha(elemento.scrollLeft + elemento.clientWidth < elemento.scrollWidth - 2);
    };
    elemento.addEventListener("scroll", medir, { passive: true });
    // Avisa también al empezar a observar: es la primera medición.
    const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
    observador?.observe(elemento);
    for (const hijo of elemento.children) observador?.observe(hijo);
    return () => {
      elemento.removeEventListener("scroll", medir);
      observador?.disconnect();
    };
  }, [elemento]);

  const desde = izquierda && masALaIzquierda;
  const mascara =
    desde || masALaDerecha
      ? `linear-gradient(to right, ${desde ? "transparent" : "#000"}, #000 ${FRANJA}, #000 calc(100% - ${FRANJA}), ${
          masALaDerecha ? "transparent" : "#000"
        })`
      : undefined;

  return { ref: setElemento, mascara };
}
