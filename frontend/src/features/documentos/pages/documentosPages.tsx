import { useNavigate } from "react-router-dom";
import { Box, Button, Heading, HStack, Spinner, Table, Text } from "@chakra-ui/react";
import { useDocumentos } from "../hooks/useDocumentos";
import { urlArchivo } from "../services/documentoService";
import { etiquetaTipo, fechaCorta } from "../utils/formato";

const TEAL = "#468189";
const th = { padding: "12px" };

export function DocumentosPage() {
  const navigate = useNavigate();
  const { documentos, loading, error } = useDocumentos();

  return (
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Documentos
        </Heading>
        <Button
          bg={TEAL}
          color="white"
          fontSize="16px"
          fontWeight="bold"
          borderRadius="6px"
          px="20px"
          py="10px"
          _hover={{ bg: TEAL }}
          onClick={() => navigate("/documentos/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>

      {loading && <Spinner />}
      {!loading && error && <Text color="red.500">{error}</Text>}

      {!loading && !error && documentos.length === 0 && (
        <Box bg="white" style={{ borderRadius: "8px" }} p={8} textAlign="center">
          <Text color="gray.500">Todavía no hay documentos cargados.</Text>
        </Box>
      )}

      {!loading && !error && documentos.length > 0 && (
        <Box bg="white" style={{ borderRadius: "8px", overflow: "hidden" }}>
          <Table.Root variant="outline" style={{ width: "100%", borderCollapse: "collapse" }}>
            <Table.Header>
              <Table.Row bg={TEAL} style={{ color: "white", textAlign: "left" }}>
                <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={th}>Documento</Table.ColumnHeader>
                <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={th}>Tipo</Table.ColumnHeader>
                <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={th}>Versión vigente</Table.ColumnHeader>
                <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={th}>Archivadas</Table.ColumnHeader>
                <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ ...th, textAlign: "center" }}>Acciones</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {documentos.map((doc) => {
                const vigente = doc.version_vigente;
                return (
                  <Table.Row key={doc.id} style={{ borderBottom: "1px solid #eee" }}>
                    <Table.Cell fontSize="16px" style={th}>{doc.nombre}</Table.Cell>
                    <Table.Cell fontSize="16px" style={th}>{etiquetaTipo(doc.tipo)}</Table.Cell>
                    <Table.Cell fontSize="16px" style={th}>
                      {vigente ? (
                        <>
                          <a
                            href={urlArchivo(vigente.archivo_url)}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: TEAL, fontWeight: "bold" }}
                          >
                            v{vigente.numero_version}
                          </a>{" "}
                          <span style={{ color: "#777", fontSize: "13px" }}>
                            (desde {fechaCorta(vigente.vigente_desde)})
                          </span>
                        </>
                      ) : (
                        <span style={{ color: "#999" }}>Sin vigente</span>
                      )}
                    </Table.Cell>
                    <Table.Cell fontSize="16px" style={th}>{doc.cantidad_archivadas}</Table.Cell>
                    <Table.Cell style={{ ...th, textAlign: "center" }}>
                      <HStack justify="center" style={{ gap: "10px" }}>
                        <Button
                          bg="#f0ad4e"
                          color="white"
                          fontSize="16px"
                          fontWeight="normal"
                          style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
                          _hover={{ bg: "#f0ad4e" }}
                          onClick={() => navigate(`/documentos/${doc.id}/nueva-version`)}
                        >
                          Subir nueva versión
                        </Button>
                        <Button
                          bg={TEAL}
                          color="white"
                          fontSize="16px"
                          fontWeight="normal"
                          style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
                          _hover={{ bg: TEAL }}
                          onClick={() => navigate(`/documentos/${doc.id}/historial`)}
                        >
                          Ver historial
                        </Button>
                      </HStack>
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