import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Navigate, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Box, Flex, Link, chakra } from "@chakra-ui/react";
import { LuArrowLeft, LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { useAuth } from "../context/useAuth";
import { FONDO_PESTANA } from "../../theme";
import {
  MENU,
  destinoCategoria,
  entradaActiva,
  esVisibleEntrada,
  gruposVisibles,
  rutaPanel,
  vePaneles,
  type EntradaMenu,
  type GrupoMenu,
} from "./menuEntradas";
import { hayPantallaAnterior } from "../hooks/historialNavegacion";

/* ───────────────────────── Pestaña seleccionada ───────────────────────── */

/** Radio de las curvas de la pestaña seleccionada, en px. */
const RADIO = 10;

/**
 * Distancia del borde de arriba de la barra al de la pestaña seleccionada.
 * Es la misma para categorías y opciones: el fondo blanco nunca se mueve ni
 * cambia de alto, solo se desliza de costado. Coincide con el borde de arriba
 * de una categoría (alto 44 centrado en una barra de 64).
 */
const TOPE_INDICADOR = 10;

/** Ancho de maquetado del tramo central del indicador (se escala, ver abajo). */
const ANCHO_BASE = 100;

/**
 * Fondo con el que se funde la pestaña seleccionada: lo que hay justo debajo
 * de la barra. En escritorio es la franja blanca de las migas de pan; en
 * celular esa franja no está y debajo queda el fondo de la página.
 */
const FONDO_FUSION = { base: "pagina", md: FONDO_PESTANA } as const;

/** Curva cóncava al pie de la pestaña seleccionada, del lado indicado. */
function curva(lado: "left" | "right") {
  const centro = lado === "left" ? "0 0" : "100% 0";
  const degradado = (color: string) =>
    `radial-gradient(circle at ${centro}, transparent ${RADIO}px, {colors.${color}} ${RADIO + 0.5}px)`;
  return {
    content: '""',
    position: "absolute",
    bottom: 0,
    left: lado === "left" ? `-${RADIO}px` : undefined,
    right: lado === "right" ? `-${RADIO}px` : undefined,
    w: `${RADIO}px`,
    h: `${RADIO}px`,
    bgImage: { base: degradado(FONDO_FUSION.base), md: degradado(FONDO_FUSION.md) },
  } as const;
}

/** Tramo del indicador: ocupa todo el alto y se mueve solo con `transform`. */
const TRAMO = {
  position: "absolute",
  top: 0,
  bottom: 0,
  left: 0,
  bg: FONDO_FUSION,
  willChange: "transform",
} as const;

/* ─────────────────────────────── Pestañas ─────────────────────────────── */

/**
 * Estilos de una pestaña de la barra (categorías y opciones). El relleno y el
 * color del texto no van acá sino en sus capas (`Capas`).
 */
function pestana(activa: boolean) {
  return {
    display: "flex",
    flexShrink: 0,
    whiteSpace: "nowrap",
    rounded: "md",
    textDecoration: "none",
    border: "none",
    cursor: "pointer",
    // Por encima del indicador, que comparte la lista.
    position: "relative",
    zIndex: 1,
    bg: "transparent",
    color: "white",
    _hover: {
      bg: activa ? "transparent" : "whiteAlpha.200",
      color: "white",
      textDecoration: "none",
    },
    _focusVisible: {
      outline: "2px solid",
      // El contorno blanco no se ve sobre la pestaña clara.
      outlineColor: activa ? "brand.700" : "white",
      outlineOffset: "-2px",
    },
  } as const;
}

/**
 * Contenido de una pestaña, en dos capas superpuestas con el mismo texto:
 * la clara (blanco, sobre la barra teal) y la oscura (teal, sobre el fondo
 * blanco de la seleccionada). Se ve una u otra según `activa`.
 *
 * Son dos capas, y no un cambio de `color`, para que el paso de una a otra sea
 * un fundido de opacidad: eso lo anima el compositor del navegador sin
 * depender de que la página esté libre, igual que los desplazamientos. Un
 * `color` animado se congela mientras la pantalla nueva se está dibujando, y
 * el texto quedaba un instante blanco sobre blanco.
 *
 * La capa oscura es decorativa (`aria-hidden`): el texto se lee una sola vez.
 */
function Capas({
  activa,
  gap,
  px,
  children,
}: {
  activa: boolean;
  gap: string;
  px: string;
  children: ReactNode;
}) {
  const capa = { display: "flex", alignItems: "center", gap, px, h: "full" } as const;
  return (
    <>
      <Box as="span" data-capa="clara" {...capa} opacity={activa ? 0 : 1}>
        {children}
      </Box>
      <Box
        as="span"
        data-capa="oscura"
        aria-hidden
        {...capa}
        position="absolute"
        inset="0"
        // Teal bien oscuro: se lee nítido sobre la pestaña clara. Mismo peso
        // que la capa clara, para que las dos midan lo mismo.
        color="brand.900"
        opacity={activa ? 1 : 0}
      >
        {children}
      </Box>
    </>
  );
}

/** Forma común de la categoría, en la fila de categorías y ya abierta. */
const CATEGORIA = { h: "11", fontSize: "md", fontWeight: "bold" } as const;
const CAPAS_CATEGORIA = { gap: "2.5", px: "4" } as const;

/* ─────────────────────────────── Animación ─────────────────────────────── */

/*
 * Las animaciones viven dentro de la barra y solo usan `transform` y
 * `opacity` (Web Animations API). Esas dos propiedades las anima el
 * compositor del navegador, en un hilo aparte: siguen fluidas aunque la
 * página esté ocupada dibujando la pantalla nueva. Nada cambia de ancho, alto
 * ni color durante una animación.
 *
 * Cada pieza animable lleva `data-pieza="<clave>"`. Hay dos casos:
 *
 *   - Cambio de pestaña dentro del mismo nivel (entre las opciones de una
 *     categoría, o de la categoría a una opción): se compara dónde estaba
 *     cada clave con dónde quedó; lo que sigue estando se desplaza y el fondo
 *     blanco se desliza de una pestaña a otra.
 *   - Cambio de nivel (de las categorías a las opciones de una, o al volver
 *     al Inicio): son dos listas distintas, así que nada viaja de costado.
 *     Todas las pestañas del nivel nuevo están visibles desde el primer
 *     momento y emergen apenas desde abajo en su lugar; el fondo blanco de la
 *     nueva activa también emerge en su lugar. Al volver al Inicio (que no es
 *     una pestaña), el fondo blanco baja y se desvanece donde estaba.
 *
 * El fondo blanco de la pestaña seleccionada es el `indicador`. Para cambiar de ancho sin animar `width` está partido
 * en tres tramos: dos extremos de ancho fijo (con las esquinas y las curvas)
 * y un centro que se escala. Los tramos se pisan 1px, así nunca queda una
 * rendija entre ellos, y los tres llegan hasta el pie de la barra sin moverse
 * en vertical, así tampoco queda una línea entre la pestaña y la página.
 */

/** Cambio de nivel: las pestañas nuevas emergen en su lugar; el fondo blanco sale hacia abajo. */
const DURACION_APARECER = 220;
const DURACION_OCULTAR = 180;
/** Cambio de pestaña dentro de una categoría. */
const DURACION_PESTANA = 300;
const CURVA_PESTANA = "cubic-bezier(0.22, 0.8, 0.24, 1)";
/** Fundido del fondo blanco cuando, en el mismo nivel, ya no hay pestaña activa. */
const DURACION_SALIDA = 170;
/**
 * Cuánto se espera para pedir la pantalla nueva después de mover la barra:
 * lo justo para que las animaciones ya estén corriendo cuando la página se
 * ponga a dibujar.
 */
const ESPERA_NAVEGAR = 50;

const clavePanel = (id: string) => `categoria-${id}`;
const claveOpcion = (to: string) => `opcion-${to}`;

interface Medida {
  x: number;
  y: number;
  /** Era la pestaña seleccionada (se veía su capa oscura). */
  activa: boolean;
}

/** Dónde va el fondo blanco: desde `x`, con `ancho`. */
interface Caja {
  x: number;
  ancho: number;
}

const sinMovimiento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const piezasDe = (lista: HTMLElement) =>
  Array.from(lista.querySelectorAll<HTMLElement>("[data-pieza]"));

/**
 * Dónde está cada pieza según el maquetado (`offsetLeft` / `offsetTop`). A
 * propósito no se usa `getBoundingClientRect`: ese incluye el `transform` de
 * una animación en curso, y si la barra se vuelve a dibujar a mitad de un
 * desplazamiento se mediría una posición intermedia.
 */
function medir(lista: HTMLElement): Map<string, Medida> {
  const medidas = new Map<string, Medida>();
  for (const el of piezasDe(lista)) {
    medidas.set(el.dataset.pieza as string, {
      x: el.offsetLeft,
      y: el.offsetTop,
      activa: el.hasAttribute("data-activa"),
    });
  }
  return medidas;
}

function cajaDeLaActiva(lista: HTMLElement): Caja | null {
  const activa = lista.querySelector<HTMLElement>("[data-activa]");
  return activa ? { x: activa.offsetLeft, ancho: activa.offsetWidth } : null;
}

/** `transform` de cada tramo del indicador para una caja. */
function tramos(caja: Caja) {
  return {
    todo: `translateX(${caja.x}px)`,
    // El centro arranca 1px antes del final del extremo izquierdo y termina
    // 1px después del comienzo del derecho.
    centro: `scaleX(${Math.max(caja.ancho - 2 * (RADIO - 1), 0) / ANCHO_BASE})`,
    derecha: `translateX(${caja.ancho - RADIO}px)`,
  };
}

type AlIr = (e: MouseEvent<HTMLAnchorElement>, destino: string) => void;

/**
 * Categoría del primer nivel. Es la pestaña más grande de la barra: lleva al
 * panel de esa área (sus indicadores) y abre sus opciones en la barra.
 */
function PestanaCategoria({
  grupo,
  destino,
  contieneRutaActual,
  onIr,
}: {
  grupo: GrupoMenu;
  /** Su panel, o su primera pantalla para quien no ve los paneles. */
  destino: string;
  contieneRutaActual: boolean;
  onIr: AlIr;
}) {
  const Icono = grupo.icon;
  const clave = clavePanel(grupo.id);
  return (
    <Link
      asChild
      title={grupo.ayuda}
      {...pestana(false)}
      {...CATEGORIA}
      // La categoría de la pantalla actual se marca con un subrayado: no es
      // "la seleccionada" (eso es cuando se abre), pero orienta.
      boxShadow={contieneRutaActual ? "inset 0 -3px 0 0 white" : undefined}
      roundedBottom={contieneRutaActual ? "none" : "md"}
    >
      <NavLink
        to={destino}
        data-pieza={clave}
        onClick={(e) => onIr(e, destino)}
      >
        <Capas activa={false} {...CAPAS_CATEGORIA}>
          <Icono size={20} aria-hidden style={{ flexShrink: 0 }} />
          {grupo.label}
        </Capas>
      </NavLink>
    </Link>
  );
}

/** Opción dentro de una categoría: más chica que las categorías. */
function PestanaOpcion({
  entrada,
  activa,
  onIr,
}: {
  entrada: EntradaMenu;
  activa: boolean;
  onIr: AlIr;
}) {
  const Icono = entrada.icon;
  return (
    // `Link asChild` + un único hijo `NavLink`: `Slot` exige exactamente un
    // hijo, así que ícono y texto van dentro del `NavLink`.
    <Link
      asChild
      aria-current={activa ? "page" : undefined}
      {...pestana(activa)}
      h="9"
      fontSize="sm"
      // Mismo peso seleccionada o no: si cambiara, la pestaña cambiaría de
      // ancho y empujaría a las vecinas en cada clic.
      fontWeight="semibold"
    >
      <NavLink
        to={entrada.to}
        data-pieza={claveOpcion(entrada.to)}
        data-activa={activa ? "" : undefined}
        onClick={(e) => onIr(e, entrada.to)}
      >
        <Capas activa={activa} gap="1.5" px="2.5">
          <Icono size={16} aria-hidden style={{ flexShrink: 0 }} />
          {entrada.label}
        </Capas>
      </NavLink>
    </Link>
  );
}

/**
 * Menú de navegación horizontal, dentro de la barra superior.
 *
 * Tiene dos niveles que se reemplazan en el mismo lugar:
 *
 *   - Categorías: Producción, Inventario, Limpieza, … Es lo que se ve al
 *     entrar y en el inicio, centradas.
 *   - Opciones de una categoría: al abrir una se va a su panel y la barra
 *     muestra una flecha para volver al inicio (y con eso a las
 *     categorías), el nombre de la categoría (que lleva de vuelta al panel)
 *     y sus pantallas.
 *
 * Si la pantalla actual pertenece a una categoría, la barra arranca mostrando
 * esa categoría, así se ven las pantallas hermanas sin un clic extra.
 *
 * Las categorías y opciones salen de `menuEntradas.ts`, filtradas por rol: una
 * categoría sin opciones visibles para el usuario no se muestra.
 */
export default function Navbar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  /*
   * Ruta a la que se está yendo por un clic en la barra, mientras la pantalla
   * todavía no cambió. La barra se dibuja ya para esa ruta y recién un
   * instante después se pide la pantalla (ver `ir`): así la animación arranca
   * al momento del clic, antes de que la página se ponga a trabajar.
   */
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [pathnamePrevio, setPathnamePrevio] = useState(pathname);
  if (pathname !== pathnamePrevio) {
    // Cualquier navegación real (de la barra o no) deja de estar pendiente.
    setPathnamePrevio(pathname);
    setPendiente(null);
  }
  const ruta = pendiente ?? pathname;

  const grupos = useMemo(
    () => gruposVisibles(user),
    [user],
  );

  const rutas = useMemo(
    () => [...MENU.filter((e) => esVisibleEntrada(e, user)), ...grupos.flatMap((g) => g.entradas)],
    [grupos, user],
  );
  const rutaActiva = entradaActiva(ruta, rutas);
  // La categoría de la pantalla actual: la de su panel o la de una de sus opciones.
  const grupoDeRuta =
    grupos.find((g) => rutaPanel(g) === ruta || g.entradas.some((e) => e.to === rutaActiva))
      ?.id ?? null;

  // Categoría abierta. Arranca en la de la pantalla actual.
  const [abierta, setAbierta] = useState<string | null>(grupoDeRuta);

  // Al cambiar de ruta, la barra sigue a la pantalla: ajuste de estado durante
  // el render (el patrón que documenta React, en vez de un `useEffect`). En el
  // inicio vuelve a las categorías; en pantallas sin categoría (mi perfil,
  // notificaciones) se queda como estaba.
  const [rutaPrevia, setRutaPrevia] = useState(ruta);
  if (ruta !== rutaPrevia) {
    setRutaPrevia(ruta);
    if (grupoDeRuta !== null) setAbierta(grupoDeRuta);
    else if (ruta === "/") setAbierta(null);
  }

  // Si la navegación pedida nunca llegó (la frenó otra cosa), la barra vuelve
  // a mostrar dónde se está de verdad.
  useEffect(() => {
    if (pendiente === null) return;
    const espera = window.setTimeout(() => setPendiente(null), 5000);
    return () => window.clearTimeout(espera);
  }, [pendiente]);

  /* ───────────── Animación (ver el comentario de arriba) ───────────── */

  const listaRef = useRef<HTMLDivElement>(null);
  const indicadorRef = useRef<HTMLDivElement>(null);
  const centroRef = useRef<HTMLDivElement>(null);
  const derechaRef = useRef<HTMLDivElement>(null);
  /** Dónde estaba cada pieza la última vez. `null` hasta el primer render. */
  const medidasRef = useRef<Map<string, Medida> | null>(null);
  const cajaRef = useRef<Caja | null>(null);
  const abiertaPreviaRef = useRef(abierta);

  /** Deja el indicador en su lugar, sin animar. */
  const colocarIndicador = useCallback((caja: Caja | null) => {
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
    const lista = listaRef.current;
    const indicador = indicadorRef.current;
    const centro = centroRef.current;
    const derecha = derechaRef.current;
    if (!lista || !indicador || !centro || !derecha) return;

    // Un fundido de salida que haya quedado puesto se corta. Las demás
    // animaciones en curso se dejan terminar: este efecto puede correr más de
    // una vez por navegación y no tiene que interrumpir lo que ya empezó.
    const piezas = piezasDe(lista);

    const nuevas = medir(lista);
    const previas = medidasRef.current;
    const cajaPrevia = cajaRef.current;
    const caja = cajaDeLaActiva(lista);
    const cambioDeNivel = abiertaPreviaRef.current !== abierta;
    medidasRef.current = nuevas;
    cajaRef.current = caja;
    abiertaPreviaRef.current = abierta;
    colocarIndicador(caja);

    // Primer render, o el usuario pidió menos movimiento: sin animación.
    if (!previas || sinMovimiento()) return;

    if (cambioDeNivel) {
      // Otra lista de pestañas: nada se arrastra de la posición vieja. Todo
      // el nivel nuevo queda visible y emerge apenas desde abajo en su lugar.
      for (const el of piezas) {
        el.animate(
          [
            { opacity: 0, transform: "translateY(8px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: DURACION_APARECER, easing: CURVA_PESTANA, fill: "backwards" },
        );
      }
      if (caja) {
        // La nueva activa: su fondo blanco emerge con ella, en su lugar.
        const t = tramos(caja);
        indicador.animate(
          [
            { opacity: 0, transform: `${t.todo} translateY(8px)` },
            { opacity: 1, transform: t.todo },
          ],
          { duration: DURACION_APARECER, easing: CURVA_PESTANA },
        );
      } else if (cajaPrevia) {
        // Al Inicio (no es una pestaña): el fondo blanco baja y se desvanece
        // donde estaba, sin viajar hacia el logo.
        const t = tramos(cajaPrevia);
        indicador.animate(
          [
            { opacity: 1, transform: t.todo },
            { opacity: 0, transform: `${t.todo} translateY(100%)` },
          ],
          { duration: DURACION_OCULTAR, easing: "ease-in" },
        );
      }
      return;
    }

    const tiempo = { duration: DURACION_PESTANA, easing: CURVA_PESTANA };

    const activa = lista.querySelector<HTMLElement>("[data-activa]");
    let dxActiva = 0;
    let entrantes = 0;

    for (const el of piezas) {
      const clave = el.dataset.pieza as string;
      const nueva = nuevas.get(clave) as Medida;
      const previa = previas.get(clave);

      if (!previa) {
        // Pieza nueva dentro del mismo nivel: aparece, una detrás de otra.
        el.animate(
          [
            { opacity: 0, transform: "translateX(12px)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: 280,
            delay: entrantes * 35,
            easing: CURVA_PESTANA,
            fill: "backwards",
          },
        );
        entrantes += 1;
        continue;
      }

      const dx = previa.x - nueva.x;
      const dy = previa.y - nueva.y;
      if (el === activa) dxActiva = dx;
      // Sigue estando: viaja de donde estaba a donde quedó.
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
          tiempo,
        );
      }
      // Pasó a ser (o dejó de ser) la seleccionada: se funde de una capa de
      // texto a la otra, al ritmo del fondo blanco.
      if (previa.activa !== nueva.activa) {
        el.querySelector('[data-capa="clara"]')?.animate(
          [{ opacity: previa.activa ? 0 : 1 }, { opacity: nueva.activa ? 0 : 1 }],
          tiempo,
        );
        el.querySelector('[data-capa="oscura"]')?.animate(
          [{ opacity: previa.activa ? 1 : 0 }, { opacity: nueva.activa ? 1 : 0 }],
          tiempo,
        );
      }
    }

    if (caja && cajaPrevia) {
      if (caja.x === cajaPrevia.x && caja.ancho === cajaPrevia.ancho) return;
      // De una pestaña a otra: el fondo blanco se desliza y se ajusta. Los
      // tres tramos comparten duración y curva, así que no se despegan.
      const desde = tramos(cajaPrevia);
      const hasta = tramos(caja);
      indicador.animate([{ transform: desde.todo }, { transform: hasta.todo }], tiempo);
      centro.animate([{ transform: desde.centro }, { transform: hasta.centro }], tiempo);
      derecha.animate([{ transform: desde.derecha }, { transform: hasta.derecha }], tiempo);
    } else if (caja) {
      // No había selección: aparece acompañando a la pestaña que llega.
      indicador.animate(
        [
          { opacity: 0, transform: `translateX(${caja.x + dxActiva}px)` },
          { opacity: 1, transform: `translateX(${caja.x}px)` },
        ],
        tiempo,
      );
    } else if (cajaPrevia) {
      indicador.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DURACION_SALIDA });
    }
  }, [abierta, ruta, grupos, colocarIndicador]);

  /*
   * Desborde de la barra: las pestañas que no entran se alcanzan
   * desplazando de costado, con la barra de scroll oculta. Sin una pista, la
   * última quedaba cortada al ras ("Consultar docume") y no se notaba que
   * había más. Se desvanece el borde por el que sigue habiendo pestañas.
   */
  const [desborde, setDesborde] = useState({ izq: false, der: false });
  const medirDesborde = useCallback(() => {
    const lista = listaRef.current;
    if (!lista) return;
    const izq = lista.scrollLeft > 1;
    const der = lista.scrollLeft + lista.clientWidth < lista.scrollWidth - 1;
    setDesborde((p) => (p.izq === izq && p.der === der ? p : { izq, der }));
  }, []);
  const mascara =
    desborde.izq || desborde.der
      ? `linear-gradient(to right, ${desborde.izq ? "transparent, black 40px" : "black"}, ${
          desborde.der ? "black calc(100% - 40px), transparent" : "black"
        })`
      : undefined;

  /** Desplaza la barra casi un ancho visible hacia un lado (-1 izq, 1 der). */
  const desplazar = useCallback((sentido: -1 | 1) => {
    const lista = listaRef.current;
    if (!lista) return;
    lista.scrollBy({ left: sentido * lista.clientWidth * 0.7, behavior: "smooth" });
  }, []);

  // La rueda vertical del mouse desplaza la barra de costado cuando desborda
  // (sin esto, solo se llegaba con trackpad). Listener no pasivo para poder
  // evitar que además se mueva la página.
  useEffect(() => {
    const lista = listaRef.current;
    if (!lista) return;
    const alGirar = (e: WheelEvent) => {
      if (lista.scrollWidth <= lista.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      lista.scrollLeft += e.deltaY;
    };
    lista.addEventListener("wheel", alGirar, { passive: false });
    return () => lista.removeEventListener("wheel", alGirar);
  }, []);

  // Si cambia el ancho (ventana, buscador desplegado), el indicador se
  // reacomoda sin animar y las medidas se toman de nuevo.
  useLayoutEffect(() => {
    const lista = listaRef.current;
    if (!lista) return;
    const observador = new ResizeObserver(() => {
      const caja = cajaDeLaActiva(lista);
      cajaRef.current = caja;
      colocarIndicador(caja);
      medidasRef.current = medir(lista);
      medirDesborde();
    });
    observador.observe(lista);
    return () => observador.disconnect();
  }, [colocarIndicador, medirDesborde]);

  // Al cambiar de pantalla, si la pestaña activa quedó fuera de la parte
  // visible (barra con más opciones de las que entran), se la trae a la vista.
  useEffect(() => {
    const lista = listaRef.current;
    if (!lista) return;
    const activa = lista.querySelector<HTMLElement>('[aria-current="page"]');
    if (activa) {
      const izq = activa.offsetLeft - RADIO;
      const der = activa.offsetLeft + activa.offsetWidth + RADIO;
      if (izq < lista.scrollLeft) lista.scrollLeft = izq;
      else if (der > lista.scrollLeft + lista.clientWidth) {
        lista.scrollLeft = der - lista.clientWidth;
      }
    }
    medirDesborde();
  }, [abierta, ruta, medirDesborde]);

  /**
   * Clic en un enlace de la barra. Primero se mueve la barra (que pasa a
   * mostrar `destino` como ruta pendiente) y un instante después se pide la
   * pantalla.
   */
  const ir: AlIr = (e, destino) => {
    // Abrir en otra pestaña / ventana: lo resuelve el navegador.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (destino === ruta) return;

    const avanzar = () => {
      setPendiente(destino === pathname ? null : destino);
      window.setTimeout(() => navigate(destino), ESPERA_NAVEGAR);
    };

    // También en un cambio de nivel se navega enseguida: las pestañas de la
    // barra no se desvanecen antes (quedaba sola la categoría elegida, pegada
    // al logo); el nivel nuevo emerge en su lugar (ver el efecto de arriba).
    avanzar();
  };

  // Va después de los hooks a propósito (un return temprano antes rompe el
  // orden de hooks).
  if (!user) return <Navigate to="/login" replace />;

  const grupoAbierto = grupos.find((g) => g.id === abierta) ?? null;
  const enPanel = grupoAbierto !== null && rutaPanel(grupoAbierto) === ruta;
  const IconoAbierto = grupoAbierto?.icon;

  return (
    // Va dentro de la barra superior (`BarraSuperior`), entre el logo y las
    // herramientas: ocupa el espacio libre y, si las pestañas no entran,
    // scrollea de costado en vez de partirse en dos renglones.
    <Box as="nav" aria-label="Menú principal" color="white" flex="1" minW={0} alignSelf="stretch" position="relative">
      <Flex
        as="ul"
        ref={listaRef}
        position="relative"
        listStyleType="none"
        m={0}
        p={0}
        align="center"
        // Las categorías van centradas en la barra; al abrir una, la barra se
        // acomoda a la izquierda, pegada al logo. "safe" evita que, si no
        // entran, las primeras queden fuera del alcance del scroll.
        justify={grupoAbierto === null ? "safe center" : "flex-start"}
        gap="1"
        h="full"
        // Lugar para la curva de la pestaña seleccionada cuando es la primera
        // o la última (la lista recorta lo que se sale por el scroll).
        px={`${RADIO}px`}
        overflowX="auto"
        overflowY="hidden"
        onScroll={medirDesborde}
        css={{
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          maskImage: mascara,
          WebkitMaskImage: mascara,
        }}
      >
        {/*
          Fondo de la pestaña seleccionada, como la de un navegador: llega
          hasta el pie de la barra y toma el color de lo que hay debajo, así
          parece una sola pieza con la página. Las esquinas de arriba son
          redondeadas y las de abajo se abren con una curva hacia los
          costados. Dónde va y cuánto mide lo pone el efecto de animación,
          solo con `transform` (ver el comentario de "Animación").
        */}
        <Box
          as="li"
          ref={indicadorRef}
          aria-hidden
          position="absolute"
          top={`${TOPE_INDICADOR}px`}
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
          <Box {...TRAMO} w={`${RADIO}px`} roundedTopLeft="lg" _before={curva("left")} />
          <Box
            ref={derechaRef}
            {...TRAMO}
            w={`${RADIO}px`}
            roundedTopRight="lg"
            _after={curva("right")}
          />
        </Box>

        {grupoAbierto === null ? (
          grupos.map((grupo) => (
            <Box as="li" key={grupo.id}>
              <PestanaCategoria
                grupo={grupo}
                destino={destinoCategoria(grupo, user)}
                contieneRutaActual={grupo.id === grupoDeRuta}
                onIr={ir}
              />
            </Box>
          ))
        ) : (
          <>
            {/* Flecha: vuelve a la pantalla anterior tal como estaba (filtros
                incluidos), como la del navegador. Sin pantalla anterior en la
                app, va al inicio, donde la barra muestra las categorías. */}
            <Box as="li" flexShrink={0}>
              <Link
                asChild
                aria-label="Volver"
                title="Volver"
                {...pestana(false)}
                alignItems="center"
                justifyContent="center"
                boxSize="9"
              >
                <NavLink
                  to="/"
                  data-pieza="flecha"
                  onClick={(e) => {
                    if (hayPantallaAnterior() && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                      e.preventDefault();
                      navigate(-1);
                    } else {
                      ir(e, "/");
                    }
                  }}
                >
                  <LuArrowLeft size={20} aria-hidden />
                </NavLink>
              </Link>
            </Box>

            {/*
              Nombre de la categoría: lleva a su panel. Es la pestaña
              seleccionada mientras se está en el panel; al entrar a una de sus
              pantallas, la selección pasa a esa opción. Tiene la misma forma
              que en la fila de categorías (ícono incluido) para que la
              animación la traslade sin deformarla.
            */}
            {vePaneles(user) && (
              <Box as="li" flexShrink={0}>
                <Link
                  asChild
                  aria-current={enPanel ? "page" : undefined}
                  title={`Panel de ${grupoAbierto.label}`}
                  {...pestana(enPanel)}
                  {...CATEGORIA}
                >
                  <NavLink
                    to={rutaPanel(grupoAbierto)}
                    data-pieza={clavePanel(grupoAbierto.id)}
                    data-activa={enPanel ? "" : undefined}
                    onClick={(e) => ir(e, rutaPanel(grupoAbierto))}
                  >
                    <Capas activa={enPanel} {...CAPAS_CATEGORIA}>
                      {IconoAbierto && (
                        <IconoAbierto size={20} aria-hidden style={{ flexShrink: 0 }} />
                      )}
                      {grupoAbierto.label}
                    </Capas>
                  </NavLink>
                </Link>
              </Box>
            )}

            <Box
              as="li"
              data-pieza="separador"
              aria-hidden
              flexShrink={0}
              w="1px"
              h="7"
              bg="whiteAlpha.400"
              mx="1"
            />

            {grupoAbierto.entradas.map((entrada) => (
              <Box as="li" key={entrada.to}>
                <PestanaOpcion entrada={entrada} activa={entrada.to === rutaActiva} onIr={ir} />
              </Box>
            ))}
          </>
        )}
      </Flex>
      {/* Flechas sobre el borde que desborda: con el mouse no hay scroll
          horizontal a mano, y el desvanecido solo no alcanzaba (la última
          pestaña quedaba tapada sin forma evidente de llegar). */}
      {desborde.izq && <FlechaDesborde lado="izq" onClick={() => desplazar(-1)} />}
      {desborde.der && <FlechaDesborde lado="der" onClick={() => desplazar(1)} />}
    </Box>
  );
}

function FlechaDesborde({ lado, onClick }: { lado: "izq" | "der"; onClick: () => void }) {
  const Icono = lado === "izq" ? LuChevronLeft : LuChevronRight;
  return (
    <chakra.button
      type="button"
      aria-label={lado === "izq" ? "Ver opciones anteriores del menú" : "Ver más opciones del menú"}
      title={lado === "izq" ? "Opciones anteriores" : "Más opciones"}
      onClick={onClick}
      position="absolute"
      top="50%"
      transform="translateY(-50%)"
      {...(lado === "izq" ? { left: "0" } : { right: "0" })}
      display="flex"
      alignItems="center"
      justifyContent="center"
      w="7"
      h="7"
      rounded="full"
      bg="blackAlpha.500"
      color="white"
      cursor="pointer"
      _hover={{ bg: "blackAlpha.700" }}
      zIndex={1}
    >
      <Icono aria-hidden />
    </chakra.button>
  );
}
