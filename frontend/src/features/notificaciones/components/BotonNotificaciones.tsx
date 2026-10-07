import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, IconButton, Badge } from "@chakra-ui/react";
import { useNotificaciones } from "../hooks/useNotificaciones";
import { escucharCambioNotificaciones } from "../eventoNotificaciones";
import { FaBell } from "react-icons/fa"; // Usamos FaBell que es la versión rellena

export function BotonNotificaciones() {
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
        variant="ghost"
        color="white"
        _hover={{ bg: "rgba(255, 255, 255, 0.2)" }}
        onClick={() => navigate("/notificaciones")}
      >
         {/* Cambiamos el emoji por el ícono blanco */}
         <FaBell size={24} />
      </IconButton>
      
      {cantidad > 0 && (
        <Badge
          bg="red.500"
          color="white"
          borderRadius="full"
          position="absolute"
          top="-2px"
          right="-2px"
          fontSize="11px"
          px="6px"
          py="1px"
          fontWeight="bold"
          border="2px solid #468189"
        >
          {cantidad}
        </Badge>
      )}
    </Box>
  );
}