import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Box, Button, Spinner, Stack, Table, Text } from "@chakra-ui/react";
import { LuRefreshCw } from "react-icons/lu";
import { formatoFecha } from "../../../../common/utils/fechas";
import {
  BannerError,
  BotonAccion,
  BotonCancelar,
  Celda,
  EncabezadoOscuro,
  EstadoVacio,
  FilaEncabezado,
  FormInput,
  LabelFiltro,
  PageHeader,
  Tarjeta,
} from "../../../../components/ui/patrones";
import {
  BarraFiltros,
  ChipsFiltros,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
import { useLotes, useProductos } from "../../hooks/useLotes";
import type { Lote } from "../../types/lote";

const ESTADOS: Record<
  string,
  { etiqueta: string; color: "blue" | "green" | "red" | "gray" }
> = {
  Pendiente: { etiqueta: "Pendiente", color: "gray" },
  "En proceso": { etiqueta: "En proceso", color: "blue" },
  Finalizado: { etiqueta: "Finalizado", color: "green" },
  Cancelado: { etiqueta: "Cancelado", color: "red" },
};

const ESTADOS_CERRADOS = ["Finalizado", "Cancelado"];

function BadgeEstado({ estado }: { estado: string }) {
  const config = ESTADOS[estado] ?? {
    etiqueta: estado.replaceAll("_", " "),
    color: "gray" as const,
  };

  return (
    <Badge colorPalette={config.color} variant="subtle" textTransform="capitalize">
      {config.etiqueta}
    </Badge>
  );
}

function InsumosLote({ lote }: { lote: Lote }) {
  if (lote.insumos.length === 0) {
    return (
      <Text fontSize="sm" color="fg.subtle">
        Sin insumos asociados
      </Text>
    );
  }

  return (
    <Stack gap="1">
      {lote.insumos.map((item) => (
        <Text key={item.id} fontSize="sm" color="fg.muted">
          {item.insumo.nombre}: {item.cantidad}{" "}
          {item.insumo.unidad_medida.simbolo}
        </Text>
      ))}
    </Stack>
  );
}

export function LotesPage() {
  const navigate = useNavigate();
  const [producto, setProducto] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const { productos } = useProductos();

  const { lotes, loading, error, recargar } = useLotes({
    producto,
    fechaDesde,
    fechaHasta,
  });

  const hayFiltros =
    producto !== "" || fechaDesde !== "" || fechaHasta !== "";

  const limpiarTodo = () => {
    setProducto("");
    setFechaDesde("");
    setFechaHasta("");
  };

  const abrirModalAsociarInsumo = (loteId: number) => {
    navigate(`/lotes/${loteId}/insumos`);
  };

  const chips = chipsDeFiltros([
    {
      clave: "producto",
      etiqueta: "Producto",
      valor: producto,
      onQuitar: () => setProducto(""),
    },
    {
      clave: "desde",
      etiqueta: "Desde",
      valor: fechaDesde ? formatoFecha(fechaDesde) : "",
      onQuitar: () => setFechaDesde(""),
    },
    {
      clave: "hasta",
      etiqueta: "Hasta",
      valor: fechaHasta ? formatoFecha(fechaHasta) : "",
      onQuitar: () => setFechaHasta(""),
    },
  ]);

  return (
    <Box p="5">
      <PageHeader
        title="Historial de producción"
        description="Lotes registrados con sus insumos, filtrables por producto y rango de fechas."
        actions={
          <Button colorPalette="brand" onClick={() => navigate("/lotes/nuevo")}>
            + Registrar lote
          </Button>
        }
      />

      <BarraFiltros
        filtros={
          <>
            <FiltroSelect
              label="Producto"
              valor={producto}
              onCambio={setProducto}
              opciones={productos.map((item) => ({
                valor: item.nombre,
                etiqueta: item.nombre,
              }))}
              todos="Todos los productos"
            />

            <Box minW="150px">
              <LabelFiltro>Desde</LabelFiltro>
              <FormInput
                type="date"
                value={fechaDesde}
                onChange={(event) => setFechaDesde(event.target.value)}
                aria-label="Fecha desde"
              />
            </Box>

            <Box minW="150px">
              <LabelFiltro>Hasta</LabelFiltro>
              <FormInput
                type="date"
                value={fechaHasta}
                onChange={(event) => setFechaHasta(event.target.value)}
                aria-label="Fecha hasta"
              />
            </Box>

            <BotonCancelar onClick={recargar} mb="0">
              <LuRefreshCw aria-hidden />
              Actualizar
            </BotonCancelar>
          </>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error && <BannerError>{error}</BannerError>}

      {loading && <Spinner color="brand.500" />}

      {!loading && !error && lotes.length === 0 && (
        <EstadoVacio>
          {hayFiltros
            ? "No hay lotes que coincidan con los filtros aplicados."
            : "Todavía no hay lotes de producción registrados."}
        </EstadoVacio>
      )}

      {!loading && !error && lotes.length > 0 && (
        <Tarjeta overflowX="auto">
          <Table.Root variant="outline" w="100%" minW="1080px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Fecha</EncabezadoOscuro>
                <EncabezadoOscuro>Código</EncabezadoOscuro>
                <EncabezadoOscuro>Producto</EncabezadoOscuro>
                <EncabezadoOscuro>Producido</EncabezadoOscuro>
                <EncabezadoOscuro>Estado</EncabezadoOscuro>
                <EncabezadoOscuro>Insumos asociados</EncabezadoOscuro>
                <EncabezadoOscuro ancho="angosta">Acciones</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {lotes.map((lote) => (
                <Table.Row key={lote.id}>
                  <Celda>{formatoFecha(lote.fecha_inicio)}</Celda>
                  <Celda>
                    <Text fontFamily="mono" fontSize="sm">
                      {lote.codigo_lote}
                    </Text>
                  </Celda>
                  <Celda>{lote.producto_nombre}</Celda>
                  <Celda>{lote.cantidad_producida}</Celda>
                  <Celda>
                    <BadgeEstado estado={lote.estado} />
                    <Text fontSize="xs" color="fg.muted" mt="1">
                      {ESTADOS_CERRADOS.includes(lote.estado)
                        ? "Cerrado"
                        : "Abierto"}
                    </Text>
                  </Celda>
                  <Celda>
                    <InsumosLote lote={lote} />
                  </Celda>
                  <Celda>
                    <BotonAccion
                      accion="asociar"
                      label="Asociar insumos"
                      disabled={ESTADOS_CERRADOS.includes(lote.estado)}
                      onClick={() => abrirModalAsociarInsumo(lote.id)}
                    />
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