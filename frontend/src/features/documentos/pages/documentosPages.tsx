import { useNavigate } from "react-router-dom";
import { Box, Button, HStack, Spinner, Table, Text } from "@chakra-ui/react";
import {
  BannerError,
  BotonTabla,
  BotonTexto,
  Celda,
  EncabezadoOscuro,
  FilaEncabezado,
  PageHeader,
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
      <PageHeader
        title="Documentos"
        description="Manuales, procedimientos y registros del sistema de calidad."
        actions={
          <Button colorPalette="brand" onClick={() => navigate("/documentos/nuevo")}>
            + Agregar
          </Button>
        }
      />

      {loading && <Spinner color="brand.500" />}
      {!loading && error && <BannerError>{error}</BannerError>}

      {!loading && !error && documentos.length === 0 && (
        <Tarjeta p="6" textAlign="center">
          <Text color="fg.muted">Todavía no hay documentos cargados.</Text>
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
                    <Celda p="3">{doc.nombre}</Celda>
                    <Celda p="3">{etiquetaTipo(doc.tipo)}</Celda>
                    <Celda p="3">
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
                          <Text as="span" color="fg.muted" fontSize="xs">
                            (desde {fechaCorta(vigente.vigente_desde)})
                          </Text>
                        </>
                      ) : (
                        <Text as="span" color="fg.subtle">
                          Sin vigente
                        </Text>
                      )}
                    </Celda>
                    <Celda p="3">{doc.cantidad_archivadas}</Celda>
                    <Celda p="3" center>
                      <HStack justify="center" gap="2">
                        <BotonTabla
                          accion="editar"
                          onClick={() => navigate(`/documentos/${doc.id}/nueva-version`)}
                        >
                          Subir nueva versión
                        </BotonTabla>
                        <BotonTabla
                          accion="historial"
                          onClick={() => navigate(`/documentos/${doc.id}/historial`)}
                        >
                          Ver historial
                        </BotonTabla>
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