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
  PildoraNeutra,
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
          {/* Siete columnas sin ancho se repartían en partes iguales: la
              versión ("v3") ocupaba lo mismo que el nombre del archivo, y la
              fecha con hora y el archivo se salían de su celda. */}
          <Table.Root variant="outline" w="100%" minW="900px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro width="9%">Versión</EncabezadoOscuro>
                <EncabezadoOscuro center ancho="angosta">Estado</EncabezadoOscuro>
                <EncabezadoOscuro ancho="media">Vigente desde</EncabezadoOscuro>
                <EncabezadoOscuro ancho="media">Vigente hasta</EncabezadoOscuro>
                <EncabezadoOscuro ancho="media">Fecha de vencimiento</EncabezadoOscuro>
                <EncabezadoOscuro>Subida por</EncabezadoOscuro>
                <EncabezadoOscuro>Archivo</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {historial.versiones.map((v) => (
                <Table.Row key={v.id}>
                  <Celda>
                    <PildoraNeutra mono>v{v.numero_version}</PildoraNeutra>
                  </Celda>
                  <Celda center>
                    <Badge
                      colorPalette={PALETA_ESTADO[v.estado]}
                      variant="subtle"
                      rounded="full"
                      px="2.5"
                      py="1"
                      fontWeight="medium"
                    >
                      {ETIQUETA_ESTADO[v.estado]}
                    </Badge>
                  </Celda>
                  <Celda>{fechaHora(v.vigente_desde)}</Celda>
                  <Celda>
                    {v.vigente_hasta ? fechaHora(v.vigente_hasta) : "Actual"}
                  </Celda>
                  <Celda>
                    {v.fecha_vencimiento
                      ? fechaCorta(v.fecha_vencimiento)
                      : "Sin vencimiento"}
                  </Celda>
                  <Celda>
                    {v.autor.nombre} {v.autor.apellido ?? ""}
                  </Celda>
                  <Celda>
                    <BotonTexto
                      title={v.nombre_archivo}
                      maxW="100%"
                      display="block"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                      textAlign="left"
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