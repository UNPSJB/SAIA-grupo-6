import { Fragment, useMemo, useState } from "react";
import { Badge, Box, Field, Table, Text } from "@chakra-ui/react";
import { LuRefreshCw } from "react-icons/lu";
import { useHistorialChecklists } from "../../hooks/useHistorialChecklists";
import { DetalleChecklistDialog } from "../DetalleChecklistDialog";
import type { HistorialChecklistItem } from "../../types/checklist";
import { useEquipos } from "../../../equipo/hooks/useEquipos";
import {
  formatoFecha,
  haceDiasISO,
  hoyISO,
} from "../../../../common/utils/fechas";
import { useOrdenTabla } from "../../../../common/hooks/useOrdenTabla";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EncabezadoOrdenable,
  EstadoVacioFiltrado,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
import {
  BannerError,
  BotonAccion,
  BotonCancelar,
  BotonTexto,
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
  TextoTruncado,
} from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

type ColumnaHistorial = "fecha" | "equipo";

const ETIQUETAS_ORDEN: Record<ColumnaHistorial, string> = {
  fecha: "Fecha",
  equipo: "Equipo",
};

/** Verde/ámbar/rojo del cumplimiento, con los tokens del tema. */
function colorPorcentaje(pct: number): string {
  if (pct >= 80) return "green.600";
  if (pct >= 50) return "orange.400";
  return "red.700";
}

