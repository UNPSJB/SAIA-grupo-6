import { useMemo, useState, useEffect } from "react";
import { Navigate, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { puedeAdministrar, puedeOperar } from "../api/permissions";
import {
  Box,
  Button,
  Collapsible,
  Flex,
  Heading,
  Link,
  Stack,
  Text,
} from "@chakra-ui/react";
import {
  LuBadgeCheck,
  LuMapPin,
  LuBrush,
  LuCalendarClock,
  LuChartPie,
  LuChevronDown,
  LuClipboardCheck,
  LuClipboardList,
  LuDatabase,
  LuFileText,
  LuFlaskConical,
  LuFolderSearch,
  LuHistory,
  LuHouse,
  LuListChecks,
  LuMicroscope,
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuPackage,
  LuRuler,
  LuShieldCheck,
  LuSparkles,
  LuTriangleAlert,
  LuUserRound,
  LuUsers,
  LuWrench,
} from "react-icons/lu";
import type { IconType } from "react-icons/lib";

/**
 * Cada entrada del menú. La visibilidad por rol se declara acá, en el
 * dato: el mismo elemento es la fuente de verdad del render y puede servir
 * de base para tests de cobertura de rutas. Antes había 15 <Link> copiados
 * a mano: agregar una sección implicaba tocar el render del Navbar y el
 * router por separado, y se desincronizaban.
 */
type RolMenu = "todos" | "operar" | "administrar";

export interface EntradaMenu {
  to: string;
  label: string;
  rol: RolMenu;
  /**
   * Ícono de la entrada.
   *
   * Antes el `NavItem` solo pintaba el texto, así que con el sidebar colapsado
   * a una barra de íconos las opciones quedaban sin nada que mostrar. Va en el
   * dato y no hardcodeado en el render para que agregar una sección sea
   * siempre una línea.
   */
  icon: IconType;
}

interface GrupoMenu {
  id: string;
  label: string;
  /** Descripción corta que se lee bajo el título del grupo. */
  ayuda: string;
  /** Ícono del grupo: con el sidebar colapsado es el separador de sección. */
  icon: IconType;
  entradas: EntradaMenu[];
}

/**
 * Secciones del sidebar.
 *
 * Antes eran 17 enlaces en una sola lista plana. Con el panel completo no
 * entraban todos sin zoom out y, peor, no había forma de hacer scroll: los
 * últimos (Gestión de Incidentes, Documentos) quedaban inalcanzables en
 * pantallas de notebook.
 *
 * La división es por naturaleza del dato, no por módulo:
 *
 *   - Datos maestros: el catálogo que se carga una vez y cambia poco
 *     (equipos, personal, unidades, insumos, aptitudes, documentos).
 *   - Operaciones: lo que se consulta todos los días (checklists,
 *     incidentes, planes, calibraciones, historial, consumo).
 */
const GRUPOS: GrupoMenu[] = [
  {
    id: "maestros",
    label: "Datos maestros",
    ayuda: "Catálogos y configuración",
    icon: LuDatabase,
    entradas: [
      { to: "/equipos", label: "Equipos", rol: "administrar", icon: LuMicroscope },
      { to: "/personal", label: "Personal", rol: "administrar", icon: LuUsers },
      {
        to: "/unidades-medida",
        label: "Unidades de Medida",
        rol: "administrar",
        icon: LuRuler,
      },
      { to: "/insumos", label: "Insumos", rol: "administrar", icon: LuPackage },
      {
        to: "/insumos-quimicos",
        label: "Insumos Químicos",
        rol: "administrar",
        icon: LuFlaskConical,
      },
      {
        to: "/elementos-limpieza",
        label: "Elementos de Limpieza",
        rol: "administrar",
        icon: LuBrush,
      },
      { to: "/aptitudes", label: "Aptitudes", rol: "administrar", icon: LuBadgeCheck },
      { to: "/sectores", label: "Sectores", rol: "administrar", icon: LuMapPin },
      { to: "/documentos", label: "Documentos", rol: "administrar", icon: LuFileText },
    ],
  },
  {
    id: "operaciones",
    label: "Operaciones",
    ayuda: "Trabajo diario",
    icon: LuClipboardCheck,
    entradas: [
      { to: "/checklist", label: "Checklist Diario", rol: "operar", icon: LuListChecks },
      {
        to: "/incidentes/reportar",
        label: "Reportar Incidente",
        rol: "operar",
        icon: LuTriangleAlert,
      },
      {
        to: "/incidentes",
        label: "Gestión de Incidentes",
        rol: "administrar",
        icon: LuClipboardList,
      },
      {
        to: "/planes-limpieza",
        label: "Planes de Limpieza",
        rol: "administrar",
        icon: LuSparkles,
      },
      {
        to: "/planes-calibracion-mantenimiento",
        label: "Calibración/Mantenimiento",
        rol: "administrar",
        icon: LuWrench,
      },
      {
        to: "/checklist/historial",
        label: "Historial de Checklists",
        rol: "administrar",
        icon: LuHistory,
      },
      {
        to: "/vencimientos",
        label: "Vencimientos",
        rol: "administrar",
        icon: LuCalendarClock,
      },
      {
        to: "/consumo-productos",
        label: "Consumo de Productos",
        rol: "administrar",
        icon: LuChartPie,
      },
      {
        to: "/consulta-documentos",
        label: "Consultar Documentos",
        rol: "operar",
        icon: LuFolderSearch,
      },
    ],
  },
];

/** Enlaces sueltos, fuera de cualquier grupo. */
const MENU: EntradaMenu[] = [
  /*
   * Va primero en la lista —entre el botón de plegar y "Inicio"— para que
   * quede fijo arriba del todo: es la entrada más personal de la barra y no
   * debería scrollearse nunca.
   */
 // { to: "/mi-perfil", label: "Mi perfil", rol: "todos", icon: LuUserRound },
  { to: "/", label: "Inicio", rol: "todos", icon: LuHouse },
];

export const TODAS_LAS_ENTRADAS: EntradaMenu[] = [
  ...MENU,
  ...GRUPOS.flatMap((g) => g.entradas),
];

/** Ancho del sidebar según el estado. */
const ANCHO_EXPANDIDO_PX = 280;
const ANCHO_COLAPSADO_PX = 64;
const ANCHO_EXPANDIDO = `${ANCHO_EXPANDIDO_PX}px`;
/*
 * Se exporta porque el layout (`LayoutPrincipal`) reserva SIEMPRE este ancho
 * para el rail: la barra es overlay y el contenido no se reacomoda al
 * plegar/desplegar.
 */
export const ANCHO_COLAPSADO = `${ANCHO_COLAPSADO_PX}px`;

/*
 * Columna de íconos.
 *
 * Para que al plegar los logos no se muevan, el contenido es el mismo en los
 * dos modos y TODOS los íconos tienen que caer, ya desplegado, donde quedan
 * centrados en la barra plegada: a `ANCHO_COLAPSADO_PX / 2` = 32px del borde
 * izquierdo. Cada padding sale de ahí:
 *
 *   - Ítems:    (40px de fila útil [64 - 2×12 de la lista] - 18px de ícono) / 2
 *   - Grupos:   (40px - 16px de ícono) / 2
 *   - Escudo:   (64px - 28px de ícono) / 2
 *   - Plegar:   (64px - 34px de botón [18px de ícono + 2×8px de padding]) / 2
 *   - Logout:   (40px - 2px de borde - 18px de ícono) / 2
 *
 * Si se cambia el ancho plegado o el tamaño de algún ícono, hay que
 * recalcular el valor correspondiente.
 */
const PAD_ICONO_ITEM = "11px";
const PAD_ICONO_GRUPO = "12px";
const PAD_ESCUDO = "18px";
const PAD_BOTON_PLEGAR = "15px";

/**
 * Separación escudo → título.
 *
 * Con el gap de 12px que traía antes, la "S" de "SAIA" asomaba con la barra
 * plegada: el escudo arranca en `PAD_ESCUDO` (18px) y mide 28px, así que el
 * texto entraba en 18 + 28 + 12 = 58px, seis antes del corte de la barra de
 * 64px. Con 20px el título arranca en 66px — dos píxeles más allá del borde —
 * y queda entero fuera de la vista plegada.
 */
const GAP_ESCUDO_TITULO = "20px";

/**
 * Posición fija de la flecha del grupo, medida desde el borde izquierdo del
 * trigger con la barra desplegada: ancho - 24 (padding de la lista)
 * - 12 (padding derecho del trigger) - 14 (tamaño de la flecha).
 */
const LEFT_FLECHA = `${ANCHO_EXPANDIDO_PX - 24 - 12 - 14}px`;

/** Clave de `localStorage` para recordar el estado entre recargas. */
const CLAVE_COLAPSADO = "saia_nav_colapsado";

export function esVisibleEntrada(
  entrada: EntradaMenu,
  user: Parameters<typeof puedeOperar>[0]
): boolean {
  if (entrada.rol === "todos") return true;
  if (entrada.rol === "operar") return puedeOperar(user);
  return puedeAdministrar(user);
}

/**
 * Ruta activa del menú, de la más específica a la más general.
 *
 * `/checklist` y `/checklist/historial` son prefijos el uno del otro: con un
 * `startsWith` ingenuo, "/checklist" se marcaría activo también en la página de
 * historial. Ganarle a la entrada más larga resuelve el choque, y además no
 * marca `/incidentes` cuando se está en `/incidentes/reportar`.
 */
function entradaActiva(pathname: string, entradas: EntradaMenu[]): string | null {
  let mejor: string | null = null;

  for (const entrada of entradas) {
    /*
     * La raíz no puede participar del `startsWith` ("/" es prefijo de
     * absolutamente todo) pero sí del match exacto: en "/" la entrada activa
     * es "Inicio". Antes se la salteaba de raíz y el botón nunca quedaba
     * seleccionado.
     */
    const coincide =
      entrada.to === "/"
        ? pathname === "/"
        : pathname === entrada.to || pathname.startsWith(`${entrada.to}/`);
    if (coincide && (mejor === null || entrada.to.length > mejor.length)) {
      mejor = entrada.to;
    }
  }

  return mejor;
}

interface NavItemProps {
  entrada: EntradaMenu;
  activa: boolean;
  /**
   * Barra reducida. Solo agrega el tooltip nativo: el layout del ítem es el
   * mismo plegado y desplegado, así que ni el ícono ni el texto cambian al
   * animar.
   */
  colapsado?: boolean;
}

function NavItem({ entrada, activa, colapsado = false }: NavItemProps) {
  const Icono = entrada.icon;
  return (
    // `Link asChild` en vez de `Box as={NavLink}`: el tipado polimórfico de Box
    // no conoce las props del NavLink de react-router y el `to` no compila.
    <Link
      asChild
      aria-current={activa ? "page" : undefined}
      /*
       * El texto ya no se desmonta al plegar, así que el nombre accesible sale
       * del propio contenido y no hace falta `aria-label`. El `title` queda
       * para el tooltip cuando solo se ve el ícono.
       */
      title={colapsado ? entrada.label : undefined}
      display="flex"
      alignItems="center"
      gap="3"
      /*
       * Mismo padding en los dos modos. `PAD_ICONO_ITEM` deja el ícono
       * centrado en la barra plegada (40px de fila útiles, ícono de 18px), y
       * como no cambia al plegar, el ícono no se mueve ni un píxel: solo el
       * borde derecho del sidebar lo va destapando o cubriendo.
       */
      pl={PAD_ICONO_ITEM}
      pr="3"
      /*
       * Alto fijo para que la fila mida lo mismo con o sin texto visible.
       */
      h="11"
      py="3"
      rounded="md"
      fontSize="sm"
      fontWeight={activa ? "bold" : "medium"}
      textDecoration="none"
      whiteSpace="nowrap"
      /*
       * `overflow: hidden` + `nowrap`: mientras el sidebar se angosta la fila
       * se achica con él y el texto simplemente queda recortado, sin
       * reacomodarse ni saltar a otra línea.
       */
      overflow="hidden"
      // El activo invierte los colores en vez de usar un tinte: blanco sobre
      // brand.700 da 6.4:1, y es la única señal que sobrevive con brillo alto
      // y a simple vistazo.
      bg={activa ? "white" : "transparent"}
      color={activa ? "brand.700" : "white"}
      _hover={{
        bg: activa ? "white" : "whiteAlpha.200",
        color: activa ? "brand.700" : "white",
        textDecoration: "none",
      }}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: "white",
        outlineOffset: "-2px",
      }}
    >
      {/*
        Ícono y texto van DENTRO del `NavLink`, y el `NavLink` es el único
        hijo del `Link asChild`: `Slot` exige exactamente un hijo y, con dos,
        deja de componer y no renderiza ningún `<a>` (los enlaces desaparecían
        de la barra).

        `flexShrink: 0` en el ícono: un SVG dentro de un flex con
        `overflow: hidden` puede encogerse al achicarse la fila.
      */}
      <NavLink to={entrada.to}>
        <Icono size={18} aria-hidden style={{ flexShrink: 0 }} />
        {entrada.label}
      </NavLink>
    </Link>
  );
}

