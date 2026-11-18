import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Box, Flex, chakra } from "@chakra-ui/react";
import { useSearchParams } from "react-router-dom";

/**
 * Sub-pestañas de una página (Stock de químicos, Aditivos, Stock de insumos,
 * Parámetros nutricionales), con la misma forma y animación que las pestañas
 * de la barra de navegación (`Navbar`):
 *
 *   - La pestaña activa es una lengüeta blanca con las esquinas de arriba
 *     redondeadas que se apoya sobre la tarjeta de abajo (la de filtros): tapa
 *     su borde superior y abre una curva hacia cada costado, así se leen como
 *     una sola pieza.
 *   - Al cambiar, la lengüeta se desliza y se ajusta al ancho de la nueva
 *     (tres tramos: dos extremos fijos y un centro que se escala, solo con
 *     `transform`), y todo el bloque de abajo (filtros, chips y tabla) barre
 *     de costado como una unidad, hacia el lado de la pestaña elegida.
 *
 * La pestaña elegida va en la URL (`?tab=`), así sobrevive a recargar y se
 * puede enlazar. Se lee en el render (`searchParams.get("tab")`, o la primera
 * si falta o no existe): no hay `setSearchParams` al montar ni redirección.
 *
 * Cambiar de pestaña no cambia la ruta (solo la búsqueda), así que el barrido
 * entre pantallas (`TransicionCarrusel`) ni se dispara ni se corta.
 *
 * Cada pestaña se monta la primera vez que se abre y después queda montada
 * (oculta): al volver, conserva sus filtros y su página.
 */

export interface Pestana {
  valor: string;
  etiqueta: ReactNode;
  contenido: ReactNode;
}

/* ───────────────────────────── Forma ───────────────────────────── */

/** Radio de las curvas al pie de la lengüeta, en px (el mismo de la barra). */
const RADIO = 10;
/** Ancho de maquetado del tramo central (se escala). */
const ANCHO_BASE = 100;
/**
 * Margen de la primera pestaña: el radio de la esquina de la tarjeta (8px)
 * más el de la curva, para que la curva nunca caiga sobre la esquina.
 */
const MARGEN_LISTA = RADIO + 8;
/** Colores de la tarjeta de abajo, con los que se funde la lengüeta. */
const FONDO = "bg.panel";
const BORDE = "border.subtle";

/** Curva cóncava al pie de la lengüeta, con el filete del borde de la tarjeta. */
function curva(lado: "left" | "right") {
  const centro = lado === "left" ? "0 0" : "100% 0";
  return {
    content: '""',
    position: "absolute",
    bottom: 0,
    // Corrida 1px hacia la lengüeta: el filete de la curva empalma con el
    // borde lateral de la lengüeta arriba y con el de la tarjeta abajo.
    left: lado === "left" ? `-${RADIO - 1}px` : undefined,
    right: lado === "right" ? `-${RADIO - 1}px` : undefined,
    w: `${RADIO}px`,
    h: `${RADIO}px`,
    bgImage: `radial-gradient(circle at ${centro}, transparent ${RADIO - 1}px, {colors.${BORDE}} ${RADIO - 0.5}px, {colors.${BORDE}} ${RADIO}px, {colors.${FONDO}} ${RADIO + 0.5}px)`,
  } as const;
}

/** Tramo de la lengüeta: ocupa todo su alto y se mueve solo con `transform`. */
const TRAMO = {
  position: "absolute",
  top: 0,
  bottom: 0,
  left: 0,
  bg: FONDO,
  borderTopWidth: "1px",
  borderColor: BORDE,
  willChange: "transform",
} as const;

/* ─────────────────────────── Animación ─────────────────────────── */

/** Duración y curva: las de las pestañas de la barra. */
const DURACION = 300;
const CURVA = "cubic-bezier(0.22, 0.8, 0.24, 1)";
/**
 * Recorrido del bloque al barrer: el ancho de la ventana. El bloque sale y
 * entra por los bordes reales de la pantalla, no por los de la columna de la
 * página (ver la pista, abajo).
 */
const RECORRIDO = "100vw";

