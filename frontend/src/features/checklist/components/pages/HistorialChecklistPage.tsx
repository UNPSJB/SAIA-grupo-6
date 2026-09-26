import { Fragment, useMemo, useState } from "react";
import {
  Box,
  Heading,
  HStack,
  Input,
  Spinner,
  Text,
  Field,
  Button,
  Table,
} from "@chakra-ui/react";
import { useHistorialChecklists } from "../../hooks/useHistorialChecklists";
import { useEquipos } from "../../../equipo/hooks/useEquipos";

const TEAL = "#468189";
const TEAL_CLARO = "#90BEBB";

const estiloInput = {
  backgroundColor: "#fff",
  padding: "10px 14px",
  borderRadius: "8px",
  border: "2px solid #90BEBB",
  fontSize: "15px",
  color: "#333",
};

const estiloTarjeta = {
  backgroundColor: "#fff",
  borderRadius: "10px",
  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
  overflow: "hidden" as const,
};

const estiloHeaderFila = {
  backgroundColor: "#EAF3F2",
  borderBottom: `2px solid ${TEAL_CLARO}`,
};

const estiloHeaderCelda = {
  color: "#333",
  fontWeight: "bold" as const,
  fontSize: "13px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.03em",
  padding: "10px 16px",
};

const estiloCelda = {
  color: "#333",
  fontSize: "14px",
  padding: "10px 16px",
  borderBottom: "1px solid #eee",
  backgroundColor: "#fff",
};

function fechaLocalISO(fecha: Date): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function colorPorcentaje(pct: number): string {
  if (pct >= 80) return "#2f9e44";
  if (pct >= 50) return "#e8a13d";
  return "#c92a2a";
}

export function HistorialChecklistPage() {
  const hoyISO = fechaLocalISO(new Date());
  const hace7DiasISO = fechaLocalISO(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );

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

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px" flexWrap="wrap" gap="15px">
        <Box>
          <Heading as="h2" size="md" fontWeight="bold" color="black">
            Historial de Checklists
          </Heading>
          <Text color="gray.600" fontSize="14px" mt="2px">
            Cumplimiento por período, filtrado por rango de fechas y equipo.
          </Text>
        </Box>
        <Button
          bg="#e0e0e0"
          color="#333"
          fontSize="14px"
          fontWeight="bold"
          height="auto"
          onClick={recargar}
          style={{ padding: "8px 16px", borderRadius: "6px" }}
        >
          Actualizar
        </Button>
      </HStack>

      <Box
        bg="white"
        p="20px"
        borderRadius="10px"
        boxShadow="0 2px 6px rgba(0,0,0,0.05)"
        mb="25px"
      >
        <HStack gap="20px" flexWrap="wrap" align="flex-end">
          <Box minW="180px">
            <Field.Root>
              <Box as="label" display="block" fontSize="14px" fontWeight="bold" mb="6px" color="#555">
                DESDE
              </Box>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                style={estiloInput}
              />
            </Field.Root>
          </Box>
          <Box minW="180px">
            <Field.Root>
              <Box as="label" display="block" fontSize="14px" fontWeight="bold" mb="6px" color="#555">
                HASTA
              </Box>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                style={estiloInput}
              />
            </Field.Root>
          </Box>
          <Box minW="200px">
            <Field.Root>
              <Box as="label" display="block" fontSize="14px" fontWeight="bold" mb="6px" color="#555">
                EQUIPO
              </Box>
              <select
                value={equipoSeleccionado}
                onChange={(e) => setEquipoSeleccionado(e.target.value)}
                style={{ ...estiloInput, width: "100%" }}
              >
                <option value="">Todos los equipos</option>
                {equipos.map((equipo) => (
                  <option key={equipo.id} value={equipo.id}>
                    {equipo.nombre}
                  </option>
                ))}
              </select>
            </Field.Root>
          </Box>
        </HStack>
      </Box>

      {error && (
        <Box
          style={{
            backgroundColor: "#f8d7da",
            color: "#721c24",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "1px solid #f5c6cb",
            fontWeight: "bold",
          }}
        >
          ⚠️ {error}
        </Box>
      )}

      {loading && (
        <HStack justify="center" p={10}>
          <Spinner size="lg" color={TEAL} />
          <Text color="gray.600">Cargando historial...</Text>
        </HStack>
      )}

      {!loading && historial && checklists.length === 0 && !error && (
        <Box bg="white" borderRadius="8px" p={10} textAlign="center">
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
              <strong style={{ color: colorPorcentaje(historial.porcentaje_cumplimiento_general) }}>
                {historial.porcentaje_cumplimiento_general.toFixed(0)}%
              </strong>
            </Text>
          </HStack>

          <Box style={estiloTarjeta}>
            <Table.Root style={{ width: "100%", borderCollapse: "collapse" }}>
              <Table.Header>
                <Table.Row style={estiloHeaderFila}>
                  <Table.ColumnHeader style={estiloHeaderCelda}>Fecha</Table.ColumnHeader>
                  <Table.ColumnHeader style={estiloHeaderCelda}>Equipo</Table.ColumnHeader>
                  <Table.ColumnHeader style={estiloHeaderCelda}>Estado</Table.ColumnHeader>
                  <Table.ColumnHeader style={{ ...estiloHeaderCelda, textAlign: "center" }}>
                    Cumplimiento
                  </Table.ColumnHeader>
                  <Table.ColumnHeader style={{ ...estiloHeaderCelda, textAlign: "center", width: "160px" }}>
                    Incumplidas
                  </Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {checklists.map((cl) => (
                  <Fragment key={cl.checklist_id}>
                    <Table.Row>
                      <Table.Cell style={estiloCelda}>{cl.fecha}</Table.Cell>
                      <Table.Cell style={estiloCelda}>{cl.equipo_nombre}</Table.Cell>
                      <Table.Cell style={estiloCelda}>{cl.estado}</Table.Cell>
                      <Table.Cell style={{ ...estiloCelda, textAlign: "center" }}>
                        <Text fontWeight="bold" color={colorPorcentaje(cl.porcentaje_cumplimiento)}>
                          {cl.porcentaje_cumplimiento.toFixed(0)}%
                        </Text>
                        <Text fontSize="12px" color="gray.500">
                          {cl.tareas_completadas}/{cl.total_tareas}
                        </Text>
                      </Table.Cell>
                      <Table.Cell style={{ ...estiloCelda, textAlign: "center" }}>
                        {cl.tareas_incumplidas.length === 0 ? (
                          <Text fontSize="13px" color="gray.400">—</Text>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleExpandido(cl.checklist_id)}
                            style={{
                              fontSize: "12px",
                              color: TEAL,
                              background: "none",
                              border: "none",
                              textDecoration: "underline",
                              fontWeight: "bold",
                              cursor: "pointer",
                            }}
                          >
                            {expandidos.has(cl.checklist_id)
                              ? "Ocultar"
                              : `Ver ${cl.tareas_incumplidas.length}`}
                          </button>
                        )}
                      </Table.Cell>
                    </Table.Row>
                    {expandidos.has(cl.checklist_id) && (
                      <Table.Row>
                        <Table.Cell colSpan={5} style={{ ...estiloCelda, backgroundColor: "#faf5f5" }}>
                          <Text fontSize="13px" fontWeight="bold" color="#721c24" mb="6px">
                            Tareas incumplidas:
                          </Text>
                          {cl.tareas_incumplidas.map((t, i) => (
                            <Text key={t.tarea_id ?? i} fontSize="13px" color="#555">
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
          </Box>
        </>
      )}
    </Box>
  );
}