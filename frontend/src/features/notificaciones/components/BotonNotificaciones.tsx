import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, IconButton, Badge } from "@chakra-ui/react";
import { obtenerNotificaciones } from "../services/notificacionService";

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

    // 1. Carga la cantidad apenas entras a la app
    cargarCantidad();

    // 2. Se queda escuchando un "grito" global llamado "actualizar_notificaciones"
    window.addEventListener("actualizar_notificaciones", cargarCantidad);

    // 3. Limpieza de memoria si el botón desaparece
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
         <span style={{ fontSize: "20px" }}>🔔</span>
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