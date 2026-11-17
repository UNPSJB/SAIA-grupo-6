import type { ReactElement } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Flex, Link } from "@chakra-ui/react";
import { useAuth } from "../context/useAuth";
import { puedeAdministrar } from "../api/permissions";
import { BotonNotificaciones } from "../../features/notificaciones/components/BotonNotificaciones";
import { BuscadorGlobal } from "./BuscadorGlobal";
import { LogoSaia } from "./LogoSaia";
import { MenuUsuario } from "./MenuUsuario";
import Navbar from "./Navbar";

/**
 * Barra superior:
 *
 *   [ logo SAIA ] [ categorías u opciones (Navbar) ] [ buscar ] [ 🔔 ] [ avatar ]
 *
 * Fondo teal (brand.700): todo lo de adentro va en blanco. Debajo van las
 * migas de pan (`Breadcrumbs`), armadas en `LayoutPrincipal`.
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
      bg="brand.700"
      color="white"
    >
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

      {/* Derecha: buscador, notificaciones y usuario. Miden 40px de alto. */}
      <Flex align="center" gap="2" flexShrink={0}>
        <BuscadorGlobal />
        {puedeAdministrar(user) && (
          <BotonNotificaciones activa={pathname.startsWith("/notificaciones")} />
        )}
        <MenuUsuario />
      </Flex>
    </Flex>
  );
}
