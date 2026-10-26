import { formatoFechaOCorta } from "../../../../common/utils/fechas";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Box,
  Field,
  HStack,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import {
  obtenerNotificacionesPaginadas,
  type ContadoresNotificaciones,
} from "../../services/notificacionService";
import { useSafeTimeout } from "../../../../common/hooks/useDelayedNavigate";
import { useValorDebounced } from "../../../../common/hooks/useValorDebounced";
import { registrarRecambioElemento } from "../../../elementoLimpieza/services/elementoLimpiezaService";
import { LuBell, LuCircleCheck, LuArrowUpDown, LuArrowUp, LuArrowDown } from "react-icons/lu";
import type { Notificacion } from "../../types/notificacion";
import { CambiarFechaVencimientoDialog } from "../CambiarFechaVencimientoDialog";
import { ConfiguracionAlertasPanel } from "../ConfiguracionAlertasPanel";
import {
  BannerError,
  BotonAccion,
  Celda,
  DialogoExito,
  EncabezadoOscuro,
  FilaEncabezado,
  FormInput,
  FormNativeSelect,
  LabelFiltro,
  PageHeader,
  Paginacion,
  Tarjeta,
  TextoTruncado,
} from "../../../../components/ui/patrones";

/** Tamaño de página de todos los listados de la app. */
const PAGE_SIZE = 10;

/**
 * Paleta del badge de "Origen", para que el color signifique lo mismo en
 * todas las vistas: el morado es limpieza y el gris, calibración/mantenimiento.
 */
const PALETA_ORIGEN: Record<string, string> = {
  ELEMENTO_LIMPIEZA: "purple",
  VENCIMIENTO_PERSONAL: "blue",
};

const paletaOrigen = (tipo: string) => PALETA_ORIGEN[tipo] ?? "gray";

function etiquetaOrigen(tipo: string) {
  switch (tipo) {
    case "ELEMENTO_LIMPIEZA":
      return "Elemento Limpieza";
    case "VENCIMIENTO_PERSONAL":
      return "Vencimiento Personal";
    case "PLAN_CALIBRACION":
      return "Calibración";
    case "PLAN_MANTENIMIENTO":
      return "Mantenimiento";
  }
}

function etiquetaAccion(tipo: string) {
  switch (tipo) {
    case "ELEMENTO_LIMPIEZA":
      return "Registrar Recambio";
    case "VENCIMIENTO_PERSONAL":
      return "Cambiar fecha";
    case "PLAN_CALIBRACION":
      return "Registrar calibración";
    case "PLAN_MANTENIMIENTO":
      return "Registrar mantenimiento";
  }
}

type FiltroUrgencia = "todas" | "vencidas" | "proximas";
type FiltroOrigen = "todas" | "ELEMENTO_LIMPIEZA" | "VENCIMIENTO_PERSONAL" | "PLAN_CALIBRACION" | "PLAN_MANTENIMIENTO";
type SortColumn = "estado" | "vencimiento" | "origen" | null;
type SortDirection = "asc" | "desc";

/** Icono de ordenamiento en header de tabla. */
function SortIcon({ column, sortColumn, sortDirection }: {
  column: SortColumn & string;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
}) {
  if (sortColumn !== column) return <LuArrowUpDown size={14} opacity={0.4} />;
  return sortDirection === "asc" ? <LuArrowUp size={14} /> : <LuArrowDown size={14} />;
}

