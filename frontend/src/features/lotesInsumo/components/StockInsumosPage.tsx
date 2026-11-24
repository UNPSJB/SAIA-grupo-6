import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Box, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { Pagina } from "../../../components/ui/plantillas";
import { BotonExportar } from "../../exportacion";
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
  useIngredientesActivos,
  useStockInsumos,
  useStockLotes,
} from "../hooks/useStockInsumos";
import { useEstadoNavegacion } from "../../../common/hooks/useEstadoNavegacion";

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

function TabStockPorIngrediente() {
  const { stock, loading, error } = useStockInsumos();
  const [busqueda, setBusqueda] = useEstadoNavegacion("StockInsumosPage.busqueda", "");
  const [estado, setEstado] = useEstadoNavegacion("StockInsumosPage.estado", "");

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda);
    return stock.filter((s) => {
      if (texto && !normalizar(s.ingrediente_nombre).includes(texto)) return false;
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
            placeholder="Nombre del ingrediente..."
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
        herramientas={
          <BotonExportar
            nombreTabla="el stock de insumos"
            disabled={visibles.length === 0}
            datos={() => ({
              titulo: "Stock de ingredientes",
              nombre: "stock-ingredientes",
              encabezados: ["Ingrediente", "Recibido", "Consumo real", "Desperdicio", "Bajas", "Stock actual", "Vencido"],
              filas: visibles.map((s) => [
                s.ingrediente_nombre,
                cantidadConUnidad(s.cantidad_recibida, s.unidad),
                cantidadConUnidad(s.consumo_real, s.unidad),
                cantidadConUnidad(s.desperdicio, s.unidad),
                Number(s.cantidad_baja) > 0 ? cantidadConUnidad(s.cantidad_baja, s.unidad) : "-",
                cantidadConUnidad(s.stock, s.unidad),
                Number(s.stock_vencido) > 0 ? cantidadConUnidad(s.stock_vencido, s.unidad) : "-",
              ]),
            })}
          />
        }
      />
      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiar} />

      {error && <BannerError>{error}</BannerError>}
      {loading && <EstadoCargando pagina>Cargando stock...</EstadoCargando>}
      {!loading && !error && stock.length === 0 && (
        <EstadoVacio>No hay ingredientes registrados.</EstadoVacio>
      )}
      {!loading && !error && stock.length > 0 && visibles.length === 0 && (
        <EstadoVacioFiltrado onLimpiar={limpiar}>
          No hay ingredientes que coincidan con los filtros aplicados.
        </EstadoVacioFiltrado>
      )}

      {!loading && !error && visibles.length > 0 && (
        <>
          <Tarjeta overflowX="auto">
            <Table.Root variant="outline" w="100%" minW="1040px">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOscuro>Ingrediente</EncabezadoOscuro>
                  <EncabezadoOscuro numero ancho="cifra">
                    Recibido
                  </EncabezadoOscuro>
                  <EncabezadoOscuro numero ancho="cifra">
                    Consumo real
                  </EncabezadoOscuro>
                  <EncabezadoOscuro numero ancho="cifra">
                    Desperdicio
                  </EncabezadoOscuro>
                  <EncabezadoOscuro numero ancho="cifra">
                    Bajas
                  </EncabezadoOscuro>
                  <EncabezadoOscuro numero ancho="cifra">
                    Stock actual
                  </EncabezadoOscuro>
                  <EncabezadoOscuro numero ancho="cifra">
                    Vencido
                  </EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {paginados.map((s) => (
                  <Table.Row key={s.ingrediente_id}>
                    <Celda>
                      <DatoPrincipal titulo={s.ingrediente_nombre} />
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
  const { ingredientes } = useIngredientesActivos();
  const [ingrediente, setIngrediente] = useEstadoNavegacion("StockInsumosPage.ingrediente", "");
  const [verBajas, setVerBajas] = useEstadoNavegacion("StockInsumosPage.verBajas", false);
  const { lotes, loading, error } = useStockLotes(
    ingrediente ? Number(ingrediente) : undefined,
    verBajas,
  );
  const [busqueda, setBusqueda] = useEstadoNavegacion("StockInsumosPage.busqueda", "");

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda);
    // "Ver dados de baja": solo los lotes dados de baja.
    const segunEstado = lotes.filter((l) => (verBajas ? !l.activo : l.activo));
    if (!texto) return segunEstado;
    return segunEstado.filter(
      (l) =>
        normalizar(l.numero_lote).includes(texto) ||
        normalizar(l.proveedor_nombre).includes(texto) ||
        normalizar(l.insumo_nombre).includes(texto),
    );
  }, [lotes, busqueda, verBajas]);

  const { paginados, page, setPage, hayVariasPaginas } = usePaginas(
    visibles,
    PAGE_SIZE,
    `${busqueda}|${ingrediente}|${verBajas}`,
  );
  const limpiar = () => {
    setBusqueda("");
    setIngrediente("");
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
      clave: "ingrediente",
      etiqueta: "Ingrediente",
      valor: ingredientes.find((i) => String(i.id) === ingrediente)?.nombre ?? "",
      onQuitar: () => setIngrediente(""),
    },
  ]);

  return (
    <>
      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Número de lote, marca o proveedor..."
          />
        }
        filtros={
          <FiltroSelect
            label="Ingrediente"
            valor={ingrediente}
            onCambio={setIngrediente}
            opciones={ingredientes.map((i) => ({
              valor: String(i.id),
              etiqueta: i.nombre,
            }))}
            todos="Todos los ingredientes"
          />
        }
        herramientas={
          <>
            <ToggleInactivos enBarra checked={verBajas} onChange={setVerBajas}>
              Ver dados de baja
            </ToggleInactivos>
            <BotonExportar
              nombreTabla="los lotes recibidos"
              disabled={visibles.length === 0}
              datos={() => ({
                titulo: verBajas ? "Lotes de insumo dados de baja" : "Lotes de insumo recibidos",
                nombre: "lotes-insumo",
                encabezados: ["Ingrediente", "Marca", "Proveedor", "Lote", "Vencimiento", "Recibido", "Saldo", "Estado"],
                filas: visibles.map((l) => [
                  l.ingrediente_nombre,
                  l.insumo_nombre,
                  l.proveedor_nombre,
                  l.numero_lote,
                  formatoFecha(l.fecha_vencimiento),
                  cantidadConUnidad(l.cantidad_recibida, l.unidad),
                  cantidadConUnidad(l.saldo, l.unidad),
                  !l.activo
                    ? `Baja${l.motivo_baja ? `: ${l.motivo_baja}` : ""}${l.dado_de_baja_por_nombre ? ` (por ${l.dado_de_baja_por_nombre})` : ""}`
                    : l.vencido
                      ? "Vencido"
                      : "Vigente",
                ]),
              })}
            />
          </>
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
                  <EncabezadoOscuro>Ingrediente y marca</EncabezadoOscuro>
                  <EncabezadoOscuro>Proveedor</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="amplia">Lote</EncabezadoOscuro>
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
                      <DatoPrincipal titulo={l.ingrediente_nombre} secundario={l.insumo_nombre} />
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
                      {/* Si la fecha y "Vencido" no entran juntos, la etiqueta baja
                          al renglón de abajo en vez de salirse de la celda. */}
                      <HStack gap="1.5" flexWrap="wrap">
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
                        <HStack gap="2" justify="flex-end" flexWrap="wrap">
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

    </>
  );
}

/**
 * Stock de cada ingrediente: lo recibido en todos sus lotes menos lo consumido,
 * desperdiciado y dado de baja. Es su propia opción del menú ("Stock de
 * ingredientes"); los lotes uno por uno están en "Lotes de insumos".
 */
export function StockIngredientesPage() {
  return (
    <Pagina
      titulo="Stock de ingredientes"
      descripcion="Stock calculado de cada ingrediente: lo recibido en sus lotes menos los consumos, desperdicios y bajas registrados."
    >
      <TabStockPorIngrediente />
    </Pagina>
  );
}

/** Lotes de insumo recibidos, uno por uno, con su saldo. Desde acá se recibe un lote nuevo. */
export function LotesInsumoPage() {
  const navigate = useNavigate();

  return (
    <Pagina
      titulo="Lotes de insumos"
      descripcion="Cada lote recibido con su marca, proveedor, vencimiento y saldo (lo recibido menos los consumos, desperdicios y bajas)."
      acciones={
        <BotonAgregar onClick={() => navigate("/lotes-insumo/nuevo")}>
          Recibir lote
        </BotonAgregar>
      }
    >
      <TabLotes />
    </Pagina>
  );
}
