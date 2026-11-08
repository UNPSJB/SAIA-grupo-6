import { useParams } from "react-router-dom";
import { Badge, Box, SimpleGrid, Table, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuCircleCheck, LuCircleX } from "react-icons/lu";
import { usePersonal } from "../../hooks/usePersonal";
import { useVencimientosPersonal } from "../../../vencimientoPersonal/hooks/useVencimientosPersonal";
import { useAptitudes } from "../../../aptitud/hooks/useAptitudes";
import { hoyISO } from "../../../../common/utils/fechas";
import {
  BannerError,
  Celda,
  ColumnaHeader,
  EstadoCargando,
} from "../../../../components/ui/patrones";
import {
  DatoDetalle,
  GrillaDatos,
  PaginaDetalle,
  SeccionDetalle,
} from "../../../../components/ui/plantillas";

/**
 * Ítem del listado de permisos: ícono de estado + nombre.
 *
 * Antes iba un emoji (✅/❌): en un sistema sin esa fuente se veían
 * cuadritos. El ícono va envuelto en un `Box` con `color` de Chakra para
 * que resuelva el token semántico (`green.fg`); pasándolo directo al ícono
 * terminaría como color inválido en el CSS.
 */
function Permiso({ concedido, children }: { concedido: boolean; children: ReactNode }) {
  return (
    <Text fontSize="sm" color="fg" display="flex" alignItems="center" gap="2">
      <Box as="span" display="inline-flex" color={concedido ? "green.fg" : "red.fg"} aria-hidden>
        {concedido ? <LuCircleCheck size={16} /> : <LuCircleX size={16} />}
      </Box>
      {children}
    </Text>
  );
}

export function PersonalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const personaId = Number(id);

  const { persona, loading, error } = usePersonal(personaId);
  const { vencimientos, loading: cargandoVencimientos } = useVencimientosPersonal(
    Number.isFinite(personaId) ? personaId : null
  );
  const { aptitudes } = useAptitudes(true); // incluir inactivas: si una aptitud
  // vieja se dio de baja, igual queremos poder mostrar su nombre acá.

  const nombrePorAptitud = new Map(aptitudes.map((a) => [a.id, a.nombre]));

  if (loading) {
    return (
      <PaginaDetalle volver={{ a: "/personal", etiqueta: "Personal", historial: true }} titulo="Ficha de personal">
        <EstadoCargando>Cargando información...</EstadoCargando>
      </PaginaDetalle>
    );
  }

  if (error || !persona) {
    return (
      <PaginaDetalle volver={{ a: "/personal", etiqueta: "Personal", historial: true }} titulo="Ficha de personal">
        <BannerError mb="0">{error || "No se encontró el empleado"}</BannerError>
      </PaginaDetalle>
    );
  }

  // `hoyISO()` y no `toISOString()`: en UTC-3, entre las 21:00 y las 24:00
  // el `toISOString()` devuelve el día siguiente.
  const hoy = hoyISO();

  return (
    <PaginaDetalle
      volver={{ a: "/personal", etiqueta: "Personal", historial: true }}
      titulo={`${persona.nombre} ${persona.apellido || ""}`.trim()}
      descripcion={`Ficha de personal #${persona.id}`}
    >
      <SeccionDetalle titulo="Datos personales">
        <GrillaDatos>
          <DatoDetalle etiqueta="Nombre completo">{`${persona.nombre} ${persona.apellido || ""}`}</DatoDetalle>
          <DatoDetalle etiqueta="DNI">{persona.dni}</DatoDetalle>
          <DatoDetalle etiqueta="Email">{persona.email}</DatoDetalle>
          <DatoDetalle etiqueta="Teléfono">{persona.telefono || "No registrado"}</DatoDetalle>
        </GrillaDatos>
      </SeccionDetalle>

      <SeccionDetalle titulo="Permisos en el sistema">
          <SimpleGrid columns={{ base: 1, sm: 2 }} gap="2">
            <Permiso concedido={persona.puede_operar}>Puede Operar</Permiso>
            <Permiso concedido={persona.puede_administrar}>Puede Administrar</Permiso>
          </SimpleGrid>
      </SeccionDetalle>

      <SeccionDetalle titulo="Vencimientos de aptitud">
          {cargandoVencimientos && (
            <Text fontSize="sm" color="fg.muted" fontStyle="italic">
              Cargando...
            </Text>
          )}

          {!cargandoVencimientos && vencimientos.length === 0 && (
            <Text fontSize="sm" color="fg.muted" fontStyle="italic">
              No tiene vencimientos cargados.
            </Text>
          )}

          {!cargandoVencimientos && vencimientos.length > 0 && (
            <Table.Root variant="outline" w="100%">
              <Table.Header>
                {/* Es una tabla de detalle embebida en la ficha, no un
                    listado: va con el encabezado claro. */}
                <Table.Row>
                  <ColumnaHeader>Aptitud</ColumnaHeader>
                  <ColumnaHeader>Vence</ColumnaHeader>
                  <ColumnaHeader center>Estado</ColumnaHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {vencimientos.map((v) => {
                  const vencido = v.fecha_vencimiento < hoy;
                  return (
                    <Table.Row key={v.id}>
                      <Celda p="3">
                        {nombrePorAptitud.get(v.aptitud_id) || "Aptitud eliminada"}
                      </Celda>
                      <Celda p="3">{v.fecha_vencimiento}</Celda>
                      <Celda p="3" center>
                        <Badge colorPalette={vencido ? "red" : "green"}>
                          {vencido ? "Vencido" : "Vigente"}
                        </Badge>
                      </Celda>
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