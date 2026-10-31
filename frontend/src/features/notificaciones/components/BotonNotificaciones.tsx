import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, IconButton, Badge } from "@chakra-ui/react";
import { useNotificaciones } from "../hooks/useNotificaciones";
import { escucharCambioNotificaciones } from "../eventoNotificaciones";
import { FaBell } from "react-icons/fa"; // Usamos FaBell que es la versión rellena

interface BotonNotificacionesProps {
  /**
   * Marca la campana como seleccionada cuando la vista actual es la de
   * notificaciones: mismo lenguaje que el `NavItem` activo de la barra
   * (fondo blanco, ícono del color de la marca).
   */
  activa?: boolean;
}

export function BotonNotificaciones({ activa = false }: BotonNotificacionesProps) {
  const navigate = useNavigate();
  // Antes este componente reimplementaba el fetch del hook `useNotificaciones`,
  // que quedaba sin usar en todo el proyecto. Ahora es el único lugar que
  // trae el dato.
  const { cantidad, recargar } = useNotificaciones();

  useEffect(() => escucharCambioNotificaciones(() => void recargar()), [recargar]);

  return (
    <Box position="relative" display="inline-block">
      <IconButton
        aria-label="Notificaciones"
        aria-current={activa ? "page" : undefined}
        variant="ghost"
        rounded="md"
        bg={activa ? "brand.700" : "transparent"}
        color={activa ? "white" : "brand.700"}
        _hover={{ bg: activa ? "brand.700" : "brand.50" }}
        _focusVisible={{
          outline: "2px solid",
          outlineColor: "brand.700",
          outlineOffset: "-2px",
        }}
        onClick={() => navigate("/notificaciones")}
      >
        <FaBell size={20} />
      </IconButton>
      
      {cantidad > 0 && (
        <Badge
          colorPalette="red"
          variant="solid"
          bg="red.600"
          color="white"
          borderRadius="full"
          position="absolute"
          top="-2px"
          right="-2px"
          fontSize="xs"
          px="1.5"
          py="0.5"
          fontWeight="bold"
          borderWidth="2px"
          borderStyle="solid"
          borderColor="white"
        >
          {cantidad}
        </Badge>
      )}
    </Box>
  );
}