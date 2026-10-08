import { useMemo, useState } from "react";
import { Navigate, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { puedeAdministrar, puedeOperar } from "../api/permissions";
import { BotonNotificaciones } from "../../features/notificaciones/components/BotonNotificaciones";
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
  LuChevronDown,
  LuClipboardCheck,
  LuDatabase,
  LuShieldCheck,
} from "react-icons/lu";

/**
 * Cada entrada del menú. La visibilidad por rol se declara acá, en el
 * dato: el mismo elemento es la fuente de verdad del render y puede servir
 * de base para tests de cobertura de rutas. Antes había 15 <Link> copiados
 * a mano: agregar una sección implicaba tocar el render del Navbar y el
 * router por separado, y se desincronizaban.
 */
type RolMenu = "todos" | "operar" | "administrar";

interface EntradaMenu {
  to: string;
  label: string;
  rol: RolMenu;
}

interface GrupoMenu {
  id: string;
  label: string;
  /** Descripción corta que se lee bajo el título del grupo. */
  ayuda: string;
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
    entradas: [
      { to: "/equipos", label: "Equipos", rol: "administrar" },
      { to: "/personal", label: "Personal", rol: "administrar" },
      { to: "/unidades-medida", label: "Unidades de Medida", rol: "administrar" },
      { to: "/insumos", label: "Insumos", rol: "administrar" },
      { to: "/insumos-quimicos", label: "Insumos Químicos", rol: "administrar" },
      { to: "/aptitudes", label: "Aptitudes", rol: "administrar" },
      { to: "/documentos", label: "Documentos", rol: "administrar" },
    ],
  },
  {
    id: "operaciones",
    label: "Operaciones",
    ayuda: "Trabajo diario",
    entradas: [
      { to: "/checklist", label: "Checklist Diario", rol: "operar" },
      { to: "/incidentes/reportar", label: "Reportar Incidente", rol: "operar" },
      { to: "/incidentes", label: "Gestión de Incidentes", rol: "administrar" },
      { to: "/planes-limpieza", label: "Planes de Limpieza", rol: "administrar" },
      {
        to: "/planes-calibracion-mantenimiento",
        label: "Calibración/Mantenimiento",
        rol: "administrar",
      },
      { to: "/elementos-limpieza", label: "Elementos de Limpieza", rol: "administrar" },
      { to: "/checklist/historial", label: "Historial de Checklists", rol: "administrar" },
      { to: "/consumo-productos", label: "Consumo de Productos", rol: "administrar" },
      { to: "/consulta-documentos", label: "Consultar Documentos", rol: "operar" },
    ],
  },
];

/** Enlaces sueltos, fuera de cualquier grupo. */
const MENU: EntradaMenu[] = [{ to: "/", label: "Inicio", rol: "todos" }];

function esVisibleEntrada(
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
    if (entrada.to === "/") continue;
    const coincide =
      pathname === entrada.to || pathname.startsWith(`${entrada.to}/`);
    if (coincide && (mejor === null || entrada.to.length > mejor.length)) {
      mejor = entrada.to;
    }
  }

  return mejor;
}

interface NavItemProps {
  entrada: EntradaMenu;
  activa: boolean;
  /** Los ítems de un grupo van sangrados bajo el título. */
  anidado?: boolean;
}

