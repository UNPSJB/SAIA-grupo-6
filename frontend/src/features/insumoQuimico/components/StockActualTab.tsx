import { useState } from "react";
import { Badge, Box, Button, HStack, Stack, Table, Text } from "@chakra-ui/react";

import { useOrdenTabla } from "../../../common/hooks/useOrdenTabla";
import { useValorDebounced } from "../../../common/hooks/useValorDebounced";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EncabezadoOrdenable,
  EstadoVacioFiltrado,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../components/ui/filtros";
import {
  BannerError,
  BotonAccion,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  Paginacion,
  Tarjeta,
} from "../../../components/ui/patrones";
import { notificarCambioNotificaciones } from "../../notificaciones/eventoNotificaciones";
import { useProveedores } from "../../proveedores/hooks/useProveedores";
import { useStockAcciones } from "../hooks/useStockAcciones";
import { useStockActual } from "../hooks/useStockActual";
import type { ColumnaOrdenStock, StockInsumoQuimico } from "../types/stock";
import { StockOperacionDialog, type TipoDialogoStock } from "./StockOperacionDialog";

const PAGE_SIZE = 10;

interface DialogoAbierto {
  tipo: TipoDialogoStock;
  insumo: StockInsumoQuimico;
}

function valorDecimal(valor: number | string | null) {
  return valor === null ? "Sin definir" : String(valor);
}

