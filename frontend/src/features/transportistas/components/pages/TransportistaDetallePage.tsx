import { useParams, useLocation } from "react-router-dom";
import { Box, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { LuCircleCheck, LuMinus } from "react-icons/lu";
import { useTransportista } from "../../hooks/useTransportista";
import { BannerError, EstadoCargando, EtiquetaEstado } from "../../../../components/ui/patrones";
import { PaginaDetalle, SeccionDetalle } from "../../../../components/ui/plantillas";
import { formatoFechaHora } from "../../../../common/utils/fechas";

export function TransportistaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { transportista, loading, error } = useTransportista(Number(id));

  const backUrl = location.state?.from === "transportistas" ? "/transportistas" : "/transportistas";
  const volver = {
    a: backUrl,
    etiqueta: "Transportistas",
  };

  if (loading) {
    return (
      <PaginaDetalle volver={volver} titulo="Transportista">
        <EstadoCargando>Cargando transportista...</EstadoCargando>
      </PaginaDetalle>
    );
  }

  if (error || !transportista) {
    return (
      <PaginaDetalle volver={volver} titulo="Transportista">
        <BannerError>{error || "No se encontró el transportista"}</BannerError>
      </PaginaDetalle>
    );
  }

  return (
    <PaginaDetalle
      volver={volver}
      titulo={transportista.razon_social}
      descripcion={`Transportista ${transportista.activo ? "activo" : "dado de baja"}`}
    >
      {/* Sección: Datos principales */}
      <SeccionDetalle titulo="Datos principales">
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Razón Social
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {transportista.razon_social}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              CUIT
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {transportista.cuit}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Teléfono
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {transportista.telefono}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Email
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {transportista.email ?? "-"}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Domicilio
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {transportista.domicilio ?? "-"}
            </Text>
          </Box>
          <Box colSpan={6}>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Observaciones
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word" whiteSpace="pre-line">
              {transportista.observaciones ?? "-"}
            </Text>
          </Box>
        </SimpleGrid>
      </SeccionDetalle>

      {/* Sección: Información del sistema */}
      <SeccionDetalle titulo="Información del sistema">
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Estado
            </Text>
            <Box display="flex" alignItems="center" gap="2">
              {transportista.activo ? (
                <LuCircleCheck size={14} color="green.fg" aria-hidden />
              ) : (
                <LuMinus size={14} color="gray.fg" aria-hidden />
              )}
              <Text fontSize="sm" fontWeight="medium" color={transportista.activo ? "green.fg" : "gray.fg"}>
                {transportista.activo ? "Activo" : "Inactivo"}
              </Text>
            </Box>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Fecha de creación
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {formatoFechaHora(transportista.fecha_creacion)}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Última actualización
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {formatoFechaHora(transportista.fecha_actualizacion) ?? "-"}
            </Text>
          </Box>
        </SimpleGrid>
      </SeccionDetalle>
    </PaginaDetalle>
  );
}
