import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Heading,
  HStack,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import { useHistorialDocumento } from "../hooks/useHistorialDocumento";
import { abrirArchivo } from "../services/documentoService";
import type { EstadoVersion } from "../types/documento";
import { etiquetaTipo, fechaHora } from "../utils/formato";

const TEAL = "#468189";
const th = { padding: "12px" };

const ESTILO_ESTADO: Record<
  EstadoVersion,
  { bg: string; color: string; label: string }
> = {
  vigente: { bg: "#d4edda", color: "#155724", label: "Vigente" },
  archivada: { bg: "#e2e3e5", color: "#383d41", label: "Archivada" },
};

export function DocumentoHistorialPage() {
  const { id } = useParams();
  const documentoId = Number(id);
  const navigate = useNavigate();

  const { historial, loading, error } = useHistorialDocumento(documentoId);

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        <Box>
          <Heading as="h2" size="md" fontWeight="bold" color="black">
            Historial{historial ? `: ${historial.nombre}` : ""}
          </Heading>
          {historial && (
            <Text style={{ color: "#555" }}>
              {etiquetaTipo(historial.tipo)} · Solo lectura: las versiones
              anteriores no pueden editarse ni eliminarse.
            </Text>
          )}
        </Box>
        <Button
          bg="#6c757d"
          color="white"
          fontSize="16px"
          fontWeight="normal"
          height="auto"
          minW="auto"
          style={{ border: "none", padding: "8px 16px", borderRadius: "6px" }}
          _hover={{ bg: "#6c757d" }}
          onClick={() => navigate(-1)}
        >
          Volver
        </Button>
      </HStack>

      {loading && <Spinner />}
      {!loading && error && <Text color="red.500">{error}</Text>}

      {historial && (
        <Box bg="white" style={{ borderRadius: "8px", overflowX: "auto" }}>
          <Table.Root
            variant="outline"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <Table.Header>
              <Table.Row
                bg={TEAL}
                style={{ color: "white", textAlign: "left" }}
              >
                <Table.ColumnHeader
                  fontWeight="normal"
                  fontSize="16px"
                  style={th}
                >
                  Versión
                </Table.ColumnHeader>
                <Table.ColumnHeader
                  fontWeight="normal"
                  fontSize="16px"
                  style={th}
                >
                  Estado
                </Table.ColumnHeader>
                <Table.ColumnHeader
                  fontWeight="normal"
                  fontSize="16px"
                  style={th}
                >
                  Vigente desde
                </Table.ColumnHeader>
                <Table.ColumnHeader
                  fontWeight="normal"
                  fontSize="16px"
                  style={th}
                >
                  Vigente hasta
                </Table.ColumnHeader>
                <Table.ColumnHeader
                  fontWeight="normal"
                  fontSize="16px"
                  style={th}
                >
                  Subida por
                </Table.ColumnHeader>
                <Table.ColumnHeader
                  fontWeight="normal"
                  fontSize="16px"
                  style={th}
                >
                  Archivo
                </Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {historial.versiones.map((v) => {
                const est = ESTILO_ESTADO[v.estado];
                return (
                  <Table.Row
                    key={v.id}
                    style={{ borderBottom: "1px solid #eee" }}
                  >
                    <Table.Cell
                      color={TEAL}
                      fontWeight="bold"
                      fontSize="16px"
                      style={th}
                    >
                      v{v.numero_version}
                    </Table.Cell>
                    <Table.Cell style={th}>
                      <span
                        style={{
                          backgroundColor: est.bg,
                          color: est.color,
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "13px",
                          fontWeight: "bold",
                        }}
                      >
                        {est.label}
                      </span>
                    </Table.Cell>
                    <Table.Cell fontSize="14px" style={th}>
                      {fechaHora(v.vigente_desde)}
                    </Table.Cell>
                    <Table.Cell fontSize="14px" style={th}>
                      {v.vigente_hasta ? fechaHora(v.vigente_hasta) : "Actual"}
                    </Table.Cell>
                    <Table.Cell fontSize="14px" style={th}>
                      {v.autor.nombre} {v.autor.apellido ?? ""}
                    </Table.Cell>
                    <Table.Cell fontSize="16px" style={th}>
                      <button
                        type="button"
                        onClick={() =>
                          abrirArchivo(v.archivo_url).catch(() =>
                            alert("No se pudo abrir el documento"),
                          )
                        }
                        style={{
                          color: TEAL,
                          fontWeight: "bold",
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          textDecoration: "underline",
                          fontSize: "inherit",
                        }}
                      >
                        {v.nombre_archivo}
                      </button>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      )}
    </Box>
  );
}
