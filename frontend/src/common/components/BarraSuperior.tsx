import { useNavigate } from "react-router-dom";
import { Button, Flex, IconButton, Text } from "@chakra-ui/react";
import { LuLogOut, LuMenu, LuUserRound, LuX } from "react-icons/lu";
import { useAuth } from "../context/useAuth";
import { Breadcrumbs } from "./Breadcrumbs";

interface BarraSuperiorProps {
  menuAbierto: boolean;
  onAlternarMenu: () => void;
}

export function BarraSuperior({ menuAbierto, onAlternarMenu }: BarraSuperiorProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
      {/* Izquierda: botón del menú + breadcrumb */}
      <Flex align="center" gap="3" minW={0}>
        <IconButton
          aria-label={menuAbierto ? "Cerrar el menú" : "Abrir el menú"}
          aria-expanded={menuAbierto}
          aria-controls="menu-principal"
          title={menuAbierto ? "Cerrar el menú" : "Abrir el menú"}
          size="sm"
          variant="ghost"
          bg="transparent"
          color="brand.700"
          _hover={{ bg: "brand.50" }}
          onClick={onAlternarMenu}
        >
          {menuAbierto ? <LuX size={20} /> : <LuMenu size={20} />}
        </IconButton>

        <Breadcrumbs />
      </Flex>

      {/* Derecha: perfil + cerrar sesión */}
      <Flex align="center" gap="2" flexShrink={0}>
        <Button
          size="sm"
          variant="ghost"
          bg="transparent"
          color="brand.700"
          _hover={{ bg: "brand.50" }}
          aria-label="Mi perfil"
          title="Mi perfil"
          onClick={() => navigate("/mi-perfil")}
        >
          <LuUserRound size={18} aria-hidden />
          <Text as="span" display={{ base: "none", md: "inline" }}>
            {user.nombre} {user.apellido}
          </Text>
        </Button>

        <Button
          size="sm"
          variant="outline"
          bg="transparent"
          color="brand.700"
          borderColor="brand.700"
          _hover={{ bg: "brand.50" }}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          onClick={logout}
        >
          <LuLogOut size={18} aria-hidden />
          <Text as="span" display={{ base: "none", md: "inline" }}>
            Cerrar sesión
          </Text>
        </Button>
      </Flex>
    </Flex>
  );
}