export function HistorialChecklistPage() {
  // El rango inicial (últimos 7 días) es también el destino de "Limpiar todo".
  const [rangoInicial] = useState(() => ({
    desde: haceDiasISO(7),
    hasta: hoyISO(),
  }));

  const [fechaDesde, setFechaDesde] = useState(rangoInicial.desde);
  const [fechaHasta, setFechaHasta] = useState(rangoInicial.hasta);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [checklistSeleccionado, setChecklistSeleccionado] =
    useState<HistorialChecklistItem | null>(null);

  const equipoIdFiltro =
    equipoSeleccionado !== "" ? Number(equipoSeleccionado) : undefined;

  const { equipos } = useEquipos();

  const [page, setPage] = useState(1);

  // La tabla abre por fecha descendente (lo más reciente arriba). Al ordenar
  // se vuelve a la página 1: `alCambiar` replica lo que hace
  // `useListaPaginada` en los listados que no manejan `page` a mano.
  const orden = useOrdenTabla<ColumnaHistorial, "fecha_desc">(
    "fecha_desc",
    "fecha",
    () => setPage(1)
  );

  const { historial, loading, error, recargar } = useHistorialChecklists(
    fechaDesde,
    fechaHasta,
    equipoIdFiltro,
    busqueda,
    orden.orden,
    page,
    PAGE_SIZE
  );

  const toggleExpandido = (checklistId: number) => {
    setExpandidos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(checklistId)) {
        nuevo.delete(checklistId);
      } else {
        nuevo.add(checklistId);
      }
      return nuevo;
    });
  };

  // `items` es la página actual; el cumplimiento general y el total vienen
  // calculados sobre TODO el período en el backend.
  const checklists = useMemo(() => historial?.items ?? [], [historial]);
  const total = historial?.total ?? 0;
  const totalPaginas = historial?.total_paginas ?? 1;
  const hayVariasPaginas = totalPaginas > 1;

  // Página fuera de rango: si el rango se acortó (p. ej. un refresco después
  // de que otro usuario cerró checklists) el backend devuelve `items` vacíos
  // con `total > 0`. El ajuste va DURANTE el render — el mismo "recortar, no
  // corregir con un efecto" de `useListaPaginada` — porque un `useEffect`
  // con `setPage` dispara la regla `set-state-in-effect`. Con `page` en las
  // dependencias del hook, la corrección dispara el re-fetch de la última
  // página válida y la tabla nunca queda vacía con la paginación oculta.
  if (
    historial &&
    historial.total > 0 &&
    historial.items.length === 0 &&
    page > totalPaginas
  ) {
    setPage(totalPaginas);
  }

  /** Al cambiar cualquier filtro la página 1 siempre es válida. */
  const cambiarFiltro = (aplicar: () => void) => {
    aplicar();
    setPage(1);
  };

  const limpiarTodo = () => {
    cambiarFiltro(() => {
      setBusqueda("");
      setEquipoSeleccionado("");
      setFechaDesde(rangoInicial.desde);
      setFechaHasta(rangoInicial.hasta);
      orden.reiniciar();
    });
  };

  // El orden no cambia las filas, así que no cuenta para el vacío "por
  // filtros": solo búsqueda, equipo y un rango distinto al de apertura.
  const hayFiltros =
    busqueda.trim() !== "" ||
    equipoSeleccionado !== "" ||
    fechaDesde !== rangoInicial.desde ||
    fechaHasta !== rangoInicial.hasta;

  const chips = chipsDeFiltros([
    {
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda,
      recortar: true,
      onQuitar: () => cambiarFiltro(() => setBusqueda("")),
    },
    {
      clave: "equipo",
      etiqueta: "Equipo",
      valor:
        equipos.find((equipo) => String(equipo.id) === equipoSeleccionado)
          ?.nombre ?? (equipoSeleccionado !== "" ? "Equipo seleccionado" : ""),
      onQuitar: () => cambiarFiltro(() => setEquipoSeleccionado("")),
    },
    {
      clave: "periodo",
      etiqueta: "Período",
      valor: `${formatoFecha(fechaDesde)} – ${formatoFecha(fechaHasta)}`,
      visible:
        fechaDesde !== rangoInicial.desde || fechaHasta !== rangoInicial.hasta,
      onQuitar: () =>
        cambiarFiltro(() => {
          setFechaDesde(rangoInicial.desde);
          setFechaHasta(rangoInicial.hasta);
        }),
    },
    {
      clave: "orden",
      etiqueta: "Orden",
      valor:
        orden.columna !== null
          ? `${ETIQUETAS_ORDEN[orden.columna]} ${
              orden.direccion === "asc" ? "↑" : "↓"
            }`
          : "",
      visible: !orden.esPorDefecto && orden.columna !== null,
      onQuitar: orden.reiniciar,
    },
  ]);

  /** Botón de "Ver/ocultar N incumplidas" dentro de la celda. */
  const botonIncumplidas = (checklistId: number, cantidad: number) => (
    <BotonTexto onClick={() => toggleExpandido(checklistId)}>
      {expandidos.has(checklistId) ? "Ocultar" : `Ver ${cantidad}`}
    </BotonTexto>
  );

  return (
    <Box p="5">
      <PageHeader
        title="Historial de checklists"
        description="Cumplimiento por período, filtrado por rango de fechas y equipo."
        actions={
          <BotonCancelar onClick={recargar}>
            <LuRefreshCw aria-hidden />
            Actualizar
          </BotonCancelar>
        }
      />

      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={(valor) => cambiarFiltro(() => setBusqueda(valor))}
            placeholder="Buscar por equipo..."
          />
        }
        filtros={
          <>
            <Box minW="170px">
              <Field.Root>
                <LabelFiltro>Desde</LabelFiltro>
                <FormInput
                  type="date"
                  value={fechaDesde}
                  onChange={(e) =>
                    cambiarFiltro(() => setFechaDesde(e.target.value))
                  }
                  w="auto"
                />
              </Field.Root>
            </Box>
            <Box minW="170px">
              <Field.Root>
                <LabelFiltro>Hasta</LabelFiltro>
                <FormInput
                  type="date"
                  value={fechaHasta}
                  onChange={(e) =>
                    cambiarFiltro(() => setFechaHasta(e.target.value))
                  }
                  w="auto"
                />
              </Field.Root>
            </Box>
            <FiltroSelect
              label="Equipo"
              valor={equipoSeleccionado}
              onCambio={(valor) =>
                cambiarFiltro(() => setEquipoSeleccionado(valor))
              }
              opciones={equipos.map((equipo) => ({
                valor: String(equipo.id),
                etiqueta: equipo.nombre,
              }))}
              todos="Todos los equipos"
            />
          </>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {error && <BannerError>{error}</BannerError>}

      {loading && <EstadoCargando>Cargando historial...</EstadoCargando>}

      {!loading && historial && checklists.length === 0 && !error && (
        hayFiltros ? (
          <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
            No hay checklists que coincidan con los filtros aplicados.
          </EstadoVacioFiltrado>
        ) : (
          <EstadoVacio>
            No hay checklists registrados en el rango seleccionado.
          </EstadoVacio>
        )
      )}

      {historial && checklists.length > 0 && (
        <>
          <Text fontSize="sm" color="fg.muted" mb="4">
            Cumplimiento general del período:{" "}
            <Text
              as="span"
              fontWeight="bold"
              color={colorPorcentaje(historial.porcentaje_cumplimiento_general)}
            >
              {historial.porcentaje_cumplimiento_general.toFixed(0)}%
            </Text>
          </Text>

          {/* Mientras se pide la página siguiente la tabla SIGUE montada (sin
              el parpadeo de desmontar/montar): solo se atenúa y se bloquean
              los clicks hasta que llega la respuesta. */}
          <Tarjeta
            opacity={loading ? 0.6 : 1}
            pointerEvents={loading ? "none" : "auto"}
            transition="opacity 0.15s"
          >
            <Table.Root variant="outline" w="100%">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOrdenable columna="fecha" orden={orden} ancho="media">
                    Fecha
                  </EncabezadoOrdenable>
                  <EncabezadoOrdenable columna="equipo" orden={orden} ancho="media">
                    Equipo
                  </EncabezadoOrdenable>
                  <EncabezadoOscuro ancho="angosta">Estado</EncabezadoOscuro>
                  <EncabezadoOscuro center ancho="media">Cumplimiento</EncabezadoOscuro>
                  <EncabezadoOscuro center ancho="media">
                    Incumplidas
                  </EncabezadoOscuro>
                  <EncabezadoOscuro center ancho="media">
                    Acciones
                  </EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {checklists.map((cl) => (
                  <Fragment key={cl.checklist_id}>
                    <Table.Row>
                      <Celda>{formatoFecha(cl.fecha)}</Celda>
                      <Celda>
                        <TextoTruncado texto={cl.equipo_nombre} />
                      </Celda>
                      <Celda>
                        <Badge
                          colorPalette={cl.estado === "cerrado" ? "green" : "orange"}
                          rounded="md"
                          px="2"
                          py="1"
                          textTransform="capitalize"
                          maxW="100%"
                          overflow="hidden"
                          textOverflow="ellipsis"
                        >
                          {cl.estado}
                        </Badge>
                      </Celda>
                      <Celda center>
                        <Text fontWeight="bold" color={colorPorcentaje(cl.porcentaje_cumplimiento)}>
                          {cl.porcentaje_cumplimiento.toFixed(0)}%
                        </Text>
                        <Text fontSize="xs" color="fg.muted">
                          {cl.tareas_completadas}/{cl.total_tareas}
                        </Text>
                      </Celda>
                      <Celda center>
                        {cl.tareas_incumplidas.length === 0 ? (
                          <Text fontSize="sm" color="fg.subtle">
                            —
                          </Text>
                        ) : (
                          botonIncumplidas(cl.checklist_id, cl.tareas_incumplidas.length)
                        )}
                      </Celda>
                      <Celda center>
                        <BotonAccion
                          accion="ver"
                          label="Ver detalle del checklist"
                          onClick={() => setChecklistSeleccionado(cl)}
                        />
                      </Celda>
                    </Table.Row>
                    {expandidos.has(cl.checklist_id) && (
                      <Table.Row>
                        <Table.Cell
                          colSpan={6}
                          color="fg"
                          fontSize="sm"
                          px="4"
                          py="3"
                          borderBottomWidth="1px"
                          borderColor="border.subtle"
                          bg="red.50"
                        >
                          <Text fontSize="sm" fontWeight="bold" color="red.fg" mb="2">
                            Tareas incumplidas:
                          </Text>
                          {cl.tareas_incumplidas.map((t, i) => (
                            <Text key={t.tarea_id ?? i} fontSize="sm" color="fg.muted">
                              • {t.nombre}
                            </Text>
                          ))}
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Fragment>
                ))}
              </Table.Body>
            </Table.Root>
          </Tarjeta>

          {hayVariasPaginas && (
            <Paginacion
              count={total}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={setPage}
            />
          )}

          {checklistSeleccionado && (
            <DetalleChecklistDialog
              isOpen
              checklist={checklistSeleccionado}
              onClose={() => setChecklistSeleccionado(null)}
            />
          )}
        </>
      )}
    </Box>
  );
}
