import { useNavigate, useParams } from "react-router-dom";
import { Badge, Box, Heading, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import { formatoFecha, formatoFechaHora } from "../../../../common/utils/fechas";
import { cantidadConUnidad } from "../../../../common/utils/numeros";
import {
  BannerError,
  BotonAccion,
  BotonCancelar,
  BotonVolver,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  FilaEncabezado,
  PageHeader,
  Tarjeta,
} from "../../../../components/ui/patrones";
import { BadgeEstadoLote } from "../../../lotes/components/BadgeEstadoLote";
import { trazarLoteProducto } from "../../services/trazabilidadService";

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text fontSize="xs" color="fg.muted">
        {etiqueta}
      </Text>
      <Text fontSize="sm" fontWeight="medium" color="fg">
        {children}
      </Text>
    </Box>
  );
}

export function TrazabilidadLoteProductoPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const loteId = Number(id);

  const { registro: traza, loading, error } = useRegistro({
    cargar: trazarLoteProducto,
    id: Number.isFinite(loteId) ? loteId : null,
    etiqueta: "la trazabilidad del lote",
  });

  return (
    <Box p="5" maxW="1100px" mx="auto">
      <PageHeader
        title={traza ? `Trazabilidad del lote ${traza.lote.numero_lote}` : "Trazabilidad del lote"}
        description="Del lote producido hasta el proveedor de cada insumo."
        actions={
          <>
            <BotonVolver onClick={() => navigate("/trazabilidad")}>Volver</BotonVolver>
            {traza && (
              <BotonCancelar onClick={() => navigate(`/lotes/${traza.lote.id}`)}>Abrir lote</BotonCancelar>
            )}
          </>
        }
      />

      {loading && <EstadoCargando>Cargando trazabilidad...</EstadoCargando>}
      {error && <BannerError>{error}</BannerError>}

      {traza && (
        <Stack gap="6">
          <Tarjeta p="5">
            <Heading as="h3" size="md" mb="4" color="brand.fg">
              Lote y receta
            </Heading>
            <HStack gap="8" flexWrap="wrap" align="flex-start">
              <Dato etiqueta="Producto">{traza.lote.producto_nombre}</Dato>
              <Box>
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Estado
                </Text>
                <BadgeEstadoLote estado={traza.lote.estado} />
              </Box>
              <Dato etiqueta="Receta usada">
                {traza.receta
                  ? `Versión ${traza.receta.version_numero} (rinde ${cantidadConUnidad(traza.receta.rendimiento, traza.receta.unidad)})`
                  : "Sin receta (lote histórico)"}
              </Dato>
              {traza.receta && (
                <Dato etiqueta="Versión creada">
                  {formatoFecha(traza.receta.creada_en)}
                  {traza.receta.creada_por ? ` por ${traza.receta.creada_por.nombre}` : ""}
                </Dato>
              )}
              <Dato etiqueta="Elaborado por">{traza.elaborado_por?.nombre ?? "-"}</Dato>
              <Dato etiqueta="Inicio">{formatoFechaHora(traza.lote.fecha_inicio)}</Dato>
              {traza.lote.fecha_cierre && (
                <Dato etiqueta="Cierre">{formatoFechaHora(traza.lote.fecha_cierre)}</Dato>
              )}
              <Dato etiqueta="Objetivo / producido">
                {cantidadConUnidad(traza.lote.cantidad_objetivo, traza.lote.unidad)} /{" "}
                {traza.lote.cantidad_producida
                  ? cantidadConUnidad(traza.lote.cantidad_producida, traza.lote.unidad)
                  : "-"}
              </Dato>
            </HStack>
            {traza.lote.motivo_cancelacion && (
              <Text fontSize="sm" color="red.fg" mt="4">
                Motivo de cancelación: {traza.lote.motivo_cancelacion}
              </Text>
            )}
          </Tarjeta>

          <Box>
            <Heading as="h3" size="md" mb="3" color="brand.fg">
              Tareas y consumos
            </Heading>
            <Stack gap="4">
              {traza.tareas.length === 0 && (
                <Tarjeta p="6" textAlign="center">
                  <Text color="fg.muted">Este lote no tiene tareas registradas.</Text>
                </Tarjeta>
              )}
              {traza.tareas.map((tarea) => (
                <Tarjeta key={tarea.item_id} p="5">
                  <Text fontWeight="bold" color="fg">
                    {tarea.orden}. {tarea.descripcion}
                  </Text>
                  <Text fontSize="sm" color="fg.muted" mb="3">
                    {tarea.completado_en
                      ? `Hecha por ${tarea.completado_por?.nombre ?? "—"} · ${formatoFechaHora(tarea.completado_en)}`
                      : "Sin completar"}
                  </Text>

                  {tarea.consumos.length === 0 ? (
                    <Text fontSize="sm" color="fg.subtle">
                      Sin consumos registrados.
                    </Text>
                  ) : (
                    <Box overflowX="auto">
                      <Table.Root variant="outline" size="sm" w="100%" minW="780px">
                        <Table.Header>
                          <FilaEncabezado>
                            <EncabezadoOscuro>Insumo</EncabezadoOscuro>
                            <EncabezadoOscuro>Cantidad</EncabezadoOscuro>
                            <EncabezadoOscuro>Lote de insumo</EncabezadoOscuro>
                            <EncabezadoOscuro>Proveedor</EncabezadoOscuro>
                            <EncabezadoOscuro>Registró</EncabezadoOscuro>
                            <EncabezadoOscuro center ancho="angosta">
                              Ver
                            </EncabezadoOscuro>
                          </FilaEncabezado>
                        </Table.Header>
                        <Table.Body>
                          {tarea.consumos.map((c) => (
                            <Table.Row key={c.id}>
                              <Celda>{c.lote_insumo.insumo_nombre}</Celda>
                              <Celda>
                                {cantidadConUnidad(c.cantidad, c.unidad)}{" "}
                                {c.tipo === "desperdicio" && (
                                  <Badge colorPalette="orange" variant="subtle">
                                    Desperdicio
                                  </Badge>
                                )}
                              </Celda>
                              <Celda>
                                <Text fontFamily="mono" fontSize="sm">
                                  {c.lote_insumo.numero_lote}
                                </Text>
                                <Text fontSize="xs" color="fg.muted">
                                  Vence: {formatoFecha(c.lote_insumo.fecha_vencimiento)}
                                </Text>
                              </Celda>
                              <Celda>
                                {c.lote_insumo.proveedor.nombre}
                                <Text fontSize="xs" color="fg.muted">
                                  Matrícula {c.lote_insumo.proveedor.matricula}
                                </Text>
                              </Celda>
                              <Celda>
                                {c.registrado_por?.nombre ?? "—"}
                                <Text fontSize="xs" color="fg.muted">
                                  {formatoFechaHora(c.registrado_en)}
                                </Text>
                              </Celda>
                              <Celda center>
                                <BotonAccion
                                  accion="historial"
                                  label="Ver los lotes de producto que usaron este lote de insumo"
                                  onClick={() => navigate(`/trazabilidad/lotes-insumo/${c.lote_insumo.id}`)}
                                />
                              </Celda>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    </Box>
                  )}

                  {tarea.planificado.length > 0 && (
                    <Stack gap="1" mt="3">
                      <Text fontSize="sm" fontWeight="medium" color="fg.muted">
                        Planificado vs. real
                      </Text>
                      {tarea.planificado.map((p) => (
                        <Text key={p.insumo_id} fontSize="sm" color="fg.muted">
                          {p.insumo_nombre}: planificado {cantidadConUnidad(p.cantidad_planificada, p.unidad)} · real{" "}
                          {cantidadConUnidad(p.consumo_real, p.unidad)} · desperdicio{" "}
                          {cantidadConUnidad(p.desperdicio, p.unidad)}
                        </Text>
                      ))}
                    </Stack>
                  )}
                </Tarjeta>
              ))}
            </Stack>
          </Box>

          <Box>
            <Heading as="h3" size="md" mb="3" color="brand.fg">
              Proveedores involucrados
            </Heading>
            {traza.proveedores.length === 0 ? (
              <Tarjeta p="6" textAlign="center">
                <Text color="fg.muted">No hay consumos registrados todavía.</Text>
              </Tarjeta>
            ) : (
              <Tarjeta overflowX="auto">
                <Table.Root variant="outline" w="100%" minW="560px">
                  <Table.Header>
                    <FilaEncabezado>
                      <EncabezadoOscuro>Proveedor</EncabezadoOscuro>
                      <EncabezadoOscuro ancho="amplia">Matrícula</EncabezadoOscuro>
                      <EncabezadoOscuro>Lotes de insumo aportados</EncabezadoOscuro>
                    </FilaEncabezado>
                  </Table.Header>
                  <Table.Body>
                    {traza.proveedores.map((p) => (
                      <Table.Row key={p.id}>
                        <Celda>{p.nombre}</Celda>
                        <Celda>{p.matricula}</Celda>
                        <Celda>
                          {traza.lotes_insumo
                            .filter((l) => l.proveedor.id === p.id)
                            .map((l) => `${l.insumo_nombre} (lote ${l.numero_lote})`)
                            .join(", ")}
                        </Celda>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Tarjeta>
            )}
          </Box>
        </Stack>
      )}
    </Box>
  );
}
