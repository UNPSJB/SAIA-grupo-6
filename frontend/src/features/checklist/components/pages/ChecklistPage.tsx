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
import { obtenerHistorialRegistro } from "../../services/checklistService";
import type { HistorialRegistroTareaItem } from "../../types/checklist";

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

function fechaLocalISO(fecha: Date): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Fila de tarea como componente propio: cada fila necesita su propio
// estado de archivo-pendiente y su propio modal de foto, así que no
// puede vivir como estado único en ChecklistPage (se pisaría entre filas).
interface FilaTareaProps {
  tarea: TareaDelDia;
  isLoading: boolean;
  onToggle: (tareaId: number, estadoActual: boolean, evidencia?: File) => void;
}

function FilaTarea({ tarea, isLoading, onToggle }: FilaTareaProps) {
  const [archivoEvidencia, setArchivoEvidencia] = useState<File | null>(null);
  const [imagenModalUrl, setImagenModalUrl] = useState<string | null>(null);
  const [historial, setHistorial] = useState<
    HistorialRegistroTareaItem[] | null
  >(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const verHistorial = async () => {
    if (tarea.registro_id === 0) return; // preview de fecha futura, no hay nada que auditar todavía
    setCargandoHistorial(true);
    try {
      const datos = await obtenerHistorialRegistro(tarea.registro_id);
      setHistorial(datos.eventos);
    } catch {
      setHistorial([]);
    } finally {
      setCargandoHistorial(false);
    }
  };

  const esHistorico = tarea.checklist_estado === "cerrado";
  const esFuturo = tarea.registro_id === 0;
  const esCerrado = esHistorico || esFuturo;

  const urlFoto = tarea.evidencia_url
    ? `http://localhost:8000/${tarea.evidencia_url.replace(/\\/g, "/")}`
    : null;

  const handleCheckboxClick = () => {
    onToggle(tarea.id, tarea.completado, archivoEvidencia || undefined);
    setArchivoEvidencia(null);
  };

  return (
    <>
      <Table.Row
        key={tarea.registro_id > 0 ? `r-${tarea.registro_id}` : `p-${tarea.id}`}
      >
        <Table.Cell style={{ ...estiloCelda, opacity: esCerrado ? 0.7 : 1 }}>
          {tarea.nombre}

          {/* Adjuntar evidencia: solo tiene sentido si todavía se puede marcar */}
          {!tarea.completado && !esCerrado && (
            <Box mt="8px">
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                id={`evidencia-${tarea.registro_id}-${tarea.id}`}
                onChange={(e) =>
                  setArchivoEvidencia(e.target.files?.[0] || null)
                }
              />
              <HStack gap="10px">
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(
                        `evidencia-${tarea.registro_id}-${tarea.id}`,
                      )
                      ?.click()
                  }
                  style={{
                    fontSize: "12px",
                    padding: "4px 8px",
                    backgroundColor: "#e2e8f0",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Adjuntar Evidencia
                </button>
                {archivoEvidencia && (
                  <Text fontSize="12px" color={TEAL} fontWeight="bold">
                    {archivoEvidencia.name} (Lista para enviar)
                  </Text>
                )}
              </HStack>
            </Box>
          )}
        </Table.Cell>

        <Table.Cell style={{ ...estiloCelda, textAlign: "center" }}>
          {isLoading ? (
            <Spinner size="sm" color={TEAL} />
          ) : esFuturo ? (
            <Text fontSize="13px" color="gray.400">
              —
            </Text>
          ) : esHistorico ? (
            <Text
              fontSize="17px"
              fontWeight="bold"
              color={tarea.completado ? "#2f9e44" : "#c92a2a"}
              title={
                tarea.completado
                  ? "Completada (checklist cerrado: dato histórico)"
                  : "No completada (checklist cerrado: dato histórico)"
              }
            >
              {tarea.completado ? "✔" : "✕"}
            </Text>
          ) : (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              gap="4px"
            >
              <input
                type="checkbox"
                checked={tarea.completado}
                onChange={handleCheckboxClick}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              {urlFoto && (
                <button
                  type="button"
                  onClick={() => setImagenModalUrl(urlFoto)}
                  style={{
                    fontSize: "11px",
                    color: TEAL,
                    background: "none",
                    border: "none",
                    textDecoration: "underline",
                    fontWeight: "bold",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Ver foto
                </button>
              )}
              {tarea.registro_id > 0 && (
                <button
                  type="button"
                  onClick={verHistorial}
                  style={{
                    fontSize: "11px",
                    color: "#888",
                    background: "none",
                    border: "none",
                    textDecoration: "underline",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Historial
                </button>
              )}
            </Box>
          )}
        </Table.Cell>
      </Table.Row>

      {imagenModalUrl && (
        <Box
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
          }}
        >
          <Box
            style={{
              backgroundColor: "white",
              padding: "25px",
              borderRadius: "12px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
              maxWidth: "90%",
              maxHeight: "90%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "15px",
            }}
          >
            <img
              src={imagenModalUrl}
              alt="Evidencia fotográfica"
              style={{
                maxWidth: "100%",
                maxHeight: "70vh",
                objectFit: "contain",
                borderRadius: "8px",
              }}
            />
            <Button
              onClick={() => setImagenModalUrl(null)}
              style={{
                backgroundColor: TEAL,
                color: "white",
                padding: "8px 24px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Volver
            </Button>
          </Box>
        </Box>
      )}

      {historial && (
        <Box
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2100,
            padding: "20px",
          }}
        >
          <Box
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "10px",
              maxWidth: "480px",
              width: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <Text fontWeight="bold" mb="12px">
              Historial de cambios — {tarea.nombre}
            </Text>
            {cargandoHistorial ? (
              <Spinner size="sm" color={TEAL} />
            ) : historial.length === 0 ? (
              <Text fontSize="13px" color="gray.500">
                Sin eventos registrados todavía.
              </Text>
            ) : (
              historial.map((ev) => (
                <Box
                  key={ev.id}
                  style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}
                >
                  <Text fontSize="13px">
                    {ev.completado ? "✔ Marcada" : "✕ Desmarcada"} —{" "}
                    {new Date(ev.fecha_evento).toLocaleString()}
                    {ev.evidencia_url ? " · con foto adjunta" : ""}
                  </Text>
                </Box>
              ))
            )}
            <Button mt="12px" onClick={() => setHistorial(null)}>
              Cerrar
            </Button>
          </Box>
        </Box>
      )}
    </>
  );
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
            Control, persistencia e historial auditable por fecha, para todos
            los equipos.
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
                    <Table.ColumnHeader style={estiloHeaderCelda}>
                      Tarea
                    </Table.ColumnHeader>
                    <Table.ColumnHeader
                      style={{
                        ...estiloHeaderCelda,
                        textAlign: "center",
                        width: "140px",
                      }}
                    >
                      Completada
                    </Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {grupo.tareas.map((t) => (
                    <FilaTarea
                      key={
                        t.registro_id > 0 ? `r-${t.registro_id}` : `p-${t.id}`
                      }
                      tarea={t}
                      isLoading={actualizandoId === t.id}
                      onToggle={toggleTarea}
                    />
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}
