import { useMemo, useState } from "react";
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
import { useChecklist } from "../../hooks/useChecklist";
import type { TareaDelDia } from "../../types/checklist";

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

interface GrupoPlan {
  key: string;
  planNombre: string;
  equipoNombre: string;
  tareas: TareaDelDia[];
}

function agruparPorPlan(tareas: TareaDelDia[]): GrupoPlan[] {
  const grupos = new Map<string, GrupoPlan>();

  for (const tarea of tareas) {
    // Agrupamos por equipo + plan, no solo por plan: si un plan se
    // reasigna de un equipo a otro, el checklist viejo del equipo
    // anterior sigue existiendo con sus propios registros, y no debe
    // mezclarse con los del equipo nuevo aunque compartan plan_id.
    const key = `${tarea.equipo_id}-${tarea.plan_id ?? "sin-plan"}`;
    if (!grupos.has(key)) {
      grupos.set(key, {
        key,
        planNombre: tarea.plan_nombre,
        equipoNombre: tarea.equipo_nombre,
        tareas: [],
      });
    }
    grupos.get(key)!.tareas.push(tarea);
  }

  return Array.from(grupos.values());
}

// Ojo: Date.toISOString() convierte a UTC, así que a la noche (hora
// Argentina, UTC-3) devuelve la fecha del día siguiente. Armamos el
// string a partir de los componentes en horario local.
function fechaLocalISO(fecha: Date): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ChecklistPage() {
  const hoyISO = fechaLocalISO(new Date());
  const [selectedFecha, setSelectedFecha] = useState<string>(hoyISO);

  const { tareas, loading, error, actualizandoId, toggleTarea, recargar } =
    useChecklist(selectedFecha);

  const grupos = useMemo(() => agruparPorPlan(tareas), [tareas]);

  const totalTareas = tareas.length;
  const tareasCompletadas = tareas.filter((t) => t.completado).length;

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px" flexWrap="wrap" gap="15px">
        <Box>
          <Heading as="h2" size="md" fontWeight="bold" color="black">
            Checklist Diario de Limpieza
          </Heading>
          <Text color="gray.600" fontSize="14px" mt="2px">
            Control, persistencia e historial auditable por fecha, para todos los equipos.
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

      {/* Barra de Filtros: solo por fecha */}
      <Box
        bg="white"
        p="20px"
        borderRadius="10px"
        boxShadow="0 2px 6px rgba(0,0,0,0.05)"
        mb="25px"
      >
        <Box minW="180px">
          <Field.Root>
            <Box
              as="label"
              display="block"
              fontSize="14px"
              fontWeight="bold"
              mb="6px"
              color="#555"
            >
              FECHA
            </Box>
            <Input
              type="date"
              value={selectedFecha}
              onChange={(e) => setSelectedFecha(e.target.value)}
              style={estiloInput}
            />
          </Field.Root>
        </Box>
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
          <Text color="gray.600">Cargando tareas...</Text>
        </HStack>
      )}

      {!loading && grupos.length === 0 && !error && (
        <Box bg="white" borderRadius="8px" p={10} textAlign="center">
          <Text fontSize="16px" color="gray.600">
            No hay tareas de limpieza programadas para la fecha seleccionada.
          </Text>
        </Box>
      )}

      {!loading && grupos.length > 0 && (
        <>
          <HStack justify="space-between" mb="16px">
            <Text fontSize="14px" color="gray.600">
              Progreso general: <strong>{tareasCompletadas}</strong> de{" "}
              <strong>{totalTareas}</strong> tareas completadas.
            </Text>
          </HStack>

          {grupos.map((grupo) => (
            <Box key={grupo.key} style={estiloTarjeta} mb="20px">
              <Box
                style={{
                  backgroundColor: TEAL,
                  padding: "12px 16px",
                }}
              >
                <HStack justify="space-between">
                  <Box>
                    <Text fontSize="15px" fontWeight="bold" color="white">
                      {grupo.planNombre}
                    </Text>
                    <Text fontSize="12px" color="#DCEEEC" mt="2px">
                      Equipo: {grupo.equipoNombre}
                    </Text>
                  </Box>
                  {grupo.tareas[0]?.checklist_estado === "cerrado" && (
                    <Text
                      fontSize="11px"
                      fontWeight="bold"
                      color="white"
                      style={{
                        backgroundColor: "rgba(0,0,0,0.25)",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      🔒 Cerrado (histórico)
                    </Text>
                  )}
                  {grupo.tareas[0]?.registro_id === 0 && (
                    <Text
                      fontSize="11px"
                      fontWeight="bold"
                      color="white"
                      style={{
                        backgroundColor: "rgba(0,0,0,0.25)",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      📅 Vista previa
                    </Text>
                  )}
                </HStack>
              </Box>

              <Table.Root style={{ width: "100%", borderCollapse: "collapse" }}>
                <Table.Header>
                  <Table.Row style={estiloHeaderFila}>
                    <Table.ColumnHeader style={estiloHeaderCelda}>Tarea</Table.ColumnHeader>
                    <Table.ColumnHeader style={{ ...estiloHeaderCelda, textAlign: "center", width: "140px" }}>
                      Completada
                    </Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {grupo.tareas.map((t) => {
                    const esHistorico = t.checklist_estado === "cerrado";
                    const esFuturo = t.registro_id === 0;
                    const esCerrado = esHistorico || esFuturo;
                    return (
                      <Table.Row key={t.registro_id > 0 ? `r-${t.registro_id}` : `p-${t.id}`}>
                        <Table.Cell style={{ ...estiloCelda, opacity: esCerrado ? 0.7 : 1 }}>
                          {t.nombre}
                        </Table.Cell>
                        <Table.Cell style={{ ...estiloCelda, textAlign: "center" }}>
                          {actualizandoId === t.id ? (
                            <Spinner size="sm" color={TEAL} />
                          ) : esFuturo ? (
                            // Fecha futura: la tarea ni se creó todavía (vive en
                            // memoria como previsualización), así que no hay nada
                            // que marcar. Mostrar un checkbox acá no aporta nada.
                            <Text fontSize="13px" color="gray.400">
                              —
                            </Text>
                          ) : esHistorico ? (
                            // Checklist cerrado: se muestra el resultado ya
                            // fijado, con color para que se distinga de un
                            // vistazo (el checkbox nativo deshabilitado se ve
                            // gris tanto tildado como sin tildar).
                            <Text
                              fontSize="17px"
                              fontWeight="bold"
                              color={t.completado ? "#2f9e44" : "#c92a2a"}
                              title={
                                t.completado
                                  ? "Completada (checklist cerrado: dato histórico)"
                                  : "No completada (checklist cerrado: dato histórico)"
                              }
                            >
                              {t.completado ? "✔" : "✕"}
                            </Text>
                          ) : (
                            <input
                              type="checkbox"
                              checked={t.completado}
                              onChange={() => toggleTarea(t.id, t.completado)}
                              style={{ width: "18px", height: "18px", cursor: "pointer" }}
                            />
                          )}
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Root>
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}