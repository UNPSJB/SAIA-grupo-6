import { useParams, useLocation } from "react-router-dom";
import { Box, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { LuCircleCheck, LuMinus } from "react-icons/lu";
import { useCliente } from "../../hooks/useCliente";
import { BannerError, EstadoCargando, EtiquetaEstado } from "../../../../components/ui/patrones";
import { PaginaDetalle, SeccionDetalle } from "../../../../components/ui/plantillas";
import { formatoFechaHora } from "../../../../common/utils/fechas";

export function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { cliente, loading, error } = useCliente(Number(id));

  const backUrl = location.state?.from === "clientes" ? "/clientes" : "/clientes";
  const volver = {
    a: backUrl,
    etiqueta: "Clientes",
  };

  if (loading) {
    return (
      <PaginaDetalle volver={volver} titulo="Cliente">
        <EstadoCargando>Cargando cliente...</EstadoCargando>
      </PaginaDetalle>
    );
  }

  if (error || !cliente) {
    return (
      <PaginaDetalle volver={volver} titulo="Cliente">
        <BannerError>{error || "No se encontró el cliente"}</BannerError>
      </PaginaDetalle>
    );
  }

  return (
    <PaginaDetalle
      volver={volver}
      titulo={cliente.nombre}
      descripcion={`Cliente ${cliente.activo ? "activo" : "dado de baja"}`}
    >
      {/* Sección: Datos principales */}
      <SeccionDetalle titulo="Datos principales">
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Nombre
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {cliente.nombre}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Documento (DNI / CUIT)
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {cliente.documento}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Teléfono
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {cliente.telefono}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Email
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {cliente.email ?? "-"}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Domicilio
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {cliente.domicilio ?? "-"}
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
              {cliente.activo ? (
                <LuCircleCheck size={14} color="green.fg" aria-hidden />
              ) : (
                <LuMinus size={14} color="gray.fg" aria-hidden />
              )}
              <Text fontSize="sm" fontWeight="medium" color={cliente.activo ? "green.fg" : "gray.fg"}>
                {cliente.activo ? "Activo" : "Inactivo"}
              </Text>
            </Box>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Fecha de creación
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {formatoFechaHora(cliente.fecha_creacion)}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="fg.muted" mb="1">
              Última actualización
            </Text>
            <Text fontSize="sm" fontWeight="medium" color="fg" wordBreak="break-word">
              {formatoFechaHora(cliente.fecha_actualizacion) ?? "-"}
            </Text>
          </Box>
        </SimpleGrid>
      </SeccionDetalle>
    </PaginaDetalle>
  );
}
