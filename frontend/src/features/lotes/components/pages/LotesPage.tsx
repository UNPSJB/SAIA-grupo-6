import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Table, Text } from "@chakra-ui/react";
import { LuRefreshCw } from "react-icons/lu";
import { useAuth } from "../../../../common/context/useAuth";
import { puedeAdministrar } from "../../../../common/api/permissions";
import { usePaginas } from "../../../../common/hooks/usePaginas";
import { formatoFecha } from "../../../../common/utils/fechas";
import { cantidadConUnidad } from "../../../../common/utils/numeros";
import {
  BarraFiltros,
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
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  FormInput,
  LabelFiltro,
  PageHeader,
  Paginacion,
  Tarjeta,
} from "../../../../components/ui/patrones";
import { useLotes } from "../../hooks/useLotes";
import { ESTADOS_LOTE, type EstadoLote } from "../../types/lote";
import { BadgeEstadoLote } from "../BadgeEstadoLote";

const PAGE_SIZE = 10;

export function LotesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const esAdmin = puedeAdministrar(user);

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

  const filtrados = useMemo(
    () => (producto ? lotes.filter((l) => String(l.producto_id) === producto) : lotes),
    [lotes, producto],
  );
  const { paginados, page, setPage, hayVariasPaginas } = usePaginas(
    filtrados,
    PAGE_SIZE,
    `${producto}|${estado}|${fechaDesde}|${fechaHasta}`,
  );

  const hayFiltros = producto !== "" || estado !== "" || fechaDesde !== "" || fechaHasta !== "";
  const limpiarTodo = () => {
    setProducto("");
    setEstado("");
    setFechaDesde("");
    setFechaHasta("");
  };

  const chips = chipsDeFiltros([
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
    <Box p="5">
      <PageHeader
        title="Lotes de producción"
        description="Cada lote fija la versión de receta con la que se elaboró. Abrí uno para completar sus tareas y registrar los consumos."
        actions={
          esAdmin ? (
            <BotonAgregar onClick={() => navigate("/lotes/nuevo")}>Nuevo lote</BotonAgregar>
          ) : undefined
        }
      />

      <BarraFiltros
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
            <BotonCancelar onClick={recargar} mb="0">
              <LuRefreshCw aria-hidden />
              Actualizar
            </BotonCancelar>
          </>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error && <BannerError>{error}</BannerError>}
      {loading && <EstadoCargando>Cargando lotes...</EstadoCargando>}

      {!loading && !error && filtrados.length === 0 &&
        (hayFiltros ? (
          <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
            No hay lotes que coincidan con los filtros aplicados.
          </EstadoVacioFiltrado>
        ) : (
          <EstadoVacio>Todavía no hay lotes de producción registrados.</EstadoVacio>
        ))}

      {!loading && !error && filtrados.length > 0 && (
        <>
          <Tarjeta overflowX="auto">
            <Table.Root variant="outline" w="100%" minW="980px">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOscuro ancho="media">Fecha</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="amplia">Número de lote</EncabezadoOscuro>
                  <EncabezadoOscuro>Producto</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="angosta">Receta</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="media">Objetivo</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="media">Tareas</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="angosta">Estado</EncabezadoOscuro>
                  <EncabezadoOscuro center ancho="angosta">Acciones</EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {paginados.map((lote) => (
                  <Table.Row key={lote.id}>
                    <Celda>{formatoFecha(lote.fecha_inicio)}</Celda>
                    <Celda>
                      <Text fontFamily="mono" fontSize="sm">
                        {lote.numero_lote}
                      </Text>
                    </Celda>
                    <Celda>{lote.producto_nombre}</Celda>
                    <Celda>{lote.version_numero ? `v${lote.version_numero}` : "Sin receta"}</Celda>
                    <Celda>{cantidadConUnidad(lote.cantidad_objetivo, lote.unidad)}</Celda>
                    <Celda>
                      {lote.items_completados} de {lote.items_total}
                    </Celda>
                    <Celda>
                      <BadgeEstadoLote estado={lote.estado} />
                    </Celda>
                    <Celda center>
                      <BotonAccion
                        accion="ver"
                        label="Abrir lote"
                        onClick={() => navigate(`/lotes/${lote.id}`)}
                      />
                    </Celda>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Tarjeta>

          {hayVariasPaginas && (
            <Paginacion
              count={filtrados.length}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </Box>
  );
}
