import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Box, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { Pagina, PestanasPagina } from "../../../components/ui/plantillas";
import { formatoFecha } from "../../../common/utils/fechas";
import { cantidadConUnidad } from "../../../common/utils/numeros";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EstadoVacioFiltrado,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../components/ui/filtros";
import { usePaginas } from "../../../common/hooks/usePaginas";
import {
  BannerError,
  BotonAccion,
  BotonAgregar,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaClickeable,
  FilaEncabezado,
  Paginacion,
  Tarjeta,
  TextoTruncado,
  ToggleInactivos,
  DatoPrincipal,
  CantidadConUnidad,
} from "../../../components/ui/patrones";
import {
  useInsumosActivos,
  useStockInsumos,
  useStockLotes,
} from "../hooks/useStockInsumos";
import { BajaLoteInsumoDialog } from "./pages/BajaLoteInsumoDialog";
import type { StockLoteInsumo } from "../types/loteInsumo";

/** Minúsculas y sin tildes, para buscar "azucar" y encontrar "Azúcar". */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const PAGE_SIZE = 10;

const ESTADOS_STOCK = [
  { valor: "con", etiqueta: "Con stock" },
  { valor: "sin", etiqueta: "Sin stock" },
  { valor: "vencido", etiqueta: "Con stock vencido" },
];

