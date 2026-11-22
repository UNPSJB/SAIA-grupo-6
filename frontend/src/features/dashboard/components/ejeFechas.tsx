import { useLayoutEffect, useRef, useState } from "react";

/*
 * Eje de fechas de los gráficos: qué fechas entran y cómo se rotulan.
 * Va aparte de `graficos.tsx` para que ese archivo exporte solo componentes.
 */

/**
 * `true` si una serie diaria de `dias` puntos es la del período de 30 días
 * (29 a 31 según cómo se cuenten los extremos). Solo ahí las fechas del eje
 * van en diagonal.
 */
export function esPeriodoDeUnMes(dias: number): boolean {
  return dias >= 28 && dias <= 32;
}

/** Ancho de un elemento, al día cuando cambia el tamaño de la pantalla. */
function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(0);
  // Antes de pintar: se mide ya, sin esperar el primer aviso del observador
  // (que puede tardar y dejar el eje con dos fechas mientras tanto).
  useLayoutEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;
    setAncho(elemento.getBoundingClientRect().width);
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada.contentRect.width > 0) setAncho(entrada.contentRect.width);
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  return [ref, ancho] as const;
}

/** Si todavía no se pudo medir, un ancho típico de gráfico: mejor que dos fechas. */
const ANCHO_SUPUESTO = 600;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** Desde cuántos días una serie diaria se rotula por mes (la de 12 meses). */
const DIAS_PARA_ROTULAR_POR_MES = 120;

/**
 * Qué fechas se escriben en un eje X sin rotar. Las que entran en el ancho
 * del gráfico, a intervalos iguales contados DESDE LA ÚLTIMA: así la última
 * fecha siempre está y no queda un hueco antes de ella (recharts, al forzar
 * la primera y la última, ocultaba la anteúltima).
 *
 * `claves` es el `YYYY-MM-DD` de cada punto. Los meses se escriben con el
 * nombre del mes y, donde cambia el año, con el año entero: "nov · ene 2026
 * · mar…". Nunca "dic 25", que se lee como el día 25. Se
 * rotula por mes una serie por mes (`porMes`) y una serie diaria larga, como
 * la de 12 meses: ahí se marca el día 1 de cada mes.
 *
 * `ref` va en el contenedor del gráfico; `tick` dibuja cada fecha centrada
 * en su día, también la última: así queda a la misma distancia que las demás
 * (el gráfico deja margen a la derecha para que no se corte).
 */
export function useFechasEje(
  etiquetas: string[],
  tamanoLetra: number,
  color: string,
  claves?: string[],
  porMes = false,
) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  /** Etiqueta del punto → su mes, si ese punto se rotula con el mes. */
  const meses = new Map<string, { mes: string; anio: string }>();
  if (claves && (porMes || claves.length >= DIAS_PARA_ROTULAR_POR_MES)) {
    claves.forEach((clave, i) => {
      if (porMes || clave.endsWith("-01")) {
        meses.set(etiquetas[i], { mes: MESES[Number(clave.slice(5, 7)) - 1], anio: clave.slice(0, 4) });
      }
    });
  }
  const candidatas = meses.size ? etiquetas.filter((e) => meses.has(e)) : etiquetas;

  // Ancho aproximado de una fecha más el aire mínimo entre dos. Un mes se
  // cuenta como "dic 25": algunos llevan el año entero, la mayoría no.
  const largo = meses.size ? 6 : Math.max(1, ...candidatas.map((e) => e.length));
  const porEtiqueta = largo * tamanoLetra * 0.62 + 20;
  const entran = Math.max(2, Math.floor(((ancho || ANCHO_SUPUESTO) - 40) / porEtiqueta));
  const paso = Math.max(1, Math.ceil(candidatas.length / entran));
  const ultima = candidatas.length - 1;
  const ticks = candidatas.filter((_, i) => (ultima - i) % paso === 0);

  /**
   * Texto de cada fecha visible: el año va donde cambia ("nov · ene 2026 ·
   * mar"). En la primera solo si no cambia en todo el eje: así dos fechas con
   * año no quedan juntas al principio, donde se pisarían.
   */
  const cambiaAnio = (i: number) => i > 0 && meses.get(ticks[i])?.anio !== meses.get(ticks[i - 1])?.anio;
  const algunCambio = ticks.some((_, i) => cambiaAnio(i));
  const textos = new Map<string, string>();
  ticks.forEach((etiqueta, i) => {
    const mes = meses.get(etiqueta);
    if (!mes) return textos.set(etiqueta, etiqueta);
    const conAnio = cambiaAnio(i) || (i === 0 && !algunCambio);
    textos.set(etiqueta, conAnio ? `${mes.mes} ${mes.anio}` : mes.mes);
  });

  const tick = (props: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) => {
    const valor = String(props.payload?.value ?? "");
    return (
      <text x={props.x} y={props.y} dy="0.71em" fontSize={tamanoLetra} fill={color} textAnchor="middle">
        {textos.get(valor) ?? valor}
      </text>
    );
  };
  return { ref, ticks, tick };
}
