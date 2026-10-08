import { Fragment, useMemo, useState } from "react";
import { Badge, Box, Field, HStack, Table, Text } from "@chakra-ui/react";
import { LuRefreshCw } from "react-icons/lu";
import { useHistorialChecklists } from "../../hooks/useHistorialChecklists";
import { useEquipos } from "../../../equipo/hooks/useEquipos";
import { usePaginas } from "../../../../common/hooks/usePaginas";
import { formatoFecha } from "../../../../common/utils/fechas";
import {
  BannerError,
  BotonCancelar,
  BotonTexto,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  FormInput,
  FormNativeSelect,
  LabelFiltro,
  PageHeader,
  Paginacion,
  SelectPlaceholder,
  Tarjeta,
} from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

function fechaLocalISO(fecha: Date): string {
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Verde/ámbar/rojo del cumplimiento, con los tokens del tema. */
function colorPorcentaje(pct: number): string {
  if (pct >= 80) return "green.600";
  if (pct >= 50) return "orange.400";
  return "red.700";
}

export function HistorialChecklistPage() {
  const [{ hace7DiasISO, hoyISO }] = useState(() => {
    const hoy = new Date();
    return {
      hoyISO: fechaLocalISO(hoy),
      hace7DiasISO: fechaLocalISO(
        new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000)
      ),
    };
  });

  const [fechaDesde, setFechaDesde] = useState(hace7DiasISO);
  const [fechaHasta, setFechaHasta] = useState(hoyISO);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<string>("");
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  const equipoIdFiltro =
    equipoSeleccionado !== "" ? Number(equipoSeleccionado) : undefined;

  const { equipos } = useEquipos();
  const { historial, loading, error, recargar } = useHistorialChecklists(
    fechaDesde,
    fechaHasta,
    equipoIdFiltro
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

  const checklists = useMemo(() => historial?.checklists ?? [], [historial]);

  // Un rango largo dejaba la tabla creciendo hacia abajo: se pagina de a 10 y
  // se vuelve a la primera página cuando cambia cualquier filtro.
  const {
    paginados: checklistsPaginados,
    page,
    setPage,
    totalPaginas,
    hayVariasPaginas,
  } = usePaginas(
    checklists,
    PAGE_SIZE,
    `${fechaDesde}|${fechaHasta}|${equipoSeleccionado}`,
  );

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

      <Tarjeta p="4" mb="6">
        <HStack gap="4" flexWrap="wrap" align="flex-end">
          <Box minW="180px">
            <Field.Root>
              <LabelFiltro>Desde</LabelFiltro>
              <FormInput
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                w="auto"
              />
            </Field.Root>
          </Box>
          <Box minW="180px">
            <Field.Root>
              <LabelFiltro>Hasta</LabelFiltro>
              <FormInput
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                w="auto"
              />
            </Field.Root>
          </Box>
          <Box minW="200px">
            <Field.Root>
              <LabelFiltro>Equipo</LabelFiltro>
              <FormNativeSelect
                value={equipoSeleccionado}
                onChange={(e) => setEquipoSeleccionado(e.target.value)}
              >
                <SelectPlaceholder value="">
                  Todos los equipos
                </SelectPlaceholder>
                {equipos.map((equipo) => (
                  <option key={equipo.id} value={equipo.id}>
                    {equipo.nombre}
                  </option>
                ))}
              </FormNativeSelect>
            </Field.Root>
          </Box>
        </HStack>
      </Tarjeta>

      {error && <BannerError>{error}</BannerError>}

      {loading && <EstadoCargando>Cargando historial...</EstadoCargando>}

      {!loading && historial && checklists.length === 0 && !error && (
        <EstadoVacio>
          No hay checklists registrados en el rango seleccionado.
        </EstadoVacio>
      )}

      {!loading && historial && checklists.length > 0 && (
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

          <Tarjeta>
            <Table.Root variant="outline" w="100%">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOscuro ancho="media">Fecha</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="media">Equipo</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="angosta">Estado</EncabezadoOscuro>
                  <EncabezadoOscuro center ancho="media">Cumplimiento</EncabezadoOscuro>
                  <EncabezadoOscuro center ancho="media">
                    Incumplidas
                  </EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {checklistsPaginados.map((cl) => (
                  <Fragment key={cl.checklist_id}>
                    <Table.Row>
                      <Celda>{formatoFecha(cl.fecha)}</Celda>
                      <Celda>{cl.equipo_nombre}</Celda>
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
                    </Table.Row>
                    {expandidos.has(cl.checklist_id) && (
                      <Table.Row>
                        <Table.Cell
                          colSpan={5}
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
              count={totalPaginas}
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