function NavItem({ entrada, activa, anidado }: NavItemProps) {
  return (
    // `Link asChild` en vez de `Box as={NavLink}`: el tipado polimórfico de Box
    // no conoce las props del NavLink de react-router y el `to` no compila.
    <Link
      asChild
      aria-current={activa ? "page" : undefined}
      display="block"
      /*
       * Sangría de las opciones dentro de un grupo.
       *
       * Se corre la fila entera, no solo el texto: `mx="2"` corre también la
       * píldora blanca del ítem activo, así deja de arrancar en el mismo x que
       * la fila del desplegable y las dos se distinguen por la forma y no solo
       * por el texto.
       *
       * El ancho del sidebar acompaña porque hace falta: "Calibración/
       * Mantenimiento" mide 186px de texto, y a 260px de sidebar con esta
       * sangría el nombre se recortaba con puntos suspensivos. A 280px quedan
       * 204px útiles.
       */
      mx={anidado ? "2" : undefined}
      pl={anidado ? "6" : "3"}
      pr="3"
      py="3"
      rounded="md"
      fontSize="sm"
      fontWeight={activa ? "bold" : "medium"}
      textDecoration="none"
      whiteSpace="nowrap"
      overflow="hidden"
      textOverflow="ellipsis"
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
        outlineOffset: "2px",
      }}
    >
      <NavLink to={entrada.to}>{entrada.label}</NavLink>
    </Link>
  );
}

interface NavGroupProps {
  grupo: GrupoMenu;
  rutaActiva: string | null;
  abierto: boolean;
  onToggle: () => void;
}

