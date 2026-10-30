import { useState } from "react";
import { Button, Field, Stack, Table } from "@chakra-ui/react";
import { LuSearch } from "react-icons/lu";
import { useInsumosQuimicos } from "../hooks/useInsumosQuimicos";
import { useLotesStock } from "../hooks/useLotesStock";
import { useProveedores } from "../../proveedores/hooks/useProveedores";
import {
  BannerError, Celda, EncabezadoOscuro, EstadoCargando, EstadoVacio, FilaEncabezado,
  FormInput, FormNativeSelect, LabelFiltro, Paginacion, Tarjeta,
} from "../../../components/ui/patrones";

const PAGE_SIZE = 10;

function fechaCorta(fecha: string) {
  return fecha.includes("T") ? fecha.replace("T", " ").slice(0, 16) : fecha;
}

export function LotesStockTab() {
  const { proveedores } = useProveedores(true);
  const { insumos } = useInsumosQuimicos(true);
  const [proveedor, setProveedor] = useState("");
  const [producto, setProducto] = useState("");
  const [numeroLote, setNumeroLote] = useState("");
  const [filtros, setFiltros] = useState({ proveedor: "", producto: "", numeroLote: "", offset: 0 });
  const { lotes, loading, error } = useLotesStock({
    proveedor_id: filtros.proveedor ? Number(filtros.proveedor) : undefined,
    insumo_quimico_id: filtros.producto ? Number(filtros.producto) : undefined,
    numero_lote: filtros.numeroLote || undefined,
    limit: PAGE_SIZE,
    offset: filtros.offset,
  });
  const page = Math.floor(filtros.offset / PAGE_SIZE) + 1;

  return (
    <>
      <Tarjeta p="4" mb="6">
        <Stack direction={{ base: "column", md: "row" }} gap="4" align={{ base: "stretch", md: "flex-end" }}>
          <Field.Root flex="1"><LabelFiltro>Proveedor</LabelFiltro><FormNativeSelect value={proveedor} onChange={(event) => setProveedor(event.target.value)}><option value="">Todos los proveedores</option>{proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}{item.activo ? "" : " (dado de baja)"}</option>)}</FormNativeSelect></Field.Root>
          <Field.Root flex="1"><LabelFiltro>Producto</LabelFiltro><FormNativeSelect value={producto} onChange={(event) => setProducto(event.target.value)}><option value="">Todos los productos</option>{insumos.map((item) => <option key={item.id} value={item.id}>{item.nombre}{item.activo ? "" : " (dado de baja)"}</option>)}</FormNativeSelect></Field.Root>
          <Field.Root flex="1"><LabelFiltro>Número de lote</LabelFiltro><FormInput value={numeroLote} onChange={(event) => setNumeroLote(event.target.value)} placeholder="Buscar lote" /></Field.Root>
          <Button colorPalette="brand" onClick={() => setFiltros({ proveedor, producto, numeroLote, offset: 0 })} loading={loading} flexShrink={0}><LuSearch aria-hidden /> Filtrar</Button>
        </Stack>
      </Tarjeta>
      {error ? <BannerError>{error}</BannerError> : null}
      {loading ? <EstadoCargando>Cargando lotes...</EstadoCargando> : null}
      {!loading && !error && lotes.items.length === 0 ? <EstadoVacio>No hay lotes que coincidan con los filtros seleccionados.</EstadoVacio> : null}
      {!loading && !error && lotes.items.length > 0 ? <>
        <Tarjeta overflowX="auto"><Table.Root variant="outline" size="sm" minW="750px"><Table.Header><FilaEncabezado><EncabezadoOscuro>Proveedor</EncabezadoOscuro><EncabezadoOscuro>Lote</EncabezadoOscuro><EncabezadoOscuro>Producto</EncabezadoOscuro><EncabezadoOscuro ancho="media">Cantidad producto</EncabezadoOscuro><EncabezadoOscuro ancho="media">Fecha ingreso</EncabezadoOscuro></FilaEncabezado></Table.Header><Table.Body>{lotes.items.map((lote) => <Table.Row key={lote.id}><Celda>{lote.proveedor_nombre}</Celda><Celda fontWeight="medium">{lote.numero_lote}</Celda><Celda>{lote.nombre_producto}</Celda><Celda>{lote.cantidad_producto} {lote.unidad_simbolo ?? ""}</Celda><Celda>{fechaCorta(lote.fecha_ingreso)}</Celda></Table.Row>)}</Table.Body></Table.Root></Tarjeta>
        {lotes.total > PAGE_SIZE ? <Paginacion count={lotes.total} page={page} pageSize={PAGE_SIZE} onPageChange={(nuevaPagina) => setFiltros((actual) => ({ ...actual, offset: (nuevaPagina - 1) * PAGE_SIZE }))} /> : null}
      </> : null}
    </>
  );
}