/**
 * Sangría de la pista hacia cada costado: de la columna de la página hasta el
 * borde de la ventana. `100cqw` es el ancho de la columna (el contenedor de
 * `PestanasPagina` declara `container-type`), así que vale lo mismo con
 * cualquier `max-width` o margen lateral de la página.
 */
const SANGRIA = "calc((100vw - 100cqw) / 2)";

const sinMovimiento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Caja {
  x: number;
  ancho: number;
}

function tramos(caja: Caja) {
  return {
    todo: `translateX(${caja.x}px)`,
    // El centro se pisa 1px con cada extremo: nunca queda una rendija.
    centro: `scaleX(${Math.max(caja.ancho - 2 * (RADIO - 1), 0) / ANCHO_BASE})`,
    derecha: `translateX(${caja.ancho - RADIO}px)`,
  };
}

/** Pestaña que sale mientras barre el bloque, y hacia dónde (1: la nueva entra por la derecha). */
interface Salida {
  valor: string;
  direccion: 1 | -1;
}

export function PestanasPagina({
  pestanas,
  parametro = "tab",
}: {
  pestanas: Pestana[];
  /** Nombre del parámetro de la URL que guarda la pestaña elegida. */
  parametro?: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const pedida = searchParams.get(parametro);
  const activa = pestanas.some((p) => p.valor === pedida) ? (pedida as string) : (pestanas[0]?.valor ?? "");
  const indice = (valor: string) => pestanas.findIndex((p) => p.valor === valor);

  // Pestañas ya abiertas (quedan montadas) y la que sale durante el barrido.
  // Se ajustan durante el render, al cambiar `activa` (el patrón que documenta
  // React para derivar estado, en vez de un `useEffect`).
  const [abiertas, setAbiertas] = useState<string[]>(() => [activa]);
  const [previa, setPrevia] = useState(activa);
  const [saliendo, setSaliendo] = useState<Salida | null>(null);
  if (previa !== activa) {
    setPrevia(activa);
    if (!abiertas.includes(activa)) setAbiertas([...abiertas, activa]);
    setSaliendo(
      sinMovimiento() ? null : { valor: previa, direccion: indice(activa) > indice(previa) ? 1 : -1 },
    );
  }

  const elegir = (valor: string) => {
    if (valor === activa) return;
    setSearchParams(
      (actuales) => {
        const nuevos = new URLSearchParams(actuales);
        nuevos.set(parametro, valor);
        return nuevos;
      },
      // Cambiar de pestaña no suma una entrada al historial: "Atrás" vuelve a
      // la pantalla anterior, no a la pestaña anterior.
      { replace: true },
    );
  };

  /* ───────────── Lengüeta ───────────── */

  const listaRef = useRef<HTMLDivElement>(null);
  const indicadorRef = useRef<HTMLDivElement>(null);
  const centroRef = useRef<HTMLDivElement>(null);
  const derechaRef = useRef<HTMLDivElement>(null);
  const cajaRef = useRef<Caja | null>(null);

  const cajaDeLaActiva = useCallback((): Caja | null => {
    const el = listaRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    return el ? { x: el.offsetLeft, ancho: el.offsetWidth } : null;
  }, []);

  /** Deja la lengüeta en su lugar, sin animar. */
  const colocar = useCallback((caja: Caja | null) => {
    const indicador = indicadorRef.current;
    if (!indicador) return;
    if (caja) {
      const t = tramos(caja);
      indicador.style.transform = t.todo;
      if (centroRef.current) centroRef.current.style.transform = t.centro;
      if (derechaRef.current) derechaRef.current.style.transform = t.derecha;
    }
    indicador.style.opacity = caja ? "1" : "0";
  }, []);

  useLayoutEffect(() => {
    const caja = cajaDeLaActiva();
    const cajaPrevia = cajaRef.current;
    cajaRef.current = caja;
    colocar(caja);
    const [indicador, centro, derecha] = [indicadorRef.current, centroRef.current, derechaRef.current];
    if (!caja || !cajaPrevia || !indicador || !centro || !derecha || sinMovimiento()) return;
    if (caja.x === cajaPrevia.x && caja.ancho === cajaPrevia.ancho) return;
    const desde = tramos(cajaPrevia);
    const hasta = tramos(caja);
    const tiempo = { duration: DURACION, easing: CURVA };
    indicador.animate([{ transform: desde.todo }, { transform: hasta.todo }], tiempo);
    centro.animate([{ transform: desde.centro }, { transform: hasta.centro }], tiempo);
    derecha.animate([{ transform: desde.derecha }, { transform: hasta.derecha }], tiempo);
  }, [activa, cajaDeLaActiva, colocar]);

  // Si cambia el ancho (ventana, menú plegado), la lengüeta se reacomoda sin animar.
  useLayoutEffect(() => {
    const lista = listaRef.current;
    if (!lista) return;
    const observador = new ResizeObserver(() => {
      const caja = cajaDeLaActiva();
      cajaRef.current = caja;
      colocar(caja);
    });
    observador.observe(lista);
    return () => observador.disconnect();
  }, [cajaDeLaActiva, colocar]);

  /* ───────────── Barrido del bloque ───────────── */

  const paneles = useRef(new Map<string, HTMLDivElement>());

  useLayoutEffect(() => {
    // Un barrido anterior a medio camino se corta: el bloque que entraba
    // puede ser justo el que ahora sale.
    paneles.current.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    if (!saliendo) return;
    const entra = paneles.current.get(activa);
    const sale = paneles.current.get(saliendo.valor);
    if (!entra || !sale) {
      setSaliendo(null);
      return;
    }
    const { direccion } = saliendo;
    const tiempo = { duration: DURACION, easing: CURVA };
    entra.animate(
      [
        { transform: `translateX(calc(${direccion} * ${RECORRIDO}))`, opacity: 0.85 },
        { transform: "translateX(0)", opacity: 1 },
      ],
      tiempo,
    );
    const salida = sale.animate(
      [
        { transform: "translateX(0)", opacity: 1 },
        { transform: `translateX(calc(${-direccion} * ${RECORRIDO}))`, opacity: 0.7 },
      ],
      { ...tiempo, fill: "forwards" },
    );
    const terminar = () => setSaliendo((actual) => (actual === saliendo ? null : actual));
    salida.onfinish = terminar;
    // Respaldo holgado por si la animación nunca avisa (pestaña en segundo plano).
    const respaldo = window.setTimeout(terminar, DURACION + 1500);
    return () => window.clearTimeout(respaldo);
  }, [saliendo, activa]);

  /* ───────────── Teclado (patrón de pestañas WAI-ARIA) ───────────── */

  const idBase = useId();
  const alTeclear = (e: KeyboardEvent<HTMLElement>) => {
    const i = indice(activa);
    let destino: number | null = null;
    if (e.key === "ArrowRight") destino = (i + 1) % pestanas.length;
    else if (e.key === "ArrowLeft") destino = (i - 1 + pestanas.length) % pestanas.length;
    else if (e.key === "Home") destino = 0;
    else if (e.key === "End") destino = pestanas.length - 1;
    if (destino === null) return;
    e.preventDefault();
    elegir(pestanas[destino].valor);
    listaRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[destino]?.focus();
  };

  return (
    // Contenedor de consulta: da el ancho de la columna (`100cqw`) para
    // calcular la sangría de la pista (ver `SANGRIA`).
    <Box css={{ containerType: "inline-size" }}>
      {/*
        Fila de pestañas. Va pegada al bloque de abajo (sin margen) y por
        encima de él (`zIndex`): la lengüeta baja 1px y tapa el borde superior
        de la tarjeta de filtros.
      */}
      <Flex
        ref={listaRef}
        role="tablist"
        position="relative"
        zIndex={1}
        align="center"
        gap="1"
        h="11"
        px={`${MARGEN_LISTA}px`}
        overflowX="auto"
        overflowY="hidden"
        // Lugar para que la lengüeta baje 1px sin que el scroll la recorte.
        pb="1px"
        mb="-1px"
        css={{ scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}
      >
        <Box
          ref={indicadorRef}
          aria-hidden
          position="absolute"
          top="4px"
          bottom="0"
          left="0"
          w="0"
          opacity={0}
          pointerEvents="none"
          willChange="transform, opacity"
        >
          <Box
            ref={centroRef}
            {...TRAMO}
            left={`${RADIO - 1}px`}
            w={`${ANCHO_BASE}px`}
            transformOrigin="left"
          />
          <Box
            {...TRAMO}
            w={`${RADIO}px`}
            borderLeftWidth="1px"
            roundedTopLeft="lg"
            _before={curva("left")}
          />
          <Box
            ref={derechaRef}
            {...TRAMO}
            w={`${RADIO}px`}
            borderRightWidth="1px"
            roundedTopRight="lg"
            _after={curva("right")}
          />
        </Box>

        {pestanas.map((p) => {
          const seleccionada = p.valor === activa;
          return (
            <chakra.button
              key={p.valor}
              type="button"
              role="tab"
              id={`${idBase}-pestana-${p.valor}`}
              aria-selected={seleccionada}
              aria-controls={`${idBase}-panel-${p.valor}`}
              tabIndex={seleccionada ? 0 : -1}
              onClick={() => elegir(p.valor)}
              onKeyDown={alTeclear}
              // Por encima de la lengüeta.
              position="relative"
              zIndex={1}
              display="flex"
              alignItems="center"
              flexShrink={0}
              whiteSpace="nowrap"
              h="9"
              px="3"
              rounded="md"
              // Proporción de las opciones de la barra: 14px, mismo peso
              // seleccionada o no (si cambiara, la pestaña cambiaría de ancho
              // y empujaría a las vecinas en cada clic).
              fontSize="sm"
              fontWeight="semibold"
              color={seleccionada ? "brand.900" : "fg.muted"}
              bg="transparent"
              cursor="pointer"
              transition={`color ${DURACION}ms, background-color 150ms`}
              _hover={seleccionada ? undefined : { bg: "blackAlpha.50", color: "fg" }}
              _focusVisible={{ outline: "2px solid", outlineColor: "brand.500", outlineOffset: "-2px" }}
            >
              {p.etiqueta}
            </chakra.button>
          );
        })}
      </Flex>

      {/*
        Pista del carrusel: ocupa todo el ancho de la ventana (sale de la
        columna de la página con un margen negativo), así el bloque que se va
        sigue hasta el borde de la pantalla y el que llega entra por el borde
        opuesto. El banner y la fila de pestañas quedan en su ancho.

        Recorta de costado con `clip` y no con `hidden`: `overflow-x: hidden`
        obliga a `overflow-y: auto` y recortaría en vertical los desplegables
        de los filtros; `clip` corta solo de costado y no crea una zona con
        scroll.

        Cada panel devuelve la sangría como relleno lateral: en reposo, filtros
        y tabla quedan exactamente en la columna, alineados con las pestañas.
        Durante el barrido, la que sale se superpone arriba y las dos se
        deslizan juntas.
      */}
      <Box position="relative" w="100vw" ml={`calc(-1 * ${SANGRIA})`} overflowX="clip">
        {pestanas
          .filter((p) => abiertas.includes(p.valor))
          .map((p) => {
            const esActiva = p.valor === activa;
            const sale = saliendo?.valor === p.valor;
            return (
              <Box
                key={p.valor}
                ref={(el: HTMLDivElement | null) => {
                  if (el) paneles.current.set(p.valor, el);
                  else paneles.current.delete(p.valor);
                }}
                role="tabpanel"
                id={`${idBase}-panel-${p.valor}`}
                aria-labelledby={`${idBase}-pestana-${p.valor}`}
                aria-hidden={sale || undefined}
                inert={sale || undefined}
                display={esActiva || sale ? "block" : "none"}
                px={SANGRIA}
                {...(sale ? { position: "absolute", top: 0, left: 0, w: "full", pointerEvents: "none" } : {})}
              >
                {p.contenido}
              </Box>
            );
          })}
      </Box>
    </Box>
  );
}
