import type { ReactElement } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Flex, Link, Text } from "@chakra-ui/react";
import { ColorModeButton } from "../../components/ui/color-mode";
import { useAuth } from "../context/useAuth";
import { useEsCelular } from "../hooks/useEsCelular";
import { esSuperAdmin, puedeAdministrar } from "../api/permissions";
import { useSedes } from "../../features/establecimientos/hooks/useSedes";
import { BotonNotificaciones } from "../../features/notificaciones/components/BotonNotificaciones";
import { BuscadorGlobal } from "./BuscadorGlobal";
import { LogoSaia } from "./LogoSaia";
import { MenuMovil } from "./MenuMovil";
import { MenuUsuario } from "./MenuUsuario";
import Navbar from "./Navbar";
import { tituloDeRuta } from "./menuEntradas";
import { DEGRADADO_MARCA } from "../../theme";

/**
 * Barra superior:
 *
 *   [ logo SAIA ] [ categorías u opciones (Navbar) ] [ buscar ] [ 🔔 ] [ avatar ]
 *
 * En el celular las categorías no entran: van en un panel (`MenuMovil`), y con
 * ellas el modo claro/oscuro. La barra dice en qué sección se está:
 *
 *   [ ☰ ] [ sección ] [ buscar ] [ 🔔 ] [ avatar ]
 *
 * Fondo teal (brand.bar): todo lo de adentro va en blanco. Debajo van las
 * migas de pan (`Breadcrumbs`), armadas en `LayoutPrincipal`.
 */
export function BarraSuperior(): ReactElement | null {
  const { user } = useAuth();
  const { pathname } = useLocation();
  // Se monta una sola de las dos barras: `Navbar` mide sus pestañas, y oculta
  // mediría todo en cero.
  const esCelular = useEsCelular();
  // La sede del super admin se elige en Configuración; acá solo se controla, en
  // toda la app, que la elegida no se haya dado de baja.
  useSedes(user !== null && esSuperAdmin(user));

  if (!user) return null;

  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      gap={{ base: "2", md: "4" }}
      h="16"
      px={{ base: "3", md: "4" }}
      flexShrink={0}
      // Siempre con el degradado de la marca. En el Inicio la barra es
      // transparente porque el layout ya pinta ese mismo degradado detrás de
      // toda la pantalla; en el resto lo lleva la barra misma, así no cambia
      // de color al salir del Inicio. `bgColor` (no `bg`, que borraría la
      // imagen) queda de respaldo con `brand.bar` (teal en ambos modos).
      bgColor={pathname === "/" ? "transparent" : "brand.bar"}
      backgroundImage={pathname === "/" ? undefined : DEGRADADO_MARCA}
      // En el Inicio, una línea apenas visible la separa del encabezado, que
      // tiene el mismo degradado de fondo.
      borderBottom={pathname === "/" ? "1px solid rgba(255, 255, 255, 0.1)" : undefined}
      color="white"
    >
      {esCelular ? (
        <>
          <MenuMovil />
          <Text flex="1" minW="0" fontSize="md" fontWeight="bold" lineHeight="1.2" lineClamp={2}>
            {tituloDeRuta(pathname) ?? "SAIA"}
          </Text>
        </>
      ) : (
        <>
          {/* Logo de la empresa con el nombre. Lleva al inicio. */}
          <Link
            asChild
            aria-label="SAIA, ir al inicio"
            color="white"
            flexShrink={0}
            rounded="md"
            textDecoration="none"
            _hover={{ textDecoration: "none", opacity: 0.8 }}
            _focusVisible={{
              outline: "2px solid",
              outlineColor: "white",
              outlineOffset: "2px",
            }}
          >
            <RouterLink to="/">
              <LogoSaia />
            </RouterLink>
          </Link>

          <Navbar />
        </>
      )}

      {/* Derecha: buscador, notificaciones y usuario. Miden 40px de alto. */}
      <Flex align="center" gap={{ base: "1", md: "2" }} flexShrink={0}>
        <BuscadorGlobal />
        {!esCelular && (
          <ColorModeButton
            aria-label="Cambiar entre modo claro y oscuro"
            title="Modo claro / oscuro"
            color="white"
            boxSize="10"
            rounded="md"
            _hover={{ bg: "whiteAlpha.200" }}
            _focusVisible={{ outline: "2px solid", outlineColor: "white", outlineOffset: "2px" }}
          />
        )}
        {puedeAdministrar(user) && (
          <BotonNotificaciones activa={pathname.startsWith("/notificaciones")} />
        )}
        <MenuUsuario />
      </Flex>
    </Flex>
  );
}
