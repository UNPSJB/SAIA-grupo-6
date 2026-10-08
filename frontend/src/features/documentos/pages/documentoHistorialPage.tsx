import { useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import {
  BannerError,
  BotonTexto,
  Celda,
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";
import { useHistorialDocumento } from "../hooks/useHistorialDocumento";
import { abrirArchivo } from "../services/documentoService";
import type { EstadoVersion } from "../types/documento";
import { etiquetaTipo, fechaHora } from "../utils/formato";

/** Píldora de estado de cada versión del documento. */
const PALETA_ESTADO: Record<EstadoVersion, "green" | "gray"> = {
  vigente: "green",
  archivada: "gray",
};

const ETIQUETA_ESTADO: Record<EstadoVersion, string> = {
  vigente: "Vigente",
  archivada: "Archivada",
};

export function DocumentoHistorialPage() {
  const { id } = useParams();
  const documentoId = Number(id);
  const navigate = useNavigate();

  const { historial, loading, error } = useHistorialDocumento(documentoId);

  return (
    <Box p="5">
      <HStack justify="space-between" mb="5">
        <Box>
          <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
            Historial{historial ? `: ${historial.nombre}` : ""}
          </Heading>
          {historial && (
            <Text color="gray.600">
              {etiquetaTipo(historial.tipo)} · Solo lectura: las versiones
              anteriores no pueden editarse ni eliminarse.
            </Text>
          )}
        </Box>
        <Button
          colorPalette="gray"
          variant="solid"
          fontSize="md"
          fontWeight="normal"
          h="auto"
          minW="auto"
          px="4"
          py="2"
          rounded="md"
          onClick={() => navigate(-1)}
        >
          Volver
        </Button>
      </HStack>

      {loading && <Spinner color="brand.500" />}
      {!loading && error && <BannerError>{error}</BannerError>}

      {historial && (
        <Tarjeta overflowX="auto">
          <Table.Root variant="outline" w="100%">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Versión</EncabezadoOscuro>
                <EncabezadoOscuro>Estado</EncabezadoOscuro>
                <EncabezadoOscuro>Vigente desde</EncabezadoOscuro>
                <EncabezadoOscuro>Vigente hasta</EncabezadoOscuro>
                <EncabezadoOscuro>Subida por</EncabezadoOscuro>
                <EncabezadoOscuro>Archivo</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {historial.versiones.map((v) => (
                <Table.Row key={v.id}>
                  <Celda p="3" color="brand.500" fontWeight="bold" fontSize="md">
                    v{v.numero_version}
                  </Celda>
                  <Celda p="3">
                    <Badge
                      colorPalette={PALETA_ESTADO[v.estado]}
                      rounded="full"
                      px="2.5"
                      py="1"
                      fontSize="xs"
                      fontWeight="bold"
                    >
                      {ETIQUETA_ESTADO[v.estado]}
                    </Badge>
                  </Celda>
                  <Celda p="3" fontSize="sm">
                    {fechaHora(v.vigente_desde)}
                  </Celda>
                  <Celda p="3" fontSize="sm">
                    {v.vigente_hasta ? fechaHora(v.vigente_hasta) : "Actual"}
                  </Celda>
                  <Celda p="3" fontSize="sm">
                    {v.autor.nombre} {v.autor.apellido ?? ""}
                  </Celda>
                  <Celda p="3" fontSize="md">
                    <BotonTexto
                      onClick={() =>
                        abrirArchivo(v.archivo_url).catch(() =>
                          alert("No se pudo abrir el documento"),
                        )
                      }
                    >
                      {v.nombre_archivo}
                    </BotonTexto>
                  </Celda>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Tarjeta>
      )}
    </Box>
  );
}