export function StockActualTab() {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);
  const orden = useOrdenTabla<ColumnaOrdenStock>("nombre_asc", "nombre");
  const stockBajo = estado === "bajo" ? true : estado === "normal" ? false : undefined;
  const {
    stock,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    recargar,
  } = useStockActual({ buscar: busquedaAplicada, stockBajo, orden: orden.orden });
  const { proveedores } = useProveedores();
  const { loading: guardando, actualizarMinimo, registrarAjuste, registrarIngreso } = useStockAcciones();
  const [dialogo, setDialogo] = useState<DialogoAbierto | null>(null);

  const cerrarDialogo = () => {
    if (!guardando) setDialogo(null);
  };

  const recargarDespuesDeGuardar = async (accion: () => Promise<void>) => {
    await accion();
    await recargar();
    notificarCambioNotificaciones();
  };

  const limpiarTodo = () => {
    setBusqueda("");
    setEstado("");
    orden.reiniciar();
  };
  const hayFiltros = busqueda.trim() !== "" || estado !== "";
  const etiquetasOrden: Record<ColumnaOrdenStock, string> = {
    nombre: "Producto",
    cantidad: "Stock actual",
    minimo: "Stock mínimo",
  };
  const chips = chipsDeFiltros([
    {
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda,
      recortar: true,
      onQuitar: () => setBusqueda(""),
    },
    {
      clave: "estado",
      etiqueta: "Estado",
      valor: estado === "bajo" ? "Stock bajo" : estado === "normal" ? "Disponible" : "",
      onQuitar: () => setEstado(""),
    },
    {
      clave: "orden",
      etiqueta: "Orden",
      valor: `${etiquetasOrden[orden.columna ?? "nombre"]} ${orden.direccion === "asc" ? "↑" : "↓"}`,
      visible: !orden.esPorDefecto,
      onQuitar: orden.reiniciar,
    },
  ]);

  return (
    <>
      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Buscar por producto o unidad..."
          />
        }
        filtros={
          <FiltroSelect
            label="Estado"
            valor={estado}
            onCambio={setEstado}
            opciones={[
              { valor: "bajo", etiqueta: "Stock bajo" },
              { valor: "normal", etiqueta: "Disponible" },
            ]}
          />
        }
      />
      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error ? <BannerError>{error}</BannerError> : null}
      {loading ? <EstadoCargando>Cargando stock actual...</EstadoCargando> : null}
      {!loading && !error && stock.length === 0 ? (
        hayFiltros ? (
          <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
            No hay productos que coincidan con los filtros aplicados.
          </EstadoVacioFiltrado>
        ) : (
          <EstadoVacio>No hay productos químicos registrados para gestionar.</EstadoVacio>
        )
      ) : null}

      {!loading && !error && stock.length > 0 ? (
        <>
          <Tarjeta display={{ base: "none", md: "block" }}>
            <Table.Root variant="outline" size="sm">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOrdenable columna="nombre" orden={orden}>Producto</EncabezadoOrdenable>
                  <EncabezadoOrdenable columna="cantidad" orden={orden} ancho="angosta">Actual</EncabezadoOrdenable>
                  <EncabezadoOrdenable columna="minimo" orden={orden} ancho="angosta">Mínimo</EncabezadoOrdenable>
                  <EncabezadoOscuro ancho="angosta">Estado</EncabezadoOscuro>
                  <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {stock.map((insumo) => (
                  <Table.Row key={insumo.insumo_quimico_id}>
                    <Celda fontWeight="medium">{insumo.nombre}</Celda>
                    <Celda>{valorDecimal(insumo.cantidad_actual)} {insumo.unidad_simbolo ?? ""}</Celda>
                    <Celda>
                      {valorDecimal(insumo.stock_minimo)}
                      {insumo.stock_minimo !== null ? ` ${insumo.unidad_simbolo ?? ""}` : ""}
                    </Celda>
                    <Celda>
                      <Badge colorPalette={insumo.stock_bajo ? "red" : "green"}>
                        {insumo.stock_bajo ? "Stock bajo" : "Disponible"}
                      </Badge>
                    </Celda>
                    <Celda center>
                      <HStack gap="2" justify="center">
                        <BotonAccion accion="ingreso" label="Registrar ingreso" onClick={() => setDialogo({ tipo: "ingreso", insumo })} />
                        <BotonAccion accion="ajuste" label="Ajustar stock" onClick={() => setDialogo({ tipo: "ajuste", insumo })} />
                        <BotonAccion accion="minimo" label="Configurar stock mínimo" onClick={() => setDialogo({ tipo: "minimo", insumo })} />
                      </HStack>
                    </Celda>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Tarjeta>

          <Stack display={{ base: "flex", md: "none" }} gap="3">
            {stock.map((insumo) => (
              <Tarjeta key={insumo.insumo_quimico_id} p="4" borderColor={insumo.stock_bajo ? "red.300" : "border.subtle"}>
                <HStack justify="space-between" align="flex-start" gap="3" mb="3">
                  <Box>
                    <Text fontWeight="bold">{insumo.nombre}</Text>
                    <Text color="fg.muted" fontSize="sm">Actual: {valorDecimal(insumo.cantidad_actual)} {insumo.unidad_simbolo ?? ""}</Text>
                  </Box>
                  <Badge colorPalette={insumo.stock_bajo ? "red" : "green"}>{insumo.stock_bajo ? "Stock bajo" : "Disponible"}</Badge>
                </HStack>
                <Text color="fg.muted" fontSize="sm" mb="3">Mínimo: {valorDecimal(insumo.stock_minimo)}{insumo.stock_minimo !== null ? ` ${insumo.unidad_simbolo ?? ""}` : ""}</Text>
                <Stack direction="row" gap="2" flexWrap="wrap">
                  <Button size="sm" colorPalette="brand" onClick={() => setDialogo({ tipo: "ingreso", insumo })}>Ingreso</Button>
                  <Button size="sm" variant="outline" colorPalette="neutral" onClick={() => setDialogo({ tipo: "ajuste", insumo })}>Ajuste</Button>
                  <Button size="sm" variant="plain" color="brand.fg" onClick={() => setDialogo({ tipo: "minimo", insumo })}>Mínimo</Button>
                </Stack>
              </Tarjeta>
            ))}
          </Stack>

          {hayVariasPaginas ? <Paginacion count={total} pageSize={PAGE_SIZE} page={page} onPageChange={setPage} /> : null}
        </>
      ) : null}

      {dialogo ? (
        <StockOperacionDialog
          key={`${dialogo.tipo}-${dialogo.insumo.insumo_quimico_id}`}
          tipo={dialogo.tipo}
          insumo={dialogo.insumo}
          loading={guardando}
          proveedores={proveedores}
          onClose={cerrarDialogo}
          onIngreso={(cantidad, proveedorId, numeroLote) => recargarDespuesDeGuardar(() => registrarIngreso(dialogo.insumo.insumo_quimico_id, cantidad, proveedorId, numeroLote))}
          onAjuste={(cantidad, operacion, motivo) => recargarDespuesDeGuardar(() => registrarAjuste(dialogo.insumo.insumo_quimico_id, cantidad, operacion, motivo))}
          onMinimo={(minimo) => recargarDespuesDeGuardar(() => actualizarMinimo(dialogo.insumo.insumo_quimico_id, minimo))}
        />
      ) : null}
    </>
  );
}
