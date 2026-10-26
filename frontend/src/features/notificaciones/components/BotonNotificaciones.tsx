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
        /*
         * `bg` explícito en los dos estados: la variante `ghost` no queda
         * transparente en reposo sobre el fondo del sidebar (mismo motivo
         * que el `BotonPlegar` de la barra).
         */
        bg={activa ? "white" : "transparent"}
        color={activa ? "brand.700" : "white"}
        _hover={{ bg: activa ? "white" : "rgba(255, 255, 255, 0.2)" }}
        _focusVisible={{
          outline: "2px solid",
          outlineColor: activa ? "brand.700" : "white",
          outlineOffset: "-2px",
        }}
        onClick={() => navigate("/notificaciones")}
      >
         {/* Cambiamos el emoji por el ícono blanco */}
         <FaBell size={24} />
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
          borderColor="brand.500"
        >
          {cantidad}
        </Badge>
      )}
    </Box>
  );
}