function NavGroup({ grupo, rutaActiva, abierto, onToggle }: NavGroupProps) {
  // Punto activo para marcar el grupo con el puntito. Que abra solo lo decide
  // el padre: si contiene la ruta activa siempre está abierto.
  const contieneActiva = grupo.entradas.some((e) => e.to === rutaActiva);

  return (
    <Collapsible.Root open={abierto} onOpenChange={onToggle}>
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
        width="100%"
        display="flex"
        alignItems="center"
        gap="2"
        px="3"
        pt="4"
        pb="2"
        rounded="md"
        _hover={{ bg: "whiteAlpha.100" }}
        _focusVisible={{
          outline: "2px solid",
          outlineColor: "white",
          outlineOffset: "-2px",
        }}
      >
        {grupo.id === "maestros" ? (
          <LuDatabase size={15} aria-hidden />
        ) : (
          <LuClipboardCheck size={15} aria-hidden />
        )}
        {/*
          Sin `uppercase`: los títulos de la app van en caja normal (el resto
          de la barra y todos los encabezados). Mayúsculas y `letterSpacing`
          solo iban acá y rompían la lectura en horizontal.
        */}
        <Text as="span" fontSize="sm" fontWeight="bold" color="whiteAlpha.900">
          {grupo.label}
        </Text>
        {contieneActiva ? (
          <Box w="6px" h="6px" rounded="full" bg="white" aria-hidden />
        ) : null}
        <Box
          ml="auto"
          transitionProperty="transform"
          transitionDuration="fast"
          transform={abierto ? "rotate(0deg)" : "rotate(-90deg)"}
        >
          <LuChevronDown size={14} aria-hidden />
        </Box>
      </Collapsible.Trigger>

      {/*
        `inert` mientras está colapsado: Ark colapsa con `height: 0` pero deja
        los links en el DOM sin `hidden`, así que quedaban enfocables con el
        teclado siendo invisibles — el foco se iba a una sección que no se
        veía. `inert` los saca del tab order y del árbol de accesibilidad.
      */}
      <Collapsible.Content inert={!abierto}>
        <Stack as="ul" gap="1" listStyleType="none" p={0} m={0}>
          {grupo.entradas.map((entrada) => (
            <Box as="li" key={entrada.to}>
              <NavItem entrada={entrada} activa={entrada.to === rutaActiva} anidado />
            </Box>
          ))}
        </Stack>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  /*
   * Grupos que el usuario cerró a mano.
   *
   * Se guarda lo que el usuario collapsed y NO un booleano por grupo: un grupo
   * está abierto si contiene la ruta activa o si nunca se lo cerró. Así
   * navegar a otra sección la abre sola sin necesidad de un `useEffect` que
   * synchronize estado (que además dispara un render de más).
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
  /*
   * Se inicializa con el grupo YA visto en `grupoDeRutaActual` a propósito:
   * si arrancara en `null`, el ajuste de estado de abajo se dispararía en el
   * primer render y abriría el grupo de la ruta actual, que es justo lo que
   * se pidió evitar. Quedan todos colapsados al entrar, y el grupo se abre
   // solo cuando la navegación cambia.
   */
  const [grupoYaVisto, setGrupoYaVisto] = useState<string | null>(grupoDeRutaActual);

  /*
   * Abrir el grupo de la sección a la que se navega, ajustando estado durante
   * el render: es el patrón que React documenta para derivar estado de props,
   * y evita el `useEffect` equivalente.
   *
   * Se hacía al revés —dejar siempre abierto el grupo de la ruta activa— y
   * dejaba una interacción muerta: parado en "Datos maestros > Equipos", tocar
   * el encabezado no hacía nada.
   */
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

  // EL CANDADO: Si no hay nadie logueado, lo mandamos al Login.
  // Va después de los hooks a propósito: un return temprano antes de un
  // `useMemo` rompe el orden de hooks y la app crashea al cambiar de sesión.
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
      // brand.700 en vez de brand.500: el blanco sobre brand.500 da 4.4:1 y
      // queda justo por debajo del 4.5:1 que pide WCAG AA para texto normal.
      // Sobre brand.700 da 6.4:1.
      bg="brand.700"
      color="white"
      w="280px"
      h="100vh"
      position="sticky"
      top={0}
      flexShrink={0}
      flexDirection="column"
      boxShadow="2px 0 5px rgba(0, 0, 0, 0.1)"
    >
      {/* LOGO, TÍTULO Y BOTÓN DE NOTIFICACIONES */}
      <Flex
        align="center"
        justify="space-between"
        gap="2"
        px="5"
        pt="5"
        pb="3"
        flexShrink={0}
      >
        <Flex align="center" gap="3">
          <LuShieldCheck size={28} color="brand.100" aria-hidden />
          <Heading as="h2" size="lg" letterSpacing="wider">
            SAIA
          </Heading>
        </Flex>
        {puedeAdministrar(user) && <BotonNotificaciones />}
      </Flex>

      {/*
        El área de enlaces scrollea. Los grupos resuelven la cantidad de
        entradas, pero el scroll queda como red de seguridad: con muchos
        permisos o con el panel chico nunca debería quedar un enlace
        inalcanzable.
      */}
      <Box
        as="ul"
        listStyleType="none"
        p="3"
        m={0}
        flex="1"
        overflowY="auto"
        scrollbarWidth="thin"
        scrollbarColor="whiteAlpha.400 transparent"
      >
        {entradas.map((entrada) => (
          <Box as="li" key={entrada.to} mb="1">
            <NavItem
              entrada={entrada}
              activa={entrada.to === rutaActiva}
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
            />
          </Box>
        ))}
      </Box>

      {/* --- BOTÓN DE CERRAR SESIÓN --- */}
      <Box px="3" pb="4" pt="2" flexShrink={0}>
        <Text fontSize="xs" color="whiteAlpha.800" px="2" mb="1">
          {user.nombre} {user.apellido}
        </Text>
        {/*
          Sin `colorPalette`: la variante `outline` de Chakra usa
          `colorPalette.fg` para el texto, y en modo claro eso es rojo
          oscuro (`red.700`). Sobre el teal del sidebar daba 1.31:1, o sea
          un botón que no se leía. Acá los colores van explícitos porque el
          sidebar es una superficie oscura y no responde a los tokens de
          superficie clara.
        */}
        <Button
          size="sm"
          h="auto"
          py="3"
          w="100%"
          variant="outline"
          bg="transparent"
          color="white"
          borderColor="whiteAlpha.500"
          rounded="md"
          fontWeight="bold"
          _hover={{ bg: "whiteAlpha.200", color: "white" }}
          _focusVisible={{
            outline: "2px solid",
            outlineColor: "white",
            outlineOffset: "2px",
          }}
          onClick={logout}
        >
          Cerrar sesión
        </Button>
      </Box>
    </Flex>
  );
}