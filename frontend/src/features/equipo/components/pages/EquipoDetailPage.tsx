import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Table, Text } from "@chakra-ui/react";
import { useEquipo } from "../../hooks/useEquipo";
import { usePlanesCalibracionMantenimiento } from "../../../planCalibracionMantenimiento/hooks/usePlanesCalibracionMantenimiento";
import { formatoFecha } from "../../../../common/utils/fechas";
import { BannerError, Celda, ColumnaHeader, EstadoCargando, EtiquetaEstado } from "../../../../components/ui/patrones";
import {
  DatoDetalle,
  GrillaDatos,
  PaginaDetalle,
  SeccionDetalle,
} from "../../../../components/ui/plantillas";

// Mismo criterio que la tabla de planes y las notificaciones: 3 días de margen.
function estadoPlan(diasRestantes: number) {
  if (diasRestantes <= 0) return { etiqueta: "Vencido", tono: "peligro" as const };
  if (diasRestantes <= 3) return { etiqueta: "Próximo a vencer", tono: "alerta" as const };
  return { etiqueta: "Vigente", tono: "ok" as const };
}

function textoDias(diasRestantes: number) {
  if (diasRestantes < 0) return `Venció hace ${-diasRestantes} día(s)`;
  if (diasRestantes === 0) return "Vence hoy";
  return `Vence en ${diasRestantes} día(s)`;
}

export function EquipoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const equipoId = Number(id);

  const { equipo, loading, error } = useEquipo(
    Number.isFinite(equipoId) ? equipoId : null
  );
  const {
    planes,
    loading: cargandoPlanes,
    error: errorPlanes,
  } = usePlanesCalibracionMantenimiento();

  // Solo los planes de este equipo, el más urgente arriba.
  const planesDelEquipo = useMemo(
    () =>
      planes
        .filter((p) => p.equipo_id === equipoId)
        .sort((a, b) => a.dias_restantes - b.dias_restantes),
    [planes, equipoId]
  );

  if (loading) {
    return (
      <PaginaDetalle volver={{ a: "/equipos", etiqueta: "Equipos", historial: true }} titulo="Ficha de equipo">
        <EstadoCargando>Cargando información...</EstadoCargando>
      </PaginaDetalle>
    );
  }

  if (error || !equipo) {
    return (
      <PaginaDetalle volver={{ a: "/equipos", etiqueta: "Equipos", historial: true }} titulo="Ficha de equipo">
        <BannerError mb="0">{error || "No se encontró el equipo"}</BannerError>
      </PaginaDetalle>
    );
  }

  // "Volver" regresa a la pantalla de origen: vencimientos, notificaciones o la lista.
  return (
    <PaginaDetalle
      volver={{ a: "/equipos", etiqueta: "Equipos", historial: true }}
      titulo={equipo.nombre}
      descripcion={`Ficha de equipo #${equipo.id}`}
      estado={
        <EtiquetaEstado tono={equipo.activo ? "ok" : "neutro"}>
          {equipo.activo ? "Activo" : "Dado de baja"}
        </EtiquetaEstado>
      }
    >
      <SeccionDetalle titulo="Datos del equipo">
        <GrillaDatos>
          <DatoDetalle etiqueta="Nombre">{equipo.nombre}</DatoDetalle>
          <DatoDetalle etiqueta="Tipo">{equipo.tipo}</DatoDetalle>
          <DatoDetalle etiqueta="Sector">{equipo.sector.nombre}</DatoDetalle>
          <DatoDetalle etiqueta="Frecuencia de calibración">{
              equipo.frecuencia_calibracion_dias
                ? `Cada ${equipo.frecuencia_calibracion_dias} días`
                : "Cada 365 días (por defecto)"
            }</DatoDetalle>
        </GrillaDatos>
      </SeccionDetalle>

      <SeccionDetalle titulo="Planes de calibración y mantenimiento">
          {cargandoPlanes && (
            <Text fontSize="sm" color="fg.muted" fontStyle="italic">
              Cargando...
            </Text>
          )}

          {!cargandoPlanes && errorPlanes && (
            <BannerError mb="0">{errorPlanes}</BannerError>
          )}

          {!cargandoPlanes && !errorPlanes && planesDelEquipo.length === 0 && (
            <Text fontSize="sm" color="fg.muted" fontStyle="italic">
              Este equipo no tiene planes de calibración ni mantenimiento.
            </Text>
          )}

          {!cargandoPlanes && !errorPlanes && planesDelEquipo.length > 0 && (
            <Table.Root variant="outline" w="100%">
              <Table.Header>
                <Table.Row>
                  <ColumnaHeader>Tipo</ColumnaHeader>
                  <ColumnaHeader>Última intervención</ColumnaHeader>
                  <ColumnaHeader>Periodicidad</ColumnaHeader>
                  <ColumnaHeader>Próximo vencimiento</ColumnaHeader>
                  <ColumnaHeader center>Estado</ColumnaHeader>
                  {/*<ColumnaHeader center>Acción</ColumnaHeader>*/}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {planesDelEquipo.map((plan) => {
                  const estado = estadoPlan(plan.dias_restantes);
                  const vencido = plan.dias_restantes <= 0;
                  return (
                    <Table.Row key={plan.id}>
                      <Celda p="3">
                        {plan.tipo === "calibracion" ? "Calibración" : "Mantenimiento"}
                      </Celda>
                      <Celda p="3">{formatoFecha(plan.fecha_ultima_intervencion)}</Celda>
                      <Celda p="3">
                        Cada {plan.periodicidad_dias}{" "}
                        {plan.periodicidad_dias === 1 ? "día" : "días"}
                      </Celda>
                      <Celda p="3">
                        <Text
                          fontSize="sm"
                          color={vencido ? "fg.error" : "fg"}
                          fontWeight={vencido ? "bold" : "normal"}
                        >
                          {formatoFecha(plan.proxima_fecha_vencimiento)}
                        </Text>
                        <Text fontSize="xs" color="fg.muted">
                          {textoDias(plan.dias_restantes)}
                        </Text>
                      </Celda>
                      <Celda p="3" center>
                        <EtiquetaEstado tono={estado.tono}>{estado.etiqueta}</EtiquetaEstado>
                      </Celda>
                      {/*<Celda p="3" center>
                        <BotonAccion
                          accion="editar"
                          label="Modificar"
                          onClick={() =>
                            navigate(`/planes-calibracion-mantenimiento/${plan.id}/editar`)
                          }
                        />
                      </Celda>*/}
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          )}
      </SeccionDetalle>
    </PaginaDetalle>
  );
}