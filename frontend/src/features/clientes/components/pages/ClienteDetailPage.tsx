import { useParams, useLocation } from "react-router-dom";
import { Box, Text } from "@chakra-ui/react";
import { LuCircleCheck, LuMinus } from "react-icons/lu";
import { useCliente } from "../../hooks/useCliente";
import { BannerError, EstadoCargando } from "../../../../components/ui/patrones";
import {
  DatoDetalle,
  GrillaDatos,
  PaginaDetalle,
  SeccionDetalle,
} from "../../../../components/ui/plantillas";
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
        <SeccionDetalle titulo="Datos principales">
          <GrillaDatos>
            <DatoDetalle etiqueta="Nombre">{cliente.nombre}</DatoDetalle>
            <DatoDetalle etiqueta="Documento (DNI / CUIT)">{cliente.documento}</DatoDetalle>
            <DatoDetalle etiqueta="Teléfono">{cliente.telefono}</DatoDetalle>
            <DatoDetalle etiqueta="Email">{cliente.email ?? "-"}</DatoDetalle>
            <DatoDetalle etiqueta="Domicilio">{cliente.domicilio ?? "-"}</DatoDetalle>
          </GrillaDatos>
        </SeccionDetalle>
      <SeccionDetalle titulo="Información del sistema">
        <GrillaDatos>
          <DatoDetalle etiqueta="Estado">
            <Box display="flex" alignItems="center" gap="2">
              {cliente.activo ? (
                <LuCircleCheck size={14} color="green.fg" aria-hidden />
              ) : (
                <LuMinus size={14} color="gray.fg" aria-hidden />
              )}
              <Text as="span" fontSize="sm" fontWeight="medium" color={cliente.activo ? "green.fg" : "gray.fg"}>
                {cliente.activo ? "Activo" : "Inactivo"}
              </Text>
            </Box>
          </DatoDetalle>
          <DatoDetalle etiqueta="Fecha de creación">{formatoFechaHora(cliente.fecha_creacion)}</DatoDetalle>
          <DatoDetalle etiqueta="Última actualización">
            {formatoFechaHora(cliente.fecha_actualizacion) ?? "-"}
          </DatoDetalle>
        </GrillaDatos>
      </SeccionDetalle>
    </PaginaDetalle>
  );
}
