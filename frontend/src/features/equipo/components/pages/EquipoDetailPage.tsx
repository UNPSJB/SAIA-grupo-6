import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Box,
  Heading,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { useEquipo } from "../../hooks/useEquipo";
import { usePlanesCalibracionMantenimiento } from "../../../planCalibracionMantenimiento/hooks/usePlanesCalibracionMantenimiento";
import { formatoFecha } from "../../../../common/utils/fechas";
import {
  BannerError,
  BotonTabla,
  BotonVolver,
  Celda,
  ColumnaHeader,
  PageHeader,
  Tarjeta,
} from "../../../../components/ui/patrones";

/** Par etiqueta/valor de la ficha. */
function Campo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Box>
      <Text fontSize="sm" fontWeight="medium" color="fg.muted">
        {etiqueta}
      </Text>
      <Text fontSize="md" color="fg">
        {valor}
      </Text>
    </Box>
  );
}

// Mismo criterio que la tabla de planes y las notificaciones: 3 días de margen.
function estadoPlan(diasRestantes: number) {
  if (diasRestantes <= 0) return { etiqueta: "Vencido", paleta: "red" };
  if (diasRestantes <= 3) return { etiqueta: "Próximo a vencer", paleta: "orange" };
  return { etiqueta: "Vigente", paleta: "green" };
}

function textoDias(diasRestantes: number) {
  if (diasRestantes < 0) return `Venció hace ${-diasRestantes} día(s)`;
  if (diasRestantes === 0) return "Vence hoy";
  return `Vence en ${diasRestantes} día(s)`;
}

export function EquipoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  // Vuelve a la pantalla de donde vino (vencimientos, notificaciones o lista de equipos).
  const volver = () => (window.history.length > 1 ? navigate(-1) : navigate("/equipos"));

  if (loading) {
    return (
      <Box p="5">
        <Stack direction="row" gap="3" align="center" color="fg.muted">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic">Cargando información...</Text>
        </Stack>
      </Box>
    );
  }

  if (error || !equipo) {
    return (
      <Box p="5">
        <BannerError mb="0">{error || "No se encontró el equipo"}</BannerError>
      </Box>
    );
  }

  return (
    <Box p="5" maxW="900px" mx="auto">
      <PageHeader
        title={`Ficha de equipo #${equipo.id}`}
        actions={<BotonVolver onClick={volver}>Volver</BotonVolver>}
      />

      <Tarjeta p="5">
        <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
          <Campo etiqueta="Nombre" valor={equipo.nombre} />
          <Campo etiqueta="Tipo" valor={equipo.tipo} />
          <Campo etiqueta="Ubicación" valor={equipo.ubicacion} />
          <Box>
            <Text fontSize="sm" fontWeight="medium" color="fg.muted">
              Estado
            </Text>
            <Badge colorPalette={equipo.activo ? "green" : "gray"} mt="1">
              {equipo.activo ? "Activo" : "Dado de baja"}
            </Badge>
          </Box>
          <Campo
            etiqueta="Frecuencia de calibración"
            valor={
              equipo.frecuencia_calibracion_dias
                ? `Cada ${equipo.frecuencia_calibracion_dias} días`
                : "Cada 365 días (por defecto)"
            }
          />
        </SimpleGrid>

        <Box mt="6" pt="6" borderTopWidth="1px" borderColor="border.subtle">
          <Heading as="h4" size="lg" fontWeight="bold" color="fg" mb="3">
            Planes de calibración y mantenimiento
          </Heading>

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
                  <ColumnaHeader center>Acción</ColumnaHeader>
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
                        <Badge colorPalette={estado.paleta}>{estado.etiqueta}</Badge>
                      </Celda>
                      <Celda p="3" center>
                        <BotonTabla
                          accion="editar"
                          onClick={() =>
                            navigate(`/planes-calibracion-mantenimiento/${plan.id}/editar`)
                          }
                        >
                          Modificar
                        </BotonTabla>
                      </Celda>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          )}
        </Box>
      </Tarjeta>
    </Box>
  );
}