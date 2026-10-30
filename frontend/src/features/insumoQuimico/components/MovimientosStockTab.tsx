import { useState } from "react";
import { Box, Button, Field, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { LuSearch } from "react-icons/lu";
import { useMovimientosStock } from "../hooks/useMovimientosStock";
import { useInsumosQuimicos } from "../hooks/useInsumosQuimicos";
import { DetalleChecklistDialog } from "../../checklist/components/DetalleChecklistDialog";
import type { HistorialChecklistItem } from "../../checklist/types/checklist";
import {
  BannerError,
  BotonTexto,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  FormInput,
  FormNativeSelect,
  LabelFiltro,
  Paginacion,
  Tarjeta,
} from "../../../components/ui/patrones";

const PAGE_SIZE = 10;

const ETIQUETAS_TIPO: Record<string, string> = {
  ingreso: "Ingreso",
  ajuste_positivo: "Ajuste (+)",
  ajuste_negativo: "Ajuste (-)",
  consumo_automatico: "Consumo automático",
  reverso_consumo: "Reverso de consumo",
};

function etiquetaTipo(tipo: string) {
  return ETIQUETAS_TIPO[tipo] ?? tipo.replaceAll("_", " ");
}

function fechaCorta(fecha: string | null) {
  if (!fecha) return "-";
  return fecha.includes("T") ? fecha.replace("T", " ").slice(0, 16) : fecha;
}

function cantidadConSigno(cantidad: number | string) {
  const numero = Number(cantidad);
  return `${Number.isFinite(numero) && numero > 0 ? "+" : ""}${cantidad}`;
}

function checklistDesdeMovimiento(
  checklistId: number,
  fecha: string | null,
): HistorialChecklistItem {
  return {
    checklist_id: checklistId,
    fecha: fecha ?? "",
    equipo_id: 0,
    equipo_nombre: "",
    estado: "abierto",
    total_tareas: 0,
    tareas_completadas: 0,
    porcentaje_cumplimiento: 0,
    tareas_incumplidas: [],
  };
}

export function MovimientosStockTab() {
  const { insumos } = useInsumosQuimicos(true);
  const [producto, setProducto] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [tipo, setTipo] = useState("");
  const [filtros, setFiltros] = useState({
    producto: "",
    fechaDesde: "",
    fechaHasta: "",
    tipo: "",
    offset: 0,
  });
  const [errorFiltro, setErrorFiltro] = useState<string | null>(null);
  const [checklistSeleccionado, setChecklistSeleccionado] =
    useState<HistorialChecklistItem | null>(null);
  const { movimientos, loading, error } = useMovimientosStock({
    insumo_quimico_id: filtros.producto ? Number(filtros.producto) : undefined,
    fecha_desde: filtros.fechaDesde || undefined,
    fecha_hasta: filtros.fechaHasta || undefined,
    tipo: filtros.tipo || undefined,
    limit: PAGE_SIZE,
    offset: filtros.offset,
  });

  const aplicarFiltros = () => {
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      setErrorFiltro("La fecha desde no puede ser posterior a la fecha hasta.");
      return;
    }
    setErrorFiltro(null);
    setFiltros({ producto, fechaDesde, fechaHasta, tipo, offset: 0 });
  };

  const page = Math.floor(filtros.offset / PAGE_SIZE) + 1;

  return (
    <>
      <Tarjeta p="4" mb="6">
        <Stack direction={{ base: "column", md: "row" }} gap="4" align={{ base: "stretch", md: "flex-end" }}>
          <Field.Root flex="1" minW={{ md: "180px" }}>
            <LabelFiltro>Producto</LabelFiltro>
            <FormNativeSelect value={producto} onChange={(event) => setProducto(event.target.value)}>
              <option value="">Todos los productos</option>
              {insumos.map((insumo) => (
                <option key={insumo.id} value={insumo.id}>
                  {insumo.nombre}{insumo.activo ? "" : " (dado de baja)"}
                </option>
              ))}
            </FormNativeSelect>
          </Field.Root>
          <Field.Root minW={{ md: "150px" }}>
            <LabelFiltro>Desde</LabelFiltro>
            <FormInput type="date" value={fechaDesde} max={fechaHasta} onChange={(event) => setFechaDesde(event.target.value)} />
          </Field.Root>
          <Field.Root minW={{ md: "150px" }}>
            <LabelFiltro>Hasta</LabelFiltro>
            <FormInput type="date" value={fechaHasta} min={fechaDesde} onChange={(event) => setFechaHasta(event.target.value)} />
          </Field.Root>
          <Field.Root minW={{ md: "155px" }}>
            <LabelFiltro>Tipo</LabelFiltro>
            <FormNativeSelect value={tipo} onChange={(event) => setTipo(event.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="ingreso">Ingresos</option>
              <option value="ajuste_positivo">Ajustes positivos</option>
              <option value="ajuste_negativo">Ajustes negativos</option>
              <option value="consumo_automatico">Consumos automáticos</option>
              <option value="reverso_consumo">Reversiones de consumo</option>
            </FormNativeSelect>
          </Field.Root>
          <Button colorPalette="brand" onClick={aplicarFiltros} loading={loading} flexShrink={0}>
            <LuSearch aria-hidden /> Filtrar
          </Button>
        </Stack>
      </Tarjeta>

      {errorFiltro ? <BannerError>{errorFiltro}</BannerError> : null}
      {error ? <BannerError>{error}</BannerError> : null}
      {loading ? <EstadoCargando>Cargando movimientos...</EstadoCargando> : null}

      {!loading && !error && movimientos.items.length === 0 ? (
        <EstadoVacio>No hay movimientos que coincidan con los filtros seleccionados.</EstadoVacio>
      ) : null}

      {!loading && !error && movimientos.items.length > 0 ? (
        <>
          <Tarjeta display={{ base: "none", md: "block" }}>
            <Table.Root variant="outline" size="sm">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOscuro ancho="media">Fecha</EncabezadoOscuro>
                  <EncabezadoOscuro>Producto</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="amplia">Tipo</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="angosta">Variación</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="amplia">Responsable</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="amplia">Detalle</EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {movimientos.items.map((movimiento) => (
                  <Table.Row key={movimiento.id}>
                    <Celda>{fechaCorta(movimiento.fecha)}</Celda>
                    <Celda fontWeight="medium">
                      {movimiento.nombre_producto} {movimiento.unidad_simbolo ? `(${movimiento.unidad_simbolo})` : ""}
                    </Celda>
                    <Celda>{etiquetaTipo(movimiento.tipo)}</Celda>
                    <Celda color={Number(movimiento.cantidad_variacion) < 0 ? "red.fg" : "green.fg"} fontWeight="bold">
                      {cantidadConSigno(movimiento.cantidad_variacion)}
                    </Celda>
                    <Celda>{movimiento.responsable_nombre ?? "Sistema"}</Celda>
                    <Celda>
                      {movimiento.checklist_id !== null ? (
                        <BotonTexto
                          onClick={() =>
                            setChecklistSeleccionado(
                              checklistDesdeMovimiento(
                                movimiento.checklist_id!,
                                movimiento.checklist_fecha,
                              ),
                            )
                          }
                        >
                          {movimiento.tarea_nombre ?? `Checklist #${movimiento.checklist_id}`}
                        </BotonTexto>
                      ) : (
                        movimiento.motivo ?? "-"
                      )}
                    </Celda>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Tarjeta>

          <Stack display={{ base: "flex", md: "none" }} gap="3">
            {movimientos.items.map((movimiento) => (
              <Tarjeta key={movimiento.id} p="4">
                <HStack justify="space-between" align="flex-start" gap="3">
                  <Box>
                    <Text fontWeight="bold">{movimiento.nombre_producto}</Text>
                    <Text color="fg.muted" fontSize="sm">{fechaCorta(movimiento.fecha)}</Text>
                  </Box>
                  <Text color={Number(movimiento.cantidad_variacion) < 0 ? "red.fg" : "green.fg"} fontWeight="bold">
                    {cantidadConSigno(movimiento.cantidad_variacion)} {movimiento.unidad_simbolo ?? ""}
                  </Text>
                </HStack>
                <Text mt="3" fontSize="sm">{etiquetaTipo(movimiento.tipo)}</Text>
                <Box color="fg.muted" fontSize="sm" mt="1">
                  {movimiento.checklist_id !== null ? (
                    <BotonTexto
                      onClick={() =>
                        setChecklistSeleccionado(
                          checklistDesdeMovimiento(movimiento.checklist_id!, movimiento.checklist_fecha),
                        )
                      }
                    >
                      {movimiento.tarea_nombre ?? `Checklist #${movimiento.checklist_id}`}
                    </BotonTexto>
                  ) : (
                    movimiento.motivo ?? movimiento.responsable_nombre ?? "Sin detalle"
                  )}
                </Box>
              </Tarjeta>
            ))}
          </Stack>

          {movimientos.total > PAGE_SIZE ? (
            <Paginacion
              count={movimientos.total}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={(nuevaPagina) =>
                setFiltros((actual) => ({ ...actual, offset: (nuevaPagina - 1) * PAGE_SIZE }))
              }
            />
          ) : null}
        </>
      ) : null}

      {checklistSeleccionado ? (
        <DetalleChecklistDialog
          isOpen
          checklist={checklistSeleccionado}
          onClose={() => setChecklistSeleccionado(null)}
        />
      ) : null}
    </>
  );
}