export function NotificacionesPage() {
  const navigate = useNavigate();
  const delayed = useSafeTimeout();
  const [items, setItems] = useState<Notificacion[]>([]);
  const [total, setTotal] = useState(0);
  const [contadores, setContadores] = useState<ContadoresNotificaciones>({
    urgencia: { todas: 0, vencidas: 0, proximas: 0 },
    origen: {
      todas: 0,
      ELEMENTO_LIMPIEZA: 0,
      VENCIMIENTO_PERSONAL: 0,
      PLAN_CALIBRACION: 0,
      PLAN_MANTENIMIENTO: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [notifEditando, setNotifEditando] = useState<Notificacion | null>(null);

  // Filtros
  const [filtroUrgencia, setFiltroUrgencia] = useState<FiltroUrgencia>("todas");
  const [filtroOrigen, setFiltroOrigen] = useState<FiltroOrigen>("todas");
  const [busqueda, setBusqueda] = useState("");
  // El fetch usa la búsqueda con debounce: sin esto, cada tecla pedía una
  // página al servidor. El input actualiza `busqueda`; `cargar` y el efecto
  // de abajo dependen de `busquedaAplicada`.
  const busquedaAplicada = useValorDebounced(busqueda);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);

  /*
   * Filtros, orden y paginación se resuelven en el servidor: la tabla solo
   * recibe la página actual. El `orden` manda tal cuál al backend:
   * `estado_asc`, `vencimiento_desc`, ... y "urgencia" (el default) es el
   * ordenamiento histórico que dejaba los VENCIDOS arriba.
   */
  const ordenParam: string = sortColumn
    ? `${sortColumn}_${sortDirection}`
    : "urgencia";

  // Carrera de respuestas (misma idea que `useLista`): el flag `cancelado`
  // que había acá era local a cada invocación y nunca llegaba a `true` —
  // las guardas eran código muerto — así que la respuesta tardía de un
  // filtro anterior pisaba `items`, `total` y `contadores`. Cada pedido toma
  // un número; cuando llega una respuesta que no es la última, se descarta.
  const ultimoPedido = useRef(0);

  const cargar = async (pagina: number = page) => {
    const pedido = ++ultimoPedido.current;
    try {
      setLoading(true);
      setError(null);
      const data = await obtenerNotificacionesPaginadas(pagina, PAGE_SIZE, {
        buscar: busquedaAplicada,
        urgencia: filtroUrgencia,
        origen: filtroOrigen,
        orden: ordenParam,
      });
      if (pedido !== ultimoPedido.current) return; // llegó tarde: se descarta
      setItems(data.items);
      setTotal(data.total);
      setContadores(data.contadores);
    } catch (e) {
      if (pedido !== ultimoPedido.current) return;
      setError(e instanceof Error ? e.message : "No se pudieron cargar las notificaciones");
    } finally {
      // Solo el último pedido apaga el spinner (ver `useLista`).
      if (pedido === ultimoPedido.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // Los filtros y la página son la "dependencia real" de la recarga: al
    // cambiar cualquiera se pide de nuevo, y al cambiar un filtro la página
    // ya se resetea a 1 en cada handler. La búsqueda entra ya "terminada"
    // (300 ms después de la última tecla).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filtroUrgencia, filtroOrigen, busquedaAplicada, ordenParam]);

  // Página fuera de rango: `items` vacío con `total > 0` significa que la
  // página pedida ya no existe (p. ej. se resolvió la última alerta de la
  // última página). El ajuste va DURANTE el render — el mismo "recortar, no
  // corregir con un efecto" de `useListaPaginada` — porque un `useEffect`
  // con `setPage` dispara la regla `set-state-in-effect`. El cambio de
  // `page` dispara el efecto de arriba y re-pide la última página válida.
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total > 0 && items.length === 0 && page > totalPaginas) {
    setPage(totalPaginas);
  }

  const mostrarExito = (mensaje: string) => {
    window.dispatchEvent(new Event("actualizar_notificaciones"));
    setMensajeExito(mensaje);
    delayed(() => {
      setMensajeExito(null);
      cargar();
    }, 1500);
  };

  const handleResolver = async (notif: Notificacion) => {
    if (notif.tipo === "ELEMENTO_LIMPIEZA") {
      try {
        await registrarRecambioElemento(notif.entidad_id);
        mostrarExito("Recambio registrado correctamente.");
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "No se pudo registrar el recambio",
        );
        console.error("Error al registrar recambio:", error);
      }
    } else if (notif.tipo === "VENCIMIENTO_PERSONAL") {
      setNotifEditando(notif);
    } else {
      navigate(notif.link_destino);
    }
  };

  const handleFechaGuardada = () => {
    setNotifEditando(null);
    mostrarExito("Fecha de vencimiento actualizada correctamente.");
  };

  const handleSort = (column: SortColumn & string) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const handleUrgenciaChange = (val: FiltroUrgencia) => {
    setFiltroUrgencia(val);
    setPage(1);
  };

  const handleOrigenChange = (val: FiltroOrigen) => {
    setFiltroOrigen(val);
    setPage(1);
  };

  return (
    <Box p="5">
      <PageHeader
        title={
          <HStack gap="2" flexWrap="wrap" rowGap="2">
            <LuBell aria-hidden />
            Centro de notificaciones
          </HStack>
        }
        description="Vencimientos pendientes del sistema."
      />

      <ConfiguracionAlertasPanel
        onGuardado={() => mostrarExito("Configuración guardada correctamente.")}
      />

      <DialogoExito isOpen={mensajeExito !== null} mensaje={mensajeExito ?? ""} />

      {notifEditando && (
        <CambiarFechaVencimientoDialog
          key={notifEditando.id_notificacion}
          notificacion={notifEditando}
          onClose={() => setNotifEditando(null)}
          onSaved={handleFechaGuardada}
        />
      )}

      {error && <BannerError>{error}</BannerError>}

      {/* FILTROS */}
      <Tarjeta p="4" mb="6">
        <HStack gap="4" flexWrap="wrap" align="flex-end">
          <Box minW="200px">
            <Field.Root>
              <LabelFiltro>Urgencia</LabelFiltro>
              <FormNativeSelect
                value={filtroUrgencia}
                onChange={(e) => handleUrgenciaChange(e.target.value as FiltroUrgencia)}
              >
                <option value="todas">Todas ({contadores.urgencia.todas})</option>
                <option value="vencidas" color={contadores.urgencia.vencidas === 0 ? "gray.400" : undefined}>
                  Vencidas ({contadores.urgencia.vencidas})
                </option>
                <option value="proximas" color={contadores.urgencia.proximas === 0 ? "gray.400" : undefined}>
                  Próximas a vencer ({contadores.urgencia.proximas})
                </option>
              </FormNativeSelect>
            </Field.Root>
          </Box>

          <Box minW="200px">
            <Field.Root>
              <LabelFiltro>Origen</LabelFiltro>
              <FormNativeSelect
                value={filtroOrigen}
                onChange={(e) => handleOrigenChange(e.target.value as FiltroOrigen)}
              >
                <option value="todas">Todos ({contadores.origen.todas})</option>
                <option value="ELEMENTO_LIMPIEZA" color={contadores.origen.ELEMENTO_LIMPIEZA === 0 ? "gray.400" : undefined}>
                  Elemento Limpieza ({contadores.origen.ELEMENTO_LIMPIEZA})
                </option>
                <option value="VENCIMIENTO_PERSONAL" color={contadores.origen.VENCIMIENTO_PERSONAL === 0 ? "gray.400" : undefined}>
                  Venc. Personal ({contadores.origen.VENCIMIENTO_PERSONAL})
                </option>
                <option value="PLAN_CALIBRACION" color={contadores.origen.PLAN_CALIBRACION === 0 ? "gray.400" : undefined}>
                  Calibración ({contadores.origen.PLAN_CALIBRACION})
                </option>
                <option value="PLAN_MANTENIMIENTO" color={contadores.origen.PLAN_MANTENIMIENTO === 0 ? "gray.400" : undefined}>
                  Mantenimiento ({contadores.origen.PLAN_MANTENIMIENTO})
                </option>
              </FormNativeSelect>
            </Field.Root>
          </Box>

          <Box minW="250px" flex="1">
            <Field.Root>
              <LabelFiltro>Búsqueda</LabelFiltro>
              <FormInput
                type="text"
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}                placeholder="Buscar en título o mensaje..."
              />
            </Field.Root>
          </Box>
        </HStack>
      </Tarjeta>

      {loading ? (
        <Spinner color="brand.500" />
      ) : items.length === 0 ? (
        <Tarjeta p="8" textAlign="center">
          <HStack justify="center" gap="2" color="green.fg">
            <LuCircleCheck aria-hidden />
            <Text fontSize="lg" fontWeight="bold">
              No hay notificaciones pendientes
            </Text>
          </HStack>
          <Text color="fg.muted" fontSize="sm">
            Todos los vencimientos están al día.
          </Text>
        </Tarjeta>
      ) : (
        <>
          <Tarjeta overflowX="auto">
            <Table.Root variant="outline" size="md" w="100%" minW="940px">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOscuro
                    ancho="media"
                    onClick={() => handleSort("origen")}
                  >
                    <Box display="flex" alignItems="center" gap="1" cursor="pointer" userSelect="none">
                      Origen
                      <SortIcon column="origen" sortColumn={sortColumn} sortDirection={sortDirection} />
                    </Box>
                  </EncabezadoOscuro>
                  <EncabezadoOscuro
                    ancho="angosta"
                    onClick={() => handleSort("estado")}
                  >
                    <Box display="flex" alignItems="center" gap="1" cursor="pointer" userSelect="none">
                      Estado
                      <SortIcon column="estado" sortColumn={sortColumn} sortDirection={sortDirection} />
                    </Box>
                  </EncabezadoOscuro>
                  <EncabezadoOscuro>Detalle / Mensaje</EncabezadoOscuro>
                  <EncabezadoOscuro
                    ancho="media"
                    onClick={() => handleSort("vencimiento")}
                  >
                    <Box display="flex" alignItems="center" gap="1" cursor="pointer" userSelect="none">
                      Vencimiento
                      <SortIcon column="vencimiento" sortColumn={sortColumn} sortDirection={sortDirection} />
                    </Box>
                  </EncabezadoOscuro>
                  <EncabezadoOscuro center ancho="acciones">
                    Acción
                  </EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>
              <Table.Body>
                {items.map((n) => (
                  <Table.Row
                    key={n.id_notificacion}
                    _hover={{ bg: "brand.50" }}
                    transition="background 0.2s"
                  >
                    <Celda>
                      <Badge
                        colorPalette={paletaOrigen(n.tipo)}
                        variant="subtle"
                        px="2"
                        py="1"
                        borderRadius="md"
                        fontWeight="bold"
                        maxW="100%"
                        overflow="hidden"
                        textOverflow="ellipsis"
                      >
                        {etiquetaOrigen(n.tipo)}
                      </Badge>
                    </Celda>
                    <Celda>
                      <Badge
                        colorPalette={n.nivel === "VENCIDO" ? "red" : "orange"}
                        variant="subtle"
                        px="2"
                        py="1"
                        borderRadius="md"
                        fontWeight="bold"
                        maxW="100%"
                        overflow="hidden"
                        textOverflow="ellipsis"
                      >
                        {n.nivel === "VENCIDO" ? "VENCIDO" : "PRÓXIMO A VENCER"}
                      </Badge>
                    </Celda>
                    <Celda>
                      <TextoTruncado fontWeight="bold" color="fg" mb="1" texto={n.titulo} />
                      <TextoTruncado fontSize="sm" color="fg.muted" max={80} texto={n.mensaje} />
                    </Celda>
                    <Celda fontSize="sm">
                      {formatoFechaOCorta(n.fecha_referencia)}
                    </Celda>
                    <Celda center>
                      <BotonAccion
                        /*
                         * "Registrar recambio" se resuelve acá mismo (llama a la
                         * API y refresca la tabla), así que usa su propio ícono.
                         * El resto navega a otra pantalla o abre un diálogo:
                         * mismo ícono de "ir", solo que en un tono más suave.
                         */
                        accion={n.tipo === "ELEMENTO_LIMPIEZA" ? "recambio" : "resolver"}
                        label={etiquetaAccion(n.tipo) ?? "Resolver"}
                        onClick={() => handleResolver(n)}
                      />
                    </Celda>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Tarjeta>

          {totalPaginas > 1 && (
            <Paginacion
              count={total}
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
