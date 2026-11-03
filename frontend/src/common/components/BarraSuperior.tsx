import type { ReactElement } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Box, Flex, Link } from "@chakra-ui/react";
import { useAuth } from "../context/useAuth";
import { puedeAdministrar } from "../api/permissions";
import { BotonNotificaciones } from "../../features/notificaciones/components/BotonNotificaciones";
import { Breadcrumbs } from "./Breadcrumbs";
import { LogoSaia } from "./LogoSaia";
import { MenuUsuario } from "./MenuUsuario";

/**
 * Barra superior, organizada como la de GitHub:
 *
 *   [ logo SAIA ] [ migas de pan ] ............ [ 🔔 ] [ avatar ]
 *
 * El logo va a la izquierda, al lado del breadcrumb. El botón hamburguesa ya
 * no va acá: vive en el encabezado de la barra lateral (ver `Navbar.tsx`).
 *
 * El nombre "SAIA" no va acá: aparece junto al logo en el encabezado del menú
 * lateral cuando se despliega.
 */
export function BarraSuperior(): ReactElement | null {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!user) return null;

  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      gap="4"
      h="16"
      px={{ base: "3", md: "4" }}
      flexShrink={0}
      bg="white"
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      {/* Izquierda: logo + migas de pan. `minW=0` deja que el breadcrumb se
          recorte en pantallas chicas. */}
      <Flex align="center" gap="3" flex="1" minW={0}>
        {/* Logo de la empresa: escudo sin texto. Lleva al inicio. */}
        <Link
          asChild
          aria-label="SAIA, ir al inicio"
          color="brand.700"
          flexShrink={0}
          rounded="md"
          textDecoration="none"
          _hover={{ textDecoration: "none", opacity: 0.8 }}
          _focusVisible={{
            outline: "2px solid",
            outlineColor: "brand.700",
            outlineOffset: "2px",
          }}
        >
          <RouterLink to="/">
            <LogoSaia soloIcono />
          </RouterLink>
        </Link>

        <Box minW={0}>
          <Breadcrumbs />
        </Box>
      </Flex>

      {/* Derecha: notificaciones y usuario. Los dos miden 40px. */}
      <Flex align="center" gap="2" flexShrink={0}>
        {puedeAdministrar(user) && (
          <BotonNotificaciones activa={pathname.startsWith("/notificaciones")} />
        )}
        <MenuUsuario />
      </Flex>
    </Flex>
  );
}
