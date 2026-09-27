import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, IconButton, Badge } from "@chakra-ui/react";
import { obtenerNotificaciones } from "../services/notificacionService";
import { FaBell } from "react-icons/fa"; // Usamos FaBell que es la versión rellena

export function BotonNotificaciones() {
  const navigate = useNavigate();
  const [cantidad, setCantidad] = useState(0);

  useEffect(() => {
    const cargarCantidad = async () => {
      try {
        const data = await obtenerNotificaciones();
        setCantidad(data.length);
      } catch {
        setCantidad(0);
      }
    };

    cargarCantidad();
    window.addEventListener("actualizar_notificaciones", cargarCantidad);

    return () => {
      window.removeEventListener("actualizar_notificaciones", cargarCantidad);
    };
  }, []);

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