import { useNavigate } from "react-router-dom";
import { Box, Button, Heading, HStack, Spinner, Table, Text } from "@chakra-ui/react";
import {
  BannerError,
  BotonTabla,
  BotonTexto,
  Celda,
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";
import { useDocumentos } from "../hooks/useDocumentos";
import { abrirArchivo } from "../services/documentoService";
import { etiquetaTipo, fechaCorta } from "../utils/formato";

export function DocumentosPage() {
  const navigate = useNavigate();
  const { documentos, loading, error } = useDocumentos();

  return (
    <Box p="5">
      <HStack justify="space-between" mb="5">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
          Documentos
        </Heading>
        <Button
          colorPalette="brand"
          fontSize="md"
          fontWeight="bold"
          rounded="md"
          px="5"
          py="2.5"
          onClick={() => navigate("/documentos/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>

      {loading && <Spinner color="brand.500" />}
      {!loading && error && <BannerError>{error}</BannerError>}

      {!loading && !error && documentos.length === 0 && (
        <Tarjeta p={8} textAlign="center">
          <Text color="gray.500">Todavía no hay documentos cargados.</Text>
        </Tarjeta>
      )}

      {!loading && !error && documentos.length > 0 && (
        <Tarjeta>
          <Table.Root variant="outline" w="100%">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Documento</EncabezadoOscuro>
                <EncabezadoOscuro>Tipo</EncabezadoOscuro>
                <EncabezadoOscuro>Versión vigente</EncabezadoOscuro>
                <EncabezadoOscuro>Archivadas</EncabezadoOscuro>
                <EncabezadoOscuro center>Acciones</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {documentos.map((doc) => {
                const vigente = doc.version_vigente;
                return (
                  <Table.Row key={doc.id}>
                    <Celda p="3" fontSize="md">
                      {doc.nombre}
                    </Celda>
                    <Celda p="3" fontSize="md">
                      {etiquetaTipo(doc.tipo)}
                    </Celda>
                    <Celda p="3" fontSize="md">
                      {vigente ? (
                        <>
                          <BotonTexto
                            onClick={() =>
                              abrirArchivo(vigente.archivo_url).catch(() =>
                                alert("No se pudo abrir el documento"),
                              )
                            }
                          >
                            v{vigente.numero_version}
                          </BotonTexto>{" "}
                          <Text as="span" color="gray.500" fontSize="xs">
                            (desde {fechaCorta(vigente.vigente_desde)})
                          </Text>
                        </>
                      ) : (
                        <Text as="span" color="gray.400">
                          Sin vigente
                        </Text>
                      )}
                    </Celda>
                    <Celda p="3" fontSize="md">
                      {doc.cantidad_archivadas}
                    </Celda>
                    <Celda p="3" center>
                      <HStack justify="center" gap="2">
                        <BotonTabla
                          accion="editar"
                          onClick={() => navigate(`/documentos/${doc.id}/nueva-version`)}
                        >
                          Subir nueva versión
                        </BotonTabla>
                        {/* Acción de marca: `BotonTabla` no tiene una paleta
                            "principal" para este caso (ver informe). */}
                        <Button
                          type="button"
                          colorPalette="brand"
                          variant="solid"
                          size="sm"
                          fontWeight="normal"
                          h="auto"
                          px="3"
                          py="1.5"
                          rounded="md"
                          onClick={() => navigate(`/documentos/${doc.id}/historial`)}
                        >
                          Ver historial
                        </Button>
                      </HStack>
                    </Celda>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Tarjeta>
      )}
    </Box>
  );
}