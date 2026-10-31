import { useLocation } from "react-router-dom";
import { Flex } from "@chakra-ui/react";
import { useAuth } from "../context/useAuth";
import { puedeAdministrar } from "../api/permissions";
import { BotonNotificaciones } from "../../features/notificaciones/components/BotonNotificaciones";
import { Breadcrumbs } from "./Breadcrumbs";
import { MenuUsuario } from "./MenuUsuario";

export function BarraSuperior() {
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
      px="4"
      flexShrink={0}
      bg="white"
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      {/* Izquierda: breadcrumb */}
      <Breadcrumbs />

      {/* Derecha: notificaciones + usuario */}
      <Flex align="center" gap="3" flexShrink={0}>
        {puedeAdministrar(user) && (
          <BotonNotificaciones activa={pathname.startsWith("/notificaciones")} />
        )}
        <MenuUsuario />
      </Flex>
    </Flex>
  );
}