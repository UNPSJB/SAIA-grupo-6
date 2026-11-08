import { useEffect, useState } from "react";
import { Table } from "@chakra-ui/react";

import { useValorDebounced } from "../../../common/hooks/useValorDebounced";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EstadoVacioFiltrado,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../components/ui/filtros";
import {
  BannerError,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  Paginacion,
  Tarjeta,
} from "../../../components/ui/patrones";
import { BotonesExportar } from "../../exportacion";
import { useProveedores } from "../../proveedores/hooks/useProveedores";
import { useLotesStock } from "../hooks/useLotesStock";
import { listarOpcionesInsumosQuimicos } from "../services/insumoQuimicoService";
import type { InsumoQuimicoOpcion } from "../types/insumoQuimico";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import { formatoFecha } from "../../../common/utils/fechas";

const PAGE_SIZE = 10;

export function LotesStockTab() {
  const { proveedores } = useProveedores(true);
  const [insumos, setInsumos] = useState<InsumoQuimicoOpcion[]>([]);
  const [proveedor, setProveedor] = useState("");
  const [producto, setProducto] = useState("");
  const [numeroLote, setNumeroLote] = useState("");
  const numeroLoteAplicado = useValorDebounced(numeroLote);
  const { lotes, total, page, setPage, hayVariasPaginas, loading, error } = useLotesStock({
    proveedor_id: proveedor ? Number(proveedor) : undefined,
    insumo_quimico_id: producto ? Number(producto) : undefined,
    numero_lote: numeroLoteAplicado.trim() || undefined,
  });

  useEffect(() => {
    void listarOpcionesInsumosQuimicos(true).then(setInsumos).catch(console.error);
  }, []);

  const limpiarTodo = () => {
    setProveedor("");
    setProducto("");
    setNumeroLote("");
  };
  const hayFiltros = proveedor !== "" || producto !== "" || numeroLote.trim() !== "";
  const chips = chipsDeFiltros([
    { clave: "proveedor", etiqueta: "Proveedor", valor: proveedores.find((item) => String(item.id) === proveedor)?.nombre ?? "", onQuitar: () => setProveedor("") },
    { clave: "producto", etiqueta: "Producto", valor: insumos.find((item) => String(item.id) === producto)?.nombre ?? "", onQuitar: () => setProducto("") },
    { clave: "lote", etiqueta: "Lote", valor: numeroLote, recortar: true, onQuitar: () => setNumeroLote("") },
  ]);

  return (
    <>
      <BarraFiltros
        busqueda={
          <CampoBusqueda valor={numeroLote} onCambio={setNumeroLote} placeholder="Buscar número de lote..." />
        }
        filtros={<>
          <FiltroSelect label="Proveedor" valor={proveedor} onCambio={setProveedor} opciones={proveedores.map((item) => ({ valor: String(item.id), etiqueta: `${item.nombre}${item.activo ? "" : " (dado de baja)"}` }))} todos="Todos los proveedores" />
          <FiltroSelect label="Producto" valor={producto} onCambio={setProducto} opciones={insumos.map((item) => ({ valor: String(item.id), etiqueta: `${item.nombre}${item.unidad_simbolo ? ` (${item.unidad_simbolo})` : ""}` }))} todos="Todos los productos" />
        </>}
        herramientas={
          <BotonesExportar nombreTabla="stock_lotes" vista="stock-lotes" filtros={{ proveedor_id: proveedor, insumo_quimico_id: producto, numero_lote: numeroLoteAplicado.trim() }} />
        }
      />
      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />
      {error ? <BannerError>{error}</BannerError> : null}
      {loading ? <EstadoCargando>Cargando lotes...</EstadoCargando> : null}
      {!loading && !error && lotes.length === 0 ? (
        hayFiltros ? <EstadoVacioFiltrado onLimpiar={limpiarTodo}>No hay lotes que coincidan con los filtros aplicados.</EstadoVacioFiltrado> : <EstadoVacio>No hay lotes registrados.</EstadoVacio>
      ) : null}
      {!loading && !error && lotes.length > 0 ? <>
        <Tarjeta overflowX="auto"><Table.Root variant="outline" size="sm" minW="750px"><Table.Header><FilaEncabezado><EncabezadoOscuro>Proveedor</EncabezadoOscuro><EncabezadoOscuro>Lote</EncabezadoOscuro><EncabezadoOscuro>Producto</EncabezadoOscuro><EncabezadoOscuro ancho="media">Cantidad producto</EncabezadoOscuro><EncabezadoOscuro ancho="media">Fecha ingreso</EncabezadoOscuro></FilaEncabezado></Table.Header><Table.Body>{lotes.map((lote) => <Table.Row key={lote.id}><Celda>{lote.proveedor_nombre}</Celda><Celda fontWeight="medium">{lote.numero_lote}</Celda><Celda>{lote.nombre_producto}</Celda><Celda>{cantidadConUnidad(lote.cantidad_producto, lote.unidad_simbolo)}</Celda><Celda>{formatoFecha(lote.fecha_ingreso)}</Celda></Table.Row>)}</Table.Body></Table.Root></Tarjeta>
        {hayVariasPaginas ? <Paginacion count={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} /> : null}
      </> : null}
    </>
  );
}
