import { Fragment, useMemo, useState } from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Spinner,
  Text,
  Field,
  Table,
} from "@chakra-ui/react";
import { useHistorialChecklists } from "../../hooks/useHistorialChecklists";
import { useEquipos } from "../../../equipo/hooks/useEquipos";
import {
  BotonTexto,
  Celda,
  ColumnaHeader,
  LabelFiltro,
  Tarjeta,
} from "../../../../components/ui/patrones";

function fechaLocalISO(fecha: Date): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Verde/ámbar/rojo del cumplimiento, con los tokens del tema. */
function colorPorcentaje(pct: number): string {
  if (pct >= 80) return "green.600";
  if (pct >= 50) return "orange.400";
  return "red.700";
}

export function HistorialChecklistPage() {
  const [{ hace7DiasISO, hoyISO }] = useState(() => {
    const hoy = new Date();
    return {
      hoyISO: fechaLocalISO(hoy),
      hace7DiasISO: fechaLocalISO(
        new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000)
      ),
    };
  });

  const [fechaDesde, setFechaDesde] = useState(hace7DiasISO);
  const [fechaHasta, setFechaHasta] = useState(hoyISO);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<string>("");
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  const equipoIdFiltro =
    equipoSeleccionado !== "" ? Number(equipoSeleccionado) : undefined;

  const { equipos } = useEquipos();
  const { historial, loading, error, recargar } = useHistorialChecklists(
    fechaDesde,
    fechaHasta,
    equipoIdFiltro
  );

  const toggleExpandido = (checklistId: number) => {
    setExpandidos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(checklistId)) {
        nuevo.delete(checklistId);
      } else {
        nuevo.add(checklistId);
      }
      return nuevo;
    });
  };

  const checklists = useMemo(() => historial?.checklists ?? [], [historial]);

  /** Botón de "Ver/ocultar N incumplidas" dentro de la celda. */
  const botonIncumplidas = (checklistId: number, cantidad: number) => (
    <BotonTexto onClick={() => toggleExpandido(checklistId)}>
      {expandidos.has(checklistId) ? "Ocultar" : `Ver ${cantidad}`}
    </BotonTexto>
  );

  return (
    <Box p="20px">
      <HStack justify="space-between" mb="20px" flexWrap="wrap" gap="15px">
        <Box>
          <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
            Historial de Checklists
          </Heading>
          <Text color="gray.600" fontSize="14px" mt="2px">
            Cumplimiento por período, filtrado por rango de fechas y equipo.
          </Text>
        </Box>
        <Button
          bg="gray.200"
          color="gray.800"
          fontSize="14px"
          fontWeight="bold"
          height="auto"
          p="8px 16px"
          rounded="md"
          onClick={recargar}
          _hover={{ bg: "gray.300" }}
        >
          Actualizar
        </Button>
      </HStack>

      <Tarjeta p="20px" mb="25px">
        <HStack gap="20px" flexWrap="wrap" align="flex-end">
          <Box minW="180px">
            <Field.Root>
              <LabelFiltro>DESDE</LabelFiltro>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                p="10px 14px"
                rounded="lg"
                borderWidth={2}
                borderColor="brand.300"
                fontSize="15px"
                w="auto"
              />
            </Field.Root>
          </Box>
          <Box minW="180px">
            <Field.Root>
              <LabelFiltro>HASTA</LabelFiltro>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                p="10px 14px"
                rounded="lg"
                borderWidth={2}
                borderColor="brand.300"
                fontSize="15px"
                w="auto"
              />
            </Field.Root>
          </Box>
          <Box minW="200px">
            <Field.Root>
              <LabelFiltro>EQUIPO</LabelFiltro>
              <NativeSelect.Root w="100%" rounded="lg">
                <NativeSelect.Field
                  value={equipoSeleccionado}
                  onChange={(e) => setEquipoSeleccionado(e.target.value)}
                  p="10px 14px"
                  borderWidth={2}
                  borderColor="brand.300"
                  fontSize="15px"
                  bg="white"
                >
                  <option value="">Todos los equipos</option>
                  {equipos.map((equipo) => (
                    <option key={equipo.id} value={equipo.id}>
                      {equipo.nombre}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
          </Box>
        </HStack>
      </Tarjeta>

      {error && (
        <Box
          bg="red.100"
          color="red.800"
          p="12px"
          rounded="lg"
          mb="20px"
          border="1px solid"
          borderColor="red.200"
          fontWeight="bold"
        >
          ⚠️ {error}
        </Box>
      )}

      {loading && (
        <HStack justify="center" p={10}>
          <Spinner size="lg" color="brand.500" />
          <Text color="gray.600">Cargando historial...</Text>
        </HStack>
      )}

      {!loading && historial && checklists.length === 0 && !error && (
        <Box bg="white" rounded="lg" p={10} textAlign="center">
          <Text fontSize="16px" color="gray.600">
            No hay checklists registrados en el rango seleccionado.
          </Text>
        </Box>
      )}

      {!loading && historial && checklists.length > 0 && (
        <>
          <HStack justify="space-between" mb="16px">
            <Text fontSize="14px" color="gray.600">
              Cumplimiento general del período:{" "}
              <Text
                as="span"
                fontWeight="bold"
                color={colorPorcentaje(historial.porcentaje_cumplimiento_general)}
              >
                {historial.porcentaje_cumplimiento_general.toFixed(0)}%
              </Text>
            </Text>
          </HStack>

          <Tarjeta>
            <Table.Root w="100%">
              <Table.Header>
                <Table.Row>
                  <ColumnaHeader>Fecha</ColumnaHeader>
                  <ColumnaHeader>Equipo</ColumnaHeader>
                  <ColumnaHeader>Estado</ColumnaHeader>
                  <ColumnaHeader center>Cumplimiento</ColumnaHeader>
                  <ColumnaHeader center width="160px">
                    Incumplidas
                  </ColumnaHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {checklists.map((cl) => (
                  <Fragment key={cl.checklist_id}>
                    <Table.Row>
                      <Celda>{cl.fecha}</Celda>
                      <Celda>{cl.equipo_nombre}</Celda>
                      <Celda>{cl.estado}</Celda>
                      <Celda center>
                        <Text fontWeight="bold" color={colorPorcentaje(cl.porcentaje_cumplimiento)}>
                          {cl.porcentaje_cumplimiento.toFixed(0)}%
                        </Text>
                        <Text fontSize="12px" color="gray.500">
                          {cl.tareas_completadas}/{cl.total_tareas}
                        </Text>
                      </Celda>
                      <Celda center>
                        {cl.tareas_incumplidas.length === 0 ? (
                          <Text fontSize="13px" color="gray.400">—</Text>
                        ) : (
                          botonIncumplidas(cl.checklist_id, cl.tareas_incumplidas.length)
                        )}
                      </Celda>
                    </Table.Row>
                    {expandidos.has(cl.checklist_id) && (
                      <Table.Row>
                        <Table.Cell
                          colSpan={5}
                          color="gray.800"
                          fontSize="14px"
                          p="10px 16px"
                          borderBottom="1px solid"
                          borderColor="gray.100"
                          bg="red.50"
                        >
                          <Text fontSize="13px" fontWeight="bold" color="red.800" mb="6px">
                            Tareas incumplidas:
                          </Text>
                          {cl.tareas_incumplidas.map((t, i) => (
                            <Text key={t.tarea_id ?? i} fontSize="13px" color="gray.600">
                              • {t.nombre}
                            </Text>
                          ))}
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Fragment>
                ))}
              </Table.Body>
            </Table.Root>
          </Tarjeta>
        </>
      )}
    </Box>
  );
}
