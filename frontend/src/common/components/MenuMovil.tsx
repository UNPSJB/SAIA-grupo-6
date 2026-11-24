import { useMemo, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Box, Button, Drawer, Flex, IconButton, Link, Portal, Stack, Text } from "@chakra-ui/react";
import { LuChartColumn, LuChevronDown, LuMenu, LuMoon, LuSun, LuX } from "react-icons/lu";
import type { IconType } from "react-icons/lib";
import { useColorMode } from "../../components/ui/color-mode";
import { DEGRADADO_MARCA } from "../../theme";
import { useAuth } from "../context/useAuth";
import { LogoSaia } from "./LogoSaia";
import {
  MENU,
  entradaActiva,
  esVisibleEntrada,
  gruposVisibles,
  rutaPanel,
  vePaneles,
  type GrupoMenu,
} from "./menuEntradas";

const ID_TITULO = "titulo-menu-movil";

/** Un renglón del menú: 44px de alto, para tocarlo cómodo con el dedo. */
function Enlace({
  a,
  icono: Icono,
  texto,
  activo,
  sangria = false,
  onIr,
}: {
  a: string;
  icono: IconType;
  texto: string;
  activo: boolean;
  /** Opción de una categoría: va corrida respecto del título de la categoría. */
  sangria?: boolean;
  onIr: () => void;
}) {
  return (
    <Link
      asChild
      display="flex"
      alignItems="center"
      gap="3"
      minH="11"
      py="2"
      ps={sangria ? "8" : "3"}
      pe="3"
      rounded="md"
      fontSize={sangria ? "sm" : "md"}
      fontWeight={activo ? "bold" : sangria ? "medium" : "semibold"}
      color={activo ? "brand.fg" : "fg"}
      bg={activo ? "brand.subtle" : undefined}
      textDecoration="none"
      _hover={{ bg: activo ? "brand.subtle" : "bg.muted", textDecoration: "none" }}
      _focusVisible={{ outline: "2px solid", outlineColor: "brand.fg", outlineOffset: "-2px" }}
    >
      <RouterLink to={a} onClick={onIr} aria-current={activo ? "page" : undefined}>
        <Icono size={sangria ? 18 : 20} aria-hidden style={{ flexShrink: 0 }} />
        {texto}
      </RouterLink>
    </Link>
  );
}

/** Categoría plegable: su nombre y, al abrirla, su panel y sus pantallas. */
function Categoria({
  grupo,
  abierta,
  contieneActual,
  rutaActiva,
  conPanel,
  onAlternar,
  onIr,
}: {
  grupo: GrupoMenu;
  abierta: boolean;
  contieneActual: boolean;
  rutaActiva: string | null;
  conPanel: boolean;
  onAlternar: () => void;
  onIr: () => void;
}) {
  const { pathname } = useLocation();
  const Icono = grupo.icon;
  const idOpciones = `menu-movil-${grupo.id}`;

  return (
    <Box>
      <Button
        type="button"
        variant="ghost"
        colorPalette="neutral"
        w="100%"
        h="12"
        px="3"
        gap="3"
        justifyContent="flex-start"
        fontSize="md"
        fontWeight={contieneActual ? "bold" : "semibold"}
        color={contieneActual ? "brand.fg" : "fg"}
        aria-expanded={abierta}
        aria-controls={abierta ? idOpciones : undefined}
        onClick={onAlternar}
      >
        <Icono size={20} aria-hidden style={{ flexShrink: 0 }} />
        <Text as="span" flex="1" textAlign="left">
          {grupo.label}
        </Text>
        <Box as="span" display="inline-flex" color="fg.muted" transform={abierta ? "rotate(180deg)" : undefined}>
          <LuChevronDown size={18} aria-hidden />
        </Box>
      </Button>
      {abierta && (
        <Stack id={idOpciones} gap="0.5" pb="2">
          {conPanel && (
            <Enlace
              a={rutaPanel(grupo)}
              icono={LuChartColumn}
              texto={`Resumen de ${grupo.label}`}
              activo={pathname === rutaPanel(grupo)}
              sangria
              onIr={onIr}
            />
          )}
          {grupo.entradas.map((e) => (
            <Enlace
              key={e.to}
              a={e.to}
              icono={e.icon}
              texto={e.label}
              activo={e.to === rutaActiva}
              sangria
              onIr={onIr}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

/**
 * Lista de categorías. Va aparte del panel: se monta cada vez que se abre, y
 * así arranca siempre con la categoría de la pantalla actual desplegada.
 */
function Categorias({ onIr }: { onIr: () => void }) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const grupos = useMemo(() => gruposVisibles(user), [user]);
  const sueltas = useMemo(() => MENU.filter((e) => esVisibleEntrada(e, user)), [user]);
  const rutaActiva = entradaActiva(pathname, [...sueltas, ...grupos.flatMap((g) => g.entradas)]);
  const grupoActual =
    grupos.find((g) => rutaPanel(g) === pathname || g.entradas.some((e) => e.to === rutaActiva))?.id ?? null;

  // Una sola abierta por vez: la lista entra en la pantalla casi sin scroll.
  const [abierta, setAbierta] = useState<string | null>(grupoActual);

  return (
    <Stack gap="0.5">
      {sueltas.map((e) => (
        <Enlace key={e.to} a={e.to} icono={e.icon} texto={e.label} activo={e.to === rutaActiva} onIr={onIr} />
      ))}
      {grupos.map((g) => (
        <Categoria
          key={g.id}
          grupo={g}
          abierta={abierta === g.id}
          contieneActual={g.id === grupoActual}
          rutaActiva={rutaActiva}
          conPanel={vePaneles(user)}
          onAlternar={() => setAbierta((actual) => (actual === g.id ? null : g.id))}
          onIr={onIr}
        />
      ))}
    </Stack>
  );
}

/**
 * Menú del celular: el botón ☰ de la barra superior y el panel que abre desde
 * el costado. Reemplaza a `Navbar`, que en 390px mostraba una sola categoría.
 *
 * Las categorías y pantallas salen de `menuEntradas.ts`, filtradas por rol
 * igual que en la barra. Acá va también el modo claro u oscuro, que en el
 * celular no entra arriba.
 */
export function MenuMovil() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { colorMode, toggleColorMode } = useColorMode();
  const [abierto, setAbierto] = useState(false);

  // Cualquier cambio de pantalla (también el "atrás" del teléfono) lo cierra.
  const [pathnamePrevio, setPathnamePrevio] = useState(pathname);
  if (pathname !== pathnamePrevio) {
    setPathnamePrevio(pathname);
    setAbierto(false);
  }

  if (!user) return null;

  const oscuro = colorMode === "dark";
  const cerrar = () => setAbierto(false);

  return (
    <Drawer.Root
      open={abierto}
      onOpenChange={(detalle) => setAbierto(detalle.open)}
      placement="start"
      lazyMount
      unmountOnExit
    >
      <Drawer.Trigger asChild>
        <IconButton
          aria-label="Abrir menú"
          variant="ghost"
          boxSize="11"
          ms="-2"
          flexShrink={0}
          color="white"
          _hover={{ bg: "whiteAlpha.200" }}
          _focusVisible={{ outline: "2px solid", outlineColor: "white", outlineOffset: "-2px" }}
        >
          <LuMenu size={24} aria-hidden />
        </IconButton>
      </Drawer.Trigger>

      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content
            aria-labelledby={ID_TITULO}
            w="min(320px, calc(100vw - 56px))"
            maxW="none"
            h="100dvh"
            bg="bg.panel"
          >
            <Box bgColor="brand.bar" backgroundImage={DEGRADADO_MARCA} color="white" px="3" pt="2" pb="3" flexShrink={0}>
              <Flex align="center" justify="space-between" minH="12">
                <Drawer.Title id={ID_TITULO} srOnly>
                  Menú principal
                </Drawer.Title>
                <LogoSaia />
                <Drawer.CloseTrigger asChild position="static">
                  <IconButton
                    aria-label="Cerrar menú"
                    variant="ghost"
                    boxSize="11"
                    me="-2"
                    color="white"
                    _hover={{ bg: "whiteAlpha.200" }}
                    _focusVisible={{ outline: "2px solid", outlineColor: "white", outlineOffset: "-2px" }}
                  >
                    <LuX size={22} aria-hidden />
                  </IconButton>
                </Drawer.CloseTrigger>
              </Flex>
            </Box>

            <Box as="nav" aria-labelledby={ID_TITULO} flex="1" minH="0" overflowY="auto" p="2">
              <Categorias onIr={cerrar} />
            </Box>

            <Box borderTopWidth="1px" borderColor="border.subtle" p="2" flexShrink={0}>
              <Button
                type="button"
                variant="ghost"
                colorPalette="neutral"
                w="100%"
                h="12"
                px="3"
                gap="3"
                justifyContent="flex-start"
                fontSize="md"
                onClick={toggleColorMode}
              >
                {oscuro ? <LuSun size={20} aria-hidden /> : <LuMoon size={20} aria-hidden />}
                {oscuro ? "Usar modo claro" : "Usar modo oscuro"}
              </Button>
            </Box>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