interface NavGroupProps {
  grupo: GrupoMenu;
  rutaActiva: string | null;
  abierto: boolean;
  onToggle: () => void;
  /** Barra reducida: solo cambia el tooltip, el layout es el mismo. */
  colapsado?: boolean;
}

function NavGroup({
  grupo,
  rutaActiva,
  abierto,
  onToggle,
  colapsado = false,
}: NavGroupProps) {
  const IconoGrupo = grupo.icon;

  const lista = (
    <Stack as="ul" gap="1" listStyleType="none" p={0} m={0}>
      {grupo.entradas.map((entrada) => (
        <Box as="li" key={entrada.to}>
          <NavItem
            entrada={entrada}
            activa={entrada.to === rutaActiva}
            colapsado={colapsado}
          />
        </Box>
      ))}
    </Stack>
  );

  return (
    <Collapsible.Root open={abierto} onOpenChange={onToggle}>
      {/*
        Separador de sección, y NO un borde del botón (con borde el trigger se
        veía como un botón con marco frente al resto de la barra, que es lisa).

        Sin márgenes laterales: ocupa el mismo ancho que las filas, así queda
        simétrico tanto en la barra desplegada como en la plegada.
      */}
      <Box borderTopWidth="1px" borderColor="whiteAlpha.200" mt="2" aria-hidden />

      {/*
        `Collapsible.Trigger` ya renderiza un <button>, así que lleva los
        props de layout directamente. Envolverlo en un `Flex as="button"` con
        `asChild` rompe el tipado (`type` no existe en FlexProps).
      */}
      <Collapsible.Trigger
        /*
         * `aria-expanded` explícito: en modo controlado el `aria-expanded` de
         * Ark queda clavado en "true" aunque el `data-state` sí cambie, así que
         * un lector de pantalla anunciaba la sección como abierta estando
         * cerrada. Como el estado lo tenemos arriba, se lo pasamos nosotros.
         */
        aria-expanded={abierto}
        title={
          colapsado
            ? `${grupo.label} (${abierto ? "ocultar" : "mostrar"})`
            : undefined
        }
        width="100%"
        display="flex"
        alignItems="center"
        /*
         * `gap` y `pl` calculados para que el ícono del grupo caiga en la
         * misma columna que los de las opciones (centro a 32px) y el título
         * arranque en la misma x que sus textos.
         */
        gap="13px"
        h="11"
        py="2"
        pl={PAD_ICONO_GRUPO}
        pr="3"
        /*
         * `relative` + `overflow hidden`: la flecha va en posición absoluta
         * (ver abajo) y el trigger se achica junto con la barra recortando
         * lo que queda fuera.
         */
        position="relative"
        overflow="hidden"
        whiteSpace="nowrap"
        rounded="md"
        border="none"
        _hover={{ bg: "whiteAlpha.100" }}
        _focusVisible={{
          outline: "2px solid",
          outlineColor: "white",
          outlineOffset: "-2px",
        }}
      >
        <IconoGrupo size={16} aria-hidden style={{ flexShrink: 0 }} />
        {/*
          Sin `uppercase`: los títulos de la app van en caja normal (el resto
          de la barra y todos los encabezados).
        */}
        <Text
          as="span"
          fontSize="sm"
          fontWeight="bold"
          color="whiteAlpha.900"
          flexShrink={0}
        >
          {grupo.label}
        </Text>
        {/*
          La flecha NO va con `ml="auto"`: pegada al borde derecho de la fila,
          se correría hacia la izquierda mientras la barra se angosta. Con
          `left` fijo (medido desde el ancho desplegado) se queda quieta y el
          borde del trigger la recorta. Gira con `transform`, así que la
          transición la hace el navegador sin JS.
        */}
        <Box
          position="absolute"
          top="calc(50% - 7px)"
          left={LEFT_FLECHA}
          display="flex"
          transitionProperty="transform"
          transitionDuration="fast"
          transform={abierto ? "rotate(0deg)" : "rotate(-90deg)"}
        >
          <LuChevronDown size={14} aria-hidden />
        </Box>
      </Collapsible.Trigger>

      {/*
        Despliegue animado con `grid-template-rows: 0fr → 1fr`.

        Es la forma de animar una altura que no se conoce de antemano sin
        medirla en JavaScript.

        Dos cosas que hubo que descartar antes, y por qué:

        - `Collapsible.Content`: mide el contenido y lo deja en la variable CSS
          `--height`, aplicando `height: var(--height)`. Esa medición da 0 en
          esta barra, así que el grupo abría (`aria-expanded="true"`) y abajo
          no se veía nada.
        - Animar `max-height` con el alto medido desde un `ResizeObserver`: la
          medida nunca llegaba al estado y el `max-height` se quedaba en 0.

        El hijo lleva `overflow: hidden` y **nada de `min-height: 0`**: con
        `min-height: 0` el `1fr` se resuelve contra cero y el grupo queda
        en 0px, que es el mismo síntoma.

        `inert` sigue haciendo falta: con la animación la lista sigue en el DOM
        con altura 0, y sin `inert` sus links serían enfocables sin verse y el
        foco se iría a una sección escondida.
      */}
      <Box
        display="grid"
        gridTemplateRows={abierto ? "1fr" : "0fr"}
        transitionProperty="grid-template-rows"
        transitionDuration="moderate"
        transitionTimingFunction="ease-in-out"
        inert={!abierto}
      >
        <Box overflow="hidden">{lista}</Box>
      </Box>
    </Collapsible.Root>
  );
}


function BotonPlegar({
  colapsado,
  onClick,
}: {
  colapsado: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="ghost"
      size="sm"
      aria-expanded={!colapsado}
      aria-label={colapsado ? "Desplegar el menú" : "Plegar el menú"}
      title={colapsado ? "Desplegar el menú" : "Plegar el menú"}
      minW="auto"
      w="auto"
      h="auto"
      px="2"
      py="2"
      // `bg` explícito: la variante `ghost` no queda transparente en reposo.
      bg="transparent"
      color="white"
      _hover={{ bg: "whiteAlpha.200" }}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: "white",
        outlineOffset: "-2px",
      }}
    >
      {colapsado ? (
        <LuPanelLeftOpen size={18} aria-hidden />
      ) : (
        <LuPanelLeftClose size={18} aria-hidden />
      )}
    </Button>
  );
}

export default function Navbar() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  /*
   * Sidebar reducido a barra de íconos.
   *
   * La barra es OVERLAY: fija a la izquierda y por encima del contenido, que
   * en el layout solo reserva el ancho del rail (`ANCHO_COLAPSADO`). Se
   * persiste en `localStorage` porque es una preferencia de la persona. Se
   * lee de forma tolerante: si el valor no es "0" se toma plegado.
   */
  const [colapsado, setColapsado] = useState(
    () => localStorage.getItem(CLAVE_COLAPSADO) !== "0"
  );

  /*
   * Con la barra en overlay, dejar el panel desplegado después de navegar es
   * dejar media vista tapada. Vuelve al rail en cada navegación, ajustando
   * estado durante el render (sin `useEffect`).
   */
  const [pathnamePrevio, setPathnamePrevio] = useState(pathname);
  if (pathname !== pathnamePrevio) {
    setPathnamePrevio(pathname);
    if (!colapsado) setColapsado(true);
  }

  // La preferencia se persiste en un efecto: pasan por acá tanto el botón de
  // plegar como el auto-colapso de arriba.
  useEffect(() => {
    localStorage.setItem(CLAVE_COLAPSADO, colapsado ? "1" : "0");
  }, [colapsado]);

  const alternarColapso = () => setColapsado((prev) => !prev);

  /*
   * Grupos que el usuario cerró a mano.
   *
   * Un grupo está abierto si contiene la ruta activa o si nunca se lo cerró.
   */
  const [cerrados, setCerrados] = useState<Set<string>>(
    () => new Set(GRUPOS.map((g) => g.id))
  );

  const entradas = useMemo(() => MENU.filter((e) => esVisibleEntrada(e, user)), [user]);
  const grupos = useMemo(
    () =>
      GRUPOS.map((g) => ({
        ...g,
        entradas: g.entradas.filter((e) => esVisibleEntrada(e, user)),
      }))
        // Un operador no ve "Datos maestros": el grupo queda vacío y no se
        // renderiza, para no dejar un título sin nada debajo.
        .filter((g) => g.entradas.length > 0),
    [user]
  );

  const rutas = useMemo(
    () => [...entradas, ...grupos.flatMap((g) => g.entradas)],
    [entradas, grupos]
  );
  const rutaActiva = entradaActiva(pathname, rutas);

  const grupoDeRutaActual =
    grupos.find((g) => g.entradas.some((e) => e.to === rutaActiva))?.id ?? null;

  // Se inicializa con el grupo YA visto a propósito: así los grupos quedan
  // colapsados al entrar y el grupo se abre solo cuando la navegación cambia.
  const [grupoYaVisto, setGrupoYaVisto] = useState<string | null>(grupoDeRutaActual);

  // Abrir el grupo de la sección a la que se navega, ajustando estado durante
  // el render (el patrón que React documenta, en vez de un `useEffect`).
  if (grupoDeRutaActual !== grupoYaVisto) {
    setGrupoYaVisto(grupoDeRutaActual);
    if (grupoDeRutaActual !== null) {
      setCerrados((prev) => {
        if (!prev.has(grupoDeRutaActual)) return prev;
        const next = new Set(prev);
        next.delete(grupoDeRutaActual);
        return next;
      });
    }
  }

  // EL CANDADO: si no hay nadie logueado, lo mandamos al Login.
  // Va después de los hooks a propósito (un return temprano antes de un
  // `useMemo` rompe el orden de hooks).
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const alternarGrupo = (id: string) =>
    setCerrados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  return (
    <Flex
      as="nav"
      id="menu-principal"
      bg="brand.700"
      color="white"
      w={colapsado ? ANCHO_COLAPSADO : ANCHO_EXPANDIDO}
      h="100vh"
      // OVERLAY: fija a la izquierda y por encima del contenido, que en
      // `LayoutPrincipal` reserva siempre el ancho del rail plegado.
      position="fixed"
      top={0}
      left={0}
      zIndex={30}
      flexDirection="column"
      // `overflow: hidden` es lo que hace la animación: el borde derecho de
      // la barra recorre el contenido, que no se mueve.
      overflow="hidden"
      transitionProperty="width"
      transitionDuration="moderate"
      transitionTimingFunction="ease-in-out"
      boxShadow={
        colapsado
          ? "1px 0 4px rgba(0, 0, 0, 0.15)"
          : "4px 0 16px rgba(0, 0, 0, 0.25)"
      }
    >
      {/* ESCUDO Y TÍTULO. Ancho fijo (el desplegado) para que nada se
          reacomode al plegar: el borde de la barra los recorta. */}
      <Flex
        align="center"
        w={ANCHO_EXPANDIDO}
        pl={PAD_ESCUDO}
        pr="5"
        h="16"
        flexShrink={0}
      >
        <Flex align="center" gap={GAP_ESCUDO_TITULO}>
          <LuShieldCheck
            size={28}
            color="brand.100"
            aria-hidden
            style={{ flexShrink: 0 }}
          />
          <Heading as="h2" size="lg" letterSpacing="wider" whiteSpace="nowrap">
            SAIA
          </Heading>
        </Flex>
      </Flex>

      {/* Botón de plegar/desplegar: mismo lugar en los dos modos. */}
      <Flex
        align="center"
        w={ANCHO_EXPANDIDO}
        h="10"
        pl={PAD_BOTON_PLEGAR}
        flexShrink={0}
      >
        <BotonPlegar colapsado={colapsado} onClick={alternarColapso} />
      </Flex>

      {/* Área de enlaces: scrollea como red de seguridad. */}
      <Box
        as="ul"
        listStyleType="none"
        p="3"
        m={0}
        flex="1"
        overflowY="auto"
        overflowX="hidden"
      >
        {entradas.map((entrada) => (
          <Box as="li" key={entrada.to} mb="1">
            <NavItem
              entrada={entrada}
              activa={entrada.to === rutaActiva}
              colapsado={colapsado}
            />
          </Box>
        ))}

        {grupos.map((grupo) => (
          <Box as="li" key={grupo.id} listStyleType="none">
            <NavGroup
              grupo={grupo}
              rutaActiva={rutaActiva}
              abierto={!cerrados.has(grupo.id)}
              onToggle={() => alternarGrupo(grupo.id)}
              colapsado={colapsado}
            />
          </Box>
        ))}
      </Box>
    </Flex>
  );
}
