import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Box, HStack, Table } from "@chakra-ui/react";
import { BotonExportar } from "../../../exportacion";
import { Pagina, PestanasPagina } from "../../../../components/ui/plantillas";
import { TabSalidas } from "../../../salidas/components/pages/SalidasPage";
import { LuRefreshCw } from "react-icons/lu";
import { usePaginas } from "../../../../common/hooks/usePaginas";
import { formatoFecha, hoyISO } from "../../../../common/utils/fechas";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EstadoVacioFiltrado,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
import {
  BannerError,
  BotonAccion,
  BotonAgregar,
  BotonCancelar,
  CantidadConUnidad,
  Celda,
  DatoPrincipal,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaClickeable,
  FilaEncabezado,
  FormInput,
  LabelFiltro,
  PieTabla,
  PildoraNeutra,
  ProgresoTareas,
  TarjetaTabla,
} from "../../../../components/ui/patrones";
import { useAuth } from "../../../../common/context/useAuth";
import { puedeAdministrar } from "../../../../common/api/permissions";
import { useLotes } from "../../hooks/useLotes";
import { ESTADOS_LOTE, type EstadoLote } from "../../types/lote";
import { BadgeEstadoLote } from "../BadgeEstadoLote";

const PAGE_SIZE = 10;

/** Pestaña "Lotes de producción": el listado de lotes. */
function TabLotes() {
  const navigate = useNavigate();
  // Exportar es de administración (el backend lo exige).
  const esAdmin = puedeAdministrar(useAuth().user);

  const [busqueda, setBusqueda] = useState("");
  const [producto, setProducto] = useState("");
  const [estado, setEstado] = useState<EstadoLote | "">("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const { lotes, loading, error, recargar } = useLotes({ estado, fechaDesde, fechaHasta });

  // Los operadores no pueden listar productos (es del maestro): las opciones
  // salen de los propios lotes.
  const productos = useMemo(() => {
    const porId = new Map<number, string>();
    lotes.forEach((l) => porId.set(l.producto_id, l.producto_nombre));
    return [...porId.entries()]
      .map(([id, nombre]) => ({ valor: String(id), etiqueta: nombre }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta));
  }, [lotes]);

  /*
   * Búsqueda por número de lote o producto. Es lo que se usa ante un reclamo o
   * un retiro: se tiene el número impreso en el envase y hay que llegar a la
   * ficha (que incluye la trazabilidad). Antes eso se hacía desde la pantalla
   * "Trazabilidad", con un desplegable de todos los lotes.
   */
  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return lotes.filter(
      (l) =>
        (!producto || String(l.producto_id) === producto) &&
        (!texto ||
          l.numero_lote.toLowerCase().includes(texto) ||
          l.producto_nombre.toLowerCase().includes(texto)),
    );
  }, [lotes, producto, busqueda]);
  const { paginados, page, setPage } = usePaginas(
    filtrados,
    PAGE_SIZE,
    `${busqueda}|${producto}|${estado}|${fechaDesde}|${fechaHasta}`,
  );

  const hayFiltros =
    busqueda.trim() !== "" || producto !== "" || estado !== "" || fechaDesde !== "" || fechaHasta !== "";
  const limpiarTodo = () => {
    setBusqueda("");
    setProducto("");
    setEstado("");
    setFechaDesde("");
    setFechaHasta("");
  };

  const chips = chipsDeFiltros([
    {
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda.trim(),
      onQuitar: () => setBusqueda(""),
    },
    {
      clave: "producto",
      etiqueta: "Producto",
      valor: productos.find((p) => p.valor === producto)?.etiqueta ?? "",
      onQuitar: () => setProducto(""),
    },
    {
      clave: "estado",
      etiqueta: "Estado",
      valor: ESTADOS_LOTE.find((e) => e.valor === estado)?.etiqueta ?? "",
      onQuitar: () => setEstado(""),
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
    <>
      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Número de lote o producto..."
          />
        }
        filtros={
          <>
            <FiltroSelect
              label="Producto"
              valor={producto}
              onCambio={setProducto}
              opciones={productos}
              todos="Todos los productos"
            />
            <FiltroSelect
              label="Estado"
              valor={estado}
              onCambio={(v) => setEstado(v as EstadoLote | "")}
              opciones={ESTADOS_LOTE.map((e) => ({ valor: e.valor, etiqueta: e.etiqueta }))}
              todos="Todos los estados"
              minW="180px"
            />
            <Box minW="150px">
              <LabelFiltro>Desde</LabelFiltro>
              <FormInput
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                aria-label="Fecha desde"
              />
            </Box>
            <Box minW="150px">
              <LabelFiltro>Hasta</LabelFiltro>
              <FormInput
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                aria-label="Fecha hasta"
              />
            </Box>
          </>
        }
        herramientas={
          <>
            {/*
              Dentro de una pestaña, el alta va en la barra. Quien opera
              también inicia lotes (la ruta es de "operar").
            */}
            <BotonAgregar onClick={() => navigate("/lotes/nuevo")}>Nuevo lote</BotonAgregar>
            {esAdmin && (
              <BotonExportar
                nombreTabla="lotes de producción"
                vista="lotes-produccion"
                filtros={{
                  producto_id: producto || undefined,
                  estado: estado || undefined,
                  fecha_desde: fechaDesde || undefined,
                  fecha_hasta: fechaHasta || undefined,
                  buscar: busqueda.trim() || undefined,
                }}
              />
            )}
            <BotonCancelar onClick={recargar}>
              <LuRefreshCw aria-hidden />
              Actualizar
            </BotonCancelar>
          </>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error && <BannerError>{error}</BannerError>}
      {loading && <EstadoCargando pagina>Cargando lotes...</EstadoCargando>}

      {!loading && !error && filtrados.length === 0 &&
        (hayFiltros ? (
          <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
            No hay lotes que coincidan con los filtros aplicados.
          </EstadoVacioFiltrado>
        ) : (
          <EstadoVacio>Todavía no hay lotes de producción registrados.</EstadoVacio>
        ))}

      {!loading && !error && filtrados.length > 0 && (
        <TarjetaTabla
          pie={
            <PieTabla
              count={filtrados.length}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              unidad={filtrados.length === 1 ? "lote" : "lotes"}
            />
          }
        >
          <Table.Root variant="outline" w="100%" minW="980px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro ancho="media">Fecha</EncabezadoOscuro>
                <EncabezadoOscuro>Producto / Lote</EncabezadoOscuro>
                <EncabezadoOscuro center width="9%">Receta</EncabezadoOscuro>
                <EncabezadoOscuro numero ancho="media">Objetivo</EncabezadoOscuro>
                <EncabezadoOscuro center width="12%">Tareas</EncabezadoOscuro>
                <EncabezadoOscuro ancho="media">Vencimiento</EncabezadoOscuro>
                <EncabezadoOscuro center ancho="amplia">Estado</EncabezadoOscuro>
                <EncabezadoOscuro center width="10%">Acciones</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {paginados.map((lote) => (
                <FilaClickeable onAbrir={() => navigate(`/lotes/${lote.id}`)} key={lote.id}>
                  <Celda whiteSpace="nowrap">{formatoFecha(lote.fecha_inicio)}</Celda>
                  <Celda>
                    <DatoPrincipal titulo={lote.producto_nombre} codigo={lote.numero_lote} />
                  </Celda>
                  <Celda center>
                    {lote.version_numero ? (
                      <PildoraNeutra mono>v{lote.version_numero}</PildoraNeutra>
                    ) : (
                      <PildoraNeutra>Sin receta</PildoraNeutra>
                    )}
                  </Celda>
                  <Celda numero>
                    <CantidadConUnidad valor={lote.cantidad_objetivo} unidad={lote.unidad} />
                  </Celda>
                  <Celda center>
                    <ProgresoTareas hechas={lote.items_completados} total={lote.items_total} />
                  </Celda>
                  <Celda whiteSpace="nowrap">
                    {lote.fecha_vencimiento ? formatoFecha(lote.fecha_vencimiento) : "-"}
                  </Celda>
                  <Celda center>
                    <HStack justify="center" gap="1" flexWrap="wrap">
                      <BadgeEstadoLote estado={lote.estado} />
                      {(() => {
                        if (!lote.fecha_vencimiento) return null;
                        if (lote.fecha_vencimiento < hoyISO()) {
                          return (
                            <Badge colorPalette="red" variant="subtle" size="sm" rounded="full">
                              Vencido
                            </Badge>
                          );
                        }
                        const diasDiff = Math.ceil(
                          (new Date(lote.fecha_vencimiento).getTime() - new Date(hoyISO()).getTime()) /
                            (1000 * 60 * 60 * 24)
                        );
                        if (diasDiff <= 15 && Number(lote.saldo) > 0) {
                          return (
                            <Badge colorPalette="yellow" variant="subtle" size="sm" rounded="full">
                              Próximo a vencer
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                    </HStack>
                  </Celda>
                  <Celda center>
                    <BotonAccion
                      accion="ver"
                      label="Abrir lote"
                      onClick={() => navigate(`/lotes/${lote.id}`)}
                    />
                  </Celda>
                </FilaClickeable>
              ))}
            </Table.Body>
          </Table.Root>
        </TarjetaTabla>
      )}
    </>
  );
}

/**
 * Lotes de producción, con las salidas de producto como sub-opción: antes
 * "Salidas de producto" era una entrada aparte del menú de Producción, aunque
 * cada salida reserva una parte de un lote. `/salidas` redirige acá.
 */
export function LotesPage() {
  return (
    <Pagina
      titulo="Lotes de producción"
      descripcion="Cada lote fija la versión de receta con la que se elaboró. Abrí uno para completar sus tareas y registrar los consumos; desde Salidas se reservan y despachan partes de los lotes a clientes."
    >
      <PestanasPagina
        pestanas={[
          { valor: "lotes", etiqueta: "Lotes de producción", contenido: <TabLotes /> },
          { valor: "salidas", etiqueta: "Salidas de producto", contenido: <TabSalidas /> },
        ]}
      />
    </Pagina>
  );
}