function TabStockPorInsumo() {
  const { stock, loading, error } = useStockInsumos();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda);
    return stock.filter((s) => {
      if (texto && !normalizar(s.insumo_nombre).includes(texto)) return false;
      if (estado === "con") return Number(s.stock) > 0;
      if (estado === "sin") return Number(s.stock) <= 0;
      if (estado === "vencido") return Number(s.stock_vencido) > 0;
      return true;
    });
  }, [stock, busqueda, estado]);

  const { paginados, page, setPage, hayVariasPaginas } = usePaginas(
    visibles,
    PAGE_SIZE,
    `${busqueda}|${estado}`,
  );

  const limpiar = () => {
    setBusqueda("");
    setEstado("");
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
      valor: ESTADOS_STOCK.find((e) => e.valor === estado)?.etiqueta ?? "",
      onQuitar: () => setEstado(""),
    },
  ]);

  return (
    <>
      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Nombre del insumo..."
          />
        }
        filtros={
          <FiltroSelect
            label="Estado"
            valor={estado}
            onCambio={setEstado}
            opciones={ESTADOS_STOCK}
            todos="Todos"
          />
        }
      />
      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiar} />

      {error && <BannerError>{error}</BannerError>}
      {loading && <EstadoCargando pagina>Cargando stock...</EstadoCargando>}
      {!loading && !error && stock.length === 0 && (
        <EstadoVacio>No hay insumos registrados.</EstadoVacio>
      )}
      {!loading && !error && stock.length > 0 && visibles.length === 0 && (
        <EstadoVacioFiltrado onLimpiar={limpiar}>
          No hay insumos que coincidan con los filtros aplicados.
        </EstadoVacioFiltrado>
      )}

      {!loading && !error && visibles.length > 0 && (
        <>
          <Tarjeta overflowX="auto">
            <Table.Root variant="outline" w="100%" minW="860px">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOscuro>Insumo</EncabezadoOscuro>
                  <EncabezadoOscuro numero ancho="amplia">
                    Recibido
                  </EncabezadoOscuro>
                  <EncabezadoOscuro numero ancho="amplia">
                    Consumo real
                  </EncabezadoOscuro>
                  <EncabezadoOscuro numero ancho="amplia">
                    Desperdicio
                  </EncabezadoOscuro>
                  <EncabezadoOscuro numero ancho="amplia">
                    Bajas
                  </EncabezadoOscuro>
                  <EncabezadoOscuro numero ancho="amplia">
                    Stock actual
                  </EncabezadoOscuro>
                  <EncabezadoOscuro numero ancho="amplia">
                    Vencido
                  </EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {paginados.map((s) => (
                  <Table.Row key={s.insumo_id}>
                    <Celda>
                      <DatoPrincipal titulo={s.insumo_nombre} />
                    </Celda>
                    <Celda numero>
                      <CantidadConUnidad valor={s.cantidad_recibida} unidad={s.unidad} />
                    </Celda>
                    <Celda numero>
                      <CantidadConUnidad valor={s.consumo_real} unidad={s.unidad} />
                    </Celda>
                    <Celda numero>
                      <CantidadConUnidad valor={s.desperdicio} unidad={s.unidad} />
                    </Celda>
                    <Celda numero>
                      {Number(s.cantidad_baja) > 0 ? (
                        <Text as="span" color="red.fg">
                          {cantidadConUnidad(s.cantidad_baja, s.unidad)}
                        </Text>
                      ) : (
                        <Text as="span" color="fg.subtle">
                          —
                        </Text>
                      )}
                    </Celda>
                    <Celda numero>
                      <Box as="span" fontWeight="bold">
                        <CantidadConUnidad valor={s.stock} unidad={s.unidad} />
                      </Box>
                    </Celda>
                    <Celda numero>
                      {Number(s.stock_vencido) > 0 ? (
                        <Text as="span" color="orange.fg" fontWeight="medium">
                          {cantidadConUnidad(s.stock_vencido, s.unidad)}
                        </Text>
                      ) : (
                        <Text as="span" color="fg.subtle">
                          —
                        </Text>
                      )}
                    </Celda>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Tarjeta>
          {hayVariasPaginas && (
            <Paginacion
              count={visibles.length}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </>
  );
}

function TabLotes() {
  const navigate = useNavigate();
  const { insumos } = useInsumosActivos();
  const [insumo, setInsumo] = useState("");
  const [verBajas, setVerBajas] = useState(false);
  const { lotes, loading, error, recargar } = useStockLotes(
    insumo ? Number(insumo) : undefined,
    verBajas,
  );
  const [aBaja, setABaja] = useState<StockLoteInsumo | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return lotes;
    return lotes.filter(
      (l) =>
        l.numero_lote.toLowerCase().includes(texto) ||
        l.proveedor_nombre.toLowerCase().includes(texto),
    );
  }, [lotes, busqueda]);

  const { paginados, page, setPage, hayVariasPaginas } = usePaginas(
    visibles,
    PAGE_SIZE,
    `${busqueda}|${insumo}|${verBajas}`,
  );
  const limpiar = () => {
    setBusqueda("");
    setInsumo("");
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
      clave: "insumo",
      etiqueta: "Insumo",
      valor: insumos.find((i) => String(i.id) === insumo)?.nombre ?? "",
      onQuitar: () => setInsumo(""),
    },
  ]);

  return (
    <>
      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Número de lote o proveedor..."
          />
        }
        filtros={
          <FiltroSelect
            label="Insumo"
            valor={insumo}
            onCambio={setInsumo}
            opciones={insumos.map((i) => ({
              valor: String(i.id),
              etiqueta: i.nombre,
            }))}
            todos="Todos los insumos"
          />
        }
        herramientas={
          <ToggleInactivos enBarra checked={verBajas} onChange={setVerBajas}>
            Ver dados de baja
          </ToggleInactivos>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiar} />

      {error && <BannerError>{error}</BannerError>}
      {loading && <EstadoCargando>Cargando lotes...</EstadoCargando>}
      {!loading &&
        !error &&
        visibles.length === 0 &&
        (chips.length > 0 ? (
          <EstadoVacioFiltrado onLimpiar={limpiar}>
            No hay lotes de insumo que coincidan con los filtros aplicados.
          </EstadoVacioFiltrado>
        ) : (
          <EstadoVacio>
            {verBajas
              ? "No hay lotes de insumo dados de baja."
              : "No hay lotes de insumo registrados."}
          </EstadoVacio>
        ))}

      {!loading && !error && visibles.length > 0 && (
        <>
          <Tarjeta overflowX="auto">
            <Table.Root variant="outline" w="100%" minW="1040px">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOscuro>Insumo</EncabezadoOscuro>
                  <EncabezadoOscuro>Proveedor</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="media">Lote</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="media">Vencimiento</EncabezadoOscuro>
                  <EncabezadoOscuro numero ancho="media">
                    Recibido
                  </EncabezadoOscuro>
                  <EncabezadoOscuro numero ancho="amplia">
                    Saldo / Estado
                  </EncabezadoOscuro>
                  <EncabezadoOscuro center ancho="acciones">
                    Acciones
                  </EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {paginados.map((l) => (
                  <FilaClickeable
                    onAbrir={() =>
                      navigate(`/trazabilidad/lotes-insumo/${l.lote_insumo_id}`)
                    }
                    key={l.lote_insumo_id}
                    opacity={l.activo ? 1 : 0.65}
                  >
                    <Celda>
                      <DatoPrincipal titulo={l.insumo_nombre} />
                    </Celda>
                    <Celda>
                      <TextoTruncado texto={l.proveedor_nombre} lineClamp={1} color="tabla.textoSecundario" />
                    </Celda>
                    <Celda>
                      <Text fontFamily="mono" fontSize="sm" color="tabla.textoSecundario">
                        {l.numero_lote}
                      </Text>
                    </Celda>
                    <Celda>
                      <HStack gap="2" flexWrap="nowrap">
                        <Text as="span" whiteSpace="nowrap">
                          {formatoFecha(l.fecha_vencimiento)}
                        </Text>
                        {l.vencido && (
                          <Badge colorPalette="red" variant="subtle" size="sm">
                            Vencido
                          </Badge>
                        )}
                      </HStack>
                    </Celda>
                    <Celda numero>
                      {cantidadConUnidad(l.cantidad_recibida, l.unidad)}
                    </Celda>
                    <Celda numero>
                      <Stack gap="0.5" align="flex-end">
                        <HStack gap="2" justify="flex-end" flexWrap="nowrap">
                          {!l.activo && (
                            <Badge colorPalette="red" variant="subtle" size="sm">
                              Baja{l.motivo_baja ? `: ${l.motivo_baja}` : ""}
                            </Badge>
                          )}
                          <Text as="span" fontWeight="bold">
                            {cantidadConUnidad(l.saldo, l.unidad)}
                          </Text>
                        </HStack>
                        {!l.activo && l.dado_de_baja_por_nombre && (
                          <Text fontSize="xs" color="fg.muted">
                            Por {l.dado_de_baja_por_nombre}
                          </Text>
                        )}
                      </Stack>
                    </Celda>
                    <Celda center>
                      <HStack justify="center" gap="2">
                        <BotonAccion
                          accion="historial"
                          label="Ver trazabilidad hacia adelante"
                          onClick={() =>
                            navigate(
                              `/trazabilidad/lotes-insumo/${l.lote_insumo_id}`,
                            )
                          }
                        />
                        {l.activo && Number(l.saldo) > 0 && (
                          <BotonAccion
                            accion="eliminar"
                            label="Dar de baja insumo"
                            onClick={() => setABaja(l)}
                          />
                        )}
                      </HStack>
                    </Celda>
                  </FilaClickeable>
                ))}
              </Table.Body>
            </Table.Root>
          </Tarjeta>
          {hayVariasPaginas && (
            <Paginacion
              count={visibles.length}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {aBaja && (
        <BajaLoteInsumoDialog
          lote={aBaja}
          onConfirmado={recargar}
          onClose={() => setABaja(null)}
        />
      )}
    </>
  );
}

export function StockInsumosPage() {
  const navigate = useNavigate();

  return (
    <Pagina
      titulo="Stock de insumos"
      descripcion="Stock calculado: lo recibido en cada lote menos los consumos, desperdicios y bajas registrados."
      acciones={
        <BotonAgregar onClick={() => navigate("/lotes-insumo/nuevo")}>
          Recibir lote
        </BotonAgregar>
      }
    >
      <PestanasPagina
        pestanas={[
          {
            valor: "insumos",
            etiqueta: "Stock por insumo",
            contenido: <TabStockPorInsumo />,
          },
          {
            valor: "lotes",
            etiqueta: "Lotes recibidos",
            contenido: <TabLotes />,
          },
        ]}
      />
    </Pagina>
  );
}