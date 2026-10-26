import { useNavigate } from "react-router-dom";
import { Badge, Box, Button, HStack, Spinner, Table, Text } from "@chakra-ui/react";
import {
  BannerError,
  BotonTabla,
  BotonTexto,
  Celda,
  EncabezadoOscuro,
  FilaEncabezado,
  PageHeader,
  Paginacion,
  Tarjeta,
  TextoTruncado,
} from "../../../components/ui/patrones";
import { useDocumentos } from "../hooks/useDocumentos";
import { abrirArchivo } from "../services/documentoService";
import { etiquetaTipo, fechaCorta } from "../utils/formato";

const PAGE_SIZE = 10;

export function DocumentosPage() {
  const navigate = useNavigate();
  const {
    documentos,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
  } = useDocumentos(PAGE_SIZE);

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
        <>
          <Tarjeta overflowX="auto">
            <Table.Root variant="outline" w="100%" minW="1080px">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOscuro>Documento</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="media">Tipo</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="media">Versión vigente</EncabezadoOscuro>
                  <EncabezadoOscuro>Estado</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="media">Archivadas</EncabezadoOscuro>
                  <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {documentos.map((doc) => {
                  const vigente = doc.version_vigente;
                  return (
                    <Table.Row key={doc.id}>
                      <Celda p="3">
                        <TextoTruncado texto={doc.nombre} />
                      </Celda>
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
                      <Celda p="3">
                        {vigente ? (
                          <Badge
                            colorPalette={
                              vigente.estado === "vencido"
                                ? "red"
                                : "green"
                            }
                            rounded="full"
                            px="2"
                            py="1"
                            fontSize="xs"
                            fontWeight="bold"
                          >
                            {vigente.estado === "vencido" ? "Vencido" : "Vigente"}
                          </Badge>
                        ) : (
                          <Badge
                            colorPalette="gray"
                            rounded="full"
                            px="2"
                            py="1"
                            fontSize="xs"
                            fontWeight="bold"
                          >
                            Archivado
                          </Badge>
                        )}

                        {vigente?.fecha_vencimiento && (
                          <Text color="fg.muted" fontSize="xs" mt="1">
                            Vence: {fechaCorta(vigente.fecha_vencimiento)}
                          </Text>
                        )}
                      </Celda>
                      <Celda p="3">{doc.cantidad_archivadas}</Celda>
                      <Celda p="3" center>
                        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
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

          {hayVariasPaginas && (
            <Paginacion
              count={total}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </Box>
  );
}