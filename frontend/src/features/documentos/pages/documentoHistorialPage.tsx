import { useParams } from "react-router-dom";
import { Badge, Table } from "@chakra-ui/react";
import {
  BannerError,
  BotonTexto,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  FilaEncabezado,
  Tarjeta,
  TextoTruncado,
} from "../../../components/ui/patrones";
import { PaginaDetalle } from "../../../components/ui/plantillas";
import { useHistorialDocumento } from "../hooks/useHistorialDocumento";
import { abrirArchivo } from "../services/documentoService";
import type { EstadoVersion } from "../types/documento";
import { etiquetaTipo, fechaHora, fechaCorta } from "../utils/formato";

const PALETA_ESTADO: Record<
  EstadoVersion,
  "green" | "red" | "gray"
> = {
  vigente: "green",
  vencido: "red",
  archivado: "gray",
};

const ETIQUETA_ESTADO: Record<EstadoVersion, string> = {
  vigente: "Vigente",
  vencido: "Vencido",
  archivado: "Archivado",
};

export function DocumentoHistorialPage() {
  const { id } = useParams();
  const documentoId = Number(id);

  const { historial, loading, error } = useHistorialDocumento(documentoId);

  return (
    <PaginaDetalle
      volver={{ a: "/documentos", etiqueta: "Documentos", historial: true }}
      titulo={
          historial ? (
            <>
              {/*
               * El nombre completo va en el `title` del truncado (tooltip):
               * sin tope, un nombre largo empujaba el título fuera de la
               * pantalla. `inline-block` es lo que deja aplicar elipsis a
               * un span dentro del encabezado.
               */}
              Historial:{" "}
              <TextoTruncado
                as="span"
                display="inline-block"
                verticalAlign="bottom"
                texto={historial.nombre}
                max={40}
              />
            </>
          ) : (
            "Historial"
          )
        }
      descripcion={
        historial
          ? `${etiquetaTipo(historial.tipo)} · Solo lectura: las versiones anteriores no pueden editarse ni eliminarse.`
          : undefined
      }
    >
      {loading && <EstadoCargando>Cargando historial...</EstadoCargando>}
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
                <EncabezadoOscuro>Fecha de vencimiento</EncabezadoOscuro>
                <EncabezadoOscuro>Subida por</EncabezadoOscuro>
                <EncabezadoOscuro>Archivo</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {historial.versiones.map((v) => (
                <Table.Row key={v.id}>
                  <Celda p="3" color="brand.fg" fontWeight="bold">
                    v{v.numero_version}
                  </Celda>
                  <Celda p="3">
                    <Badge
                      colorPalette={PALETA_ESTADO[v.estado]}
                      rounded="full"
                      px="2"
                      py="1"
                      fontSize="xs"
                      fontWeight="bold"
                    >
                      {ETIQUETA_ESTADO[v.estado]}
                    </Badge>
                  </Celda>
                  <Celda p="3">{fechaHora(v.vigente_desde)}</Celda>
                  <Celda p="3">
                    {v.vigente_hasta ? fechaHora(v.vigente_hasta) : "Actual"}
                  </Celda>
                  <Celda p="3">
                    {v.fecha_vencimiento
                      ? fechaCorta(v.fecha_vencimiento)
                      : "Sin vencimiento"}
                  </Celda>
                  <Celda p="3">
                    {v.autor.nombre} {v.autor.apellido ?? ""}
                  </Celda>
                  <Celda p="3">
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
    </PaginaDetalle>
  );
}