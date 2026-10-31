import { useEffect, useState } from "react";
import { Box, Button, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { LuSearch } from "react-icons/lu";

import { DetalleChecklistDialog } from "../../checklist/components/DetalleChecklistDialog";
import type { HistorialChecklistItem } from "../../checklist/types/checklist";
import {
  BarraFiltros,
  ChipsFiltros,
  EstadoVacioFiltrado,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../components/ui/filtros";
import {
  BannerError,
  BotonTexto,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  FormInput,
  LabelFiltro,
  Paginacion,
  Tarjeta,
} from "../../../components/ui/patrones";
import { useMovimientosStock } from "../hooks/useMovimientosStock";
import { listarOpcionesInsumosQuimicos } from "../services/insumoQuimicoService";
import type { InsumoQuimicoOpcion } from "../types/insumoQuimico";
import type { TipoMovimientoStock } from "../types/stock";

const PAGE_SIZE = 10;

const ETIQUETAS_TIPO: Record<TipoMovimientoStock, string> = {
  ingreso: "Ingreso",
  ajuste_positivo: "Ajuste (+)",
  ajuste_negativo: "Ajuste (-)",
  consumo_automatico: "Consumo automático",
  reverso_consumo: "Reverso de consumo",
};

function fechaCorta(fecha: string | null) {
  return fecha ? (fecha.includes("T") ? fecha.replace("T", " ").slice(0, 16) : fecha) : "-";
}

function cantidadConSigno(cantidad: number | string) {
  const numero = Number(cantidad);
  return `${Number.isFinite(numero) && numero > 0 ? "+" : ""}${cantidad}`;
}

function checklistDesdeMovimiento(checklistId: number, fecha: string | null): HistorialChecklistItem {
  return { checklist_id: checklistId, fecha: fecha ?? "", equipo_id: 0, equipo_nombre: "", estado: "abierto", total_tareas: 0, tareas_completadas: 0, porcentaje_cumplimiento: 0, tareas_incumplidas: [] };
}

export function MovimientosStockTab() {
  const [insumos, setInsumos] = useState<InsumoQuimicoOpcion[]>([]);
  const [producto, setProducto] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [tipo, setTipo] = useState("");
  const [filtros, setFiltros] = useState({ producto: "", fechaDesde: "", fechaHasta: "", tipo: "" });
  const [errorFiltro, setErrorFiltro] = useState<string | null>(null);
  const [checklistSeleccionado, setChecklistSeleccionado] = useState<HistorialChecklistItem | null>(null);
  const { movimientos, total, page, setPage, hayVariasPaginas, loading, error } = useMovimientosStock({
    insumo_quimico_id: filtros.producto ? Number(filtros.producto) : undefined,
    fecha_desde: filtros.fechaDesde || undefined,
    fecha_hasta: filtros.fechaHasta || undefined,
    tipo: (filtros.tipo || undefined) as TipoMovimientoStock | undefined,
  });

  useEffect(() => {
    void listarOpcionesInsumosQuimicos(true).then(setInsumos).catch(console.error);
  }, []);

  const aplicarFiltros = () => {
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      setErrorFiltro("La fecha desde no puede ser posterior a la fecha hasta.");
      return;
    }
    setErrorFiltro(null);
    setFiltros({ producto, fechaDesde, fechaHasta, tipo });
  };
  const limpiarTodo = () => {
    setProducto("");
    setFechaDesde("");
    setFechaHasta("");
    setTipo("");
    setFiltros({ producto: "", fechaDesde: "", fechaHasta: "", tipo: "" });
    setErrorFiltro(null);
  };
  const hayFiltros = Object.values(filtros).some(Boolean);
  const chips = chipsDeFiltros([
    { clave: "producto", etiqueta: "Producto", valor: insumos.find((i) => String(i.id) === filtros.producto)?.nombre ?? "", onQuitar: () => { setProducto(""); setFiltros((actual) => ({ ...actual, producto: "" })); } },
    { clave: "desde", etiqueta: "Desde", valor: filtros.fechaDesde, onQuitar: () => { setFechaDesde(""); setFiltros((actual) => ({ ...actual, fechaDesde: "" })); } },
    { clave: "hasta", etiqueta: "Hasta", valor: filtros.fechaHasta, onQuitar: () => { setFechaHasta(""); setFiltros((actual) => ({ ...actual, fechaHasta: "" })); } },
    { clave: "tipo", etiqueta: "Tipo", valor: filtros.tipo ? ETIQUETAS_TIPO[filtros.tipo as TipoMovimientoStock] : "", onQuitar: () => { setTipo(""); setFiltros((actual) => ({ ...actual, tipo: "" })); } },
  ]);

  return (
    <>
      <BarraFiltros
        filtros={<>
          <FiltroSelect label="Producto" valor={producto} onCambio={setProducto} opciones={insumos.map((insumo) => ({ valor: String(insumo.id), etiqueta: `${insumo.nombre}${insumo.unidad_simbolo ? ` (${insumo.unidad_simbolo})` : ""}` }))} todos="Todos los productos" />
          <Box minW="150px"><LabelFiltro>Desde</LabelFiltro><FormInput type="date" value={fechaDesde} max={fechaHasta} onChange={(event) => setFechaDesde(event.target.value)} /></Box>
          <Box minW="150px"><LabelFiltro>Hasta</LabelFiltro><FormInput type="date" value={fechaHasta} min={fechaDesde} onChange={(event) => setFechaHasta(event.target.value)} /></Box>
          <FiltroSelect label="Tipo" valor={tipo} onCambio={setTipo} opciones={Object.entries(ETIQUETAS_TIPO).map(([valor, etiqueta]) => ({ valor, etiqueta }))} todos="Todos los tipos" />
          <Button colorPalette="brand" onClick={aplicarFiltros} loading={loading} flexShrink={0}><LuSearch aria-hidden /> Filtrar</Button>
        </>}
      />
      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />
      {errorFiltro ? <BannerError>{errorFiltro}</BannerError> : null}
      {error ? <BannerError>{error}</BannerError> : null}
      {loading ? <EstadoCargando>Cargando movimientos...</EstadoCargando> : null}
      {!loading && !error && movimientos.length === 0 ? (
        hayFiltros ? <EstadoVacioFiltrado onLimpiar={limpiarTodo}>No hay movimientos que coincidan con los filtros aplicados.</EstadoVacioFiltrado> : <EstadoVacio>No hay movimientos registrados.</EstadoVacio>
      ) : null}
      {!loading && !error && movimientos.length > 0 ? <>
        <Tarjeta display={{ base: "none", md: "block" }}>
          <Table.Root variant="outline" size="sm"><Table.Header><FilaEncabezado><EncabezadoOscuro ancho="media">Fecha</EncabezadoOscuro><EncabezadoOscuro>Producto</EncabezadoOscuro><EncabezadoOscuro ancho="amplia">Tipo</EncabezadoOscuro><EncabezadoOscuro ancho="angosta">Variación</EncabezadoOscuro><EncabezadoOscuro ancho="amplia">Responsable</EncabezadoOscuro><EncabezadoOscuro ancho="amplia">Detalle</EncabezadoOscuro></FilaEncabezado></Table.Header><Table.Body>{movimientos.map((movimiento) => <Table.Row key={movimiento.id}><Celda>{fechaCorta(movimiento.fecha)}</Celda><Celda fontWeight="medium">{movimiento.nombre_producto} {movimiento.unidad_simbolo ? `(${movimiento.unidad_simbolo})` : ""}</Celda><Celda>{ETIQUETAS_TIPO[movimiento.tipo]}</Celda><Celda color={Number(movimiento.cantidad_variacion) < 0 ? "red.fg" : "green.fg"} fontWeight="bold">{cantidadConSigno(movimiento.cantidad_variacion)}</Celda><Celda>{movimiento.responsable_nombre ?? "Sistema"}</Celda><Celda>{movimiento.checklist_id !== null ? <BotonTexto onClick={() => setChecklistSeleccionado(checklistDesdeMovimiento(movimiento.checklist_id!, movimiento.checklist_fecha))}>{movimiento.tarea_nombre ?? `Checklist #${movimiento.checklist_id}`}</BotonTexto> : movimiento.motivo ?? "-"}</Celda></Table.Row>)}</Table.Body></Table.Root>
        </Tarjeta>
        <Stack display={{ base: "flex", md: "none" }} gap="3">{movimientos.map((movimiento) => <Tarjeta key={movimiento.id} p="4"><HStack justify="space-between" align="flex-start" gap="3"><Box><Text fontWeight="bold">{movimiento.nombre_producto}</Text><Text color="fg.muted" fontSize="sm">{fechaCorta(movimiento.fecha)}</Text></Box><Text color={Number(movimiento.cantidad_variacion) < 0 ? "red.fg" : "green.fg"} fontWeight="bold">{cantidadConSigno(movimiento.cantidad_variacion)} {movimiento.unidad_simbolo ?? ""}</Text></HStack><Text mt="3" fontSize="sm">{ETIQUETAS_TIPO[movimiento.tipo]}</Text><Box color="fg.muted" fontSize="sm" mt="1">{movimiento.checklist_id !== null ? <BotonTexto onClick={() => setChecklistSeleccionado(checklistDesdeMovimiento(movimiento.checklist_id!, movimiento.checklist_fecha))}>{movimiento.tarea_nombre ?? `Checklist #${movimiento.checklist_id}`}</BotonTexto> : movimiento.motivo ?? movimiento.responsable_nombre ?? "Sin detalle"}</Box></Tarjeta>)}</Stack>
        {hayVariasPaginas ? <Paginacion count={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} /> : null}
      </> : null}
      {checklistSeleccionado ? <DetalleChecklistDialog isOpen checklist={checklistSeleccionado} onClose={() => setChecklistSeleccionado(null)} /> : null}
    </>
  );
}
