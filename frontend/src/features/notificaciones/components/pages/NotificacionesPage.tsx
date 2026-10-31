import { formatoFechaOCorta } from "../../../../common/utils/fechas";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Box, HStack, Table, Text } from "@chakra-ui/react";
import {
  obtenerCriticidadDashboard,
  obtenerNotificacionesPaginadas,
  type ColumnaOrdenNotificacion,
  type ContadoresNotificaciones,
  type OrigenNotificacion,
  type UrgenciaNotificacion,
} from "../../services/notificacionService";
import { useSafeTimeout } from "../../../../common/hooks/useDelayedNavigate";
import { useOrdenTabla } from "../../../../common/hooks/useOrdenTabla";
import { useValorDebounced } from "../../../../common/hooks/useValorDebounced";
import { registrarRecambioElemento } from "../../../elementoLimpieza/services/elementoLimpiezaService";
import { LuBell, LuCircleCheck } from "react-icons/lu";
import {
  nivelLabel,
  type CriticidadDashboard,
  type Notificacion,
} from "../../types/notificacion";
import { CambiarFechaVencimientoDialog } from "../CambiarFechaVencimientoDialog";
import { ConfiguracionAlertasPanel } from "../ConfiguracionAlertasPanel";
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
  Celda,
  DialogoExito,
  EncabezadoOscuro,
  EstadoCargando,
  FilaEncabezado,
  PageHeader,
  Paginacion,
  Tarjeta,
  TextoTruncado,
} from "../../../../components/ui/patrones";

/** Tamaño de página de todos los listados de la app. */
const PAGE_SIZE = 10;

/**
 * Paleta del badge de "Origen", para que el color signifique lo mismo en
 * todas las vistas: el morado es limpieza y el azul, vencimiento de personal.
 */
const PALETA_ORIGEN: Record<string, string> = {
  ELEMENTO_LIMPIEZA: "purple",
  VENCIMIENTO_PERSONAL: "blue",
  STOCK_BAJO: "red",
};

const paletaOrigen = (tipo: string) => PALETA_ORIGEN[tipo] ?? "gray";

const PALETA_CRITICIDAD = {
  alta: "red",
  media: "orange",
  baja: "yellow",
} as const;

/** Etiquetas legibles de cada origen. Se usan en los selects y en los chips. */
const ETIQUETA_ORIGEN: Record<
  Exclude<OrigenNotificacion, "">,
  string
> = {
  ELEMENTO_LIMPIEZA: "Elemento Limpieza",
  VENCIMIENTO_PERSONAL: "Venc. Personal",
  PLAN_CALIBRACION: "Calibración",
  PLAN_MANTENIMIENTO: "Mantenimiento",
  STOCK_BAJO: "Stock bajo",
};

const ETIQUETA_URGENCIA: Record<
  Exclude<UrgenciaNotificacion, "">,
  string
> = {
  vencidas: "Vencidas",
  proximas: "Próximas a vencer",
  stock_bajo: "Stock bajo",
};

const ETIQUETAS_ORDEN: Record<ColumnaOrdenNotificacion, string> = {
  estado: "Estado",
  vencimiento: "Vencimiento",
  origen: "Origen",
};

function etiquetaOrigen(tipo: string) {
  return ETIQUETA_ORIGEN[tipo as Exclude<OrigenNotificacion, "">] ?? tipo;
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
    case "STOCK_BAJO":
      return "Gestionar stock";
  }
}

export function NotificacionesPage() {
  const navigate = useNavigate();
  const delayed = useSafeTimeout();
  const [items, setItems] = useState<Notificacion[]>([]);
  const [total, setTotal] = useState(0);
  const [contadores, setContadores] = useState<ContadoresNotificaciones>({
    urgencia: { todas: 0, vencidas: 0, proximas: 0, stock_bajo: 0 },
    origen: {
      todas: 0,
      ELEMENTO_LIMPIEZA: 0,
      VENCIMIENTO_PERSONAL: 0,
      PLAN_CALIBRACION: 0,
      PLAN_MANTENIMIENTO: 0,
      STOCK_BAJO: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [criticidad, setCriticidad] = useState<CriticidadDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [notifEditando, setNotifEditando] = useState<Notificacion | null>(null);

  // Filtros. El valor vacío es "sin filtro" (la opción "Todas" del select).
  const [filtroUrgencia, setFiltroUrgencia] = useState<UrgenciaNotificacion>("");
  const [filtroOrigen, setFiltroOrigen] = useState<OrigenNotificacion>("");
  const [busqueda, setBusqueda] = useState("");
  // El fetch usa la búsqueda con debounce: sin esto, cada tecla pedía una
  // página al servidor. El input actualiza `busqueda`; `cargar` y el efecto
  // de abajo dependen de `busquedaAplicada`.
  const busquedaAplicada = useValorDebounced(busqueda);

  // La tabla abre por estado (VENCIDOS primero), que es el orden histórico
  // de urgencia. `columnaPorDefecto` hace que el header ya muestre la flecha
  // y que el primer clic invierta el sentido.
  const [page, setPage] = useState(1);
  const orden = useOrdenTabla<ColumnaOrdenNotificacion, "urgencia">(
    "urgencia",
    "estado",
    () => setPage(1)
  );

  /*
   * Filtros, orden y paginación se resuelven en el servidor: la tabla solo
   * recibe la página actual. El `orden` manda tal cuál al backend:
   * `estado_asc`, `vencimiento_desc`, ...; `urgencia` es el default.
   */
  const ordenParam = orden.orden;

  // Carrera de respuestas (misma idea que `useLista`): el flag `cancelado`
  // que había acá era local a cada invocación y nunca llegaba a `true` — las
  // guardas eran código muerto — así que la respuesta tardía de un filtro
  // anterior pisaba `items`, `total` y `contadores`. Cada pedido toma un
  // número; cuando llega una respuesta que no es la última, se descarta.
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

  const cargarCriticidad = async () => {
    try {
      setCriticidad(await obtenerCriticidadDashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la criticidad");
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void cargar();
      void cargarCriticidad();
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
      void cargarCriticidad();
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

  const cambiarFiltro = (aplicar: () => void) => {
    aplicar();
    setPage(1);
  };

  const limpiarTodo = () => {
    cambiarFiltro(() => {
      setBusqueda("");
      setFiltroUrgencia("");
      setFiltroOrigen("");
      orden.reiniciar();
    });
  };

  const hayFiltros =
    busqueda.trim() !== "" ||
    filtroUrgencia !== "" ||
    filtroOrigen !== "";

  const chips = chipsDeFiltros([
    {
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda,
      recortar: true,
      onQuitar: () => cambiarFiltro(() => setBusqueda("")),
    },
    {
      clave: "urgencia",
      etiqueta: "Urgencia",
      valor: filtroUrgencia !== "" ? ETIQUETA_URGENCIA[filtroUrgencia] : "",
      onQuitar: () => cambiarFiltro(() => setFiltroUrgencia("")),
    },
    {
      clave: "origen",
      etiqueta: "Origen",
      valor: filtroOrigen !== "" ? ETIQUETA_ORIGEN[filtroOrigen] : "",
      onQuitar: () => cambiarFiltro(() => setFiltroOrigen("")),
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

  return (
    <Box p="5">
      <PageHeader
        title={
          <HStack gap="2" flexWrap="wrap" rowGap="2">
            <LuBell aria-hidden />
            Centro de notificaciones
          </HStack>
        }
        description="Alertas pendientes del sistema."
      />

      <ConfiguracionAlertasPanel
        onGuardado={() => mostrarExito("Configuración guardada correctamente.")}
      />

      {criticidad && (
        <Tarjeta p="4" mb="5">
          <HStack justify="space-between" align="start" gap="4" flexWrap="wrap" mb="4">
            <Box>
              <Text fontWeight="bold" fontSize="lg">Resumen de criticidad</Text>
              <Text color="fg.muted" fontSize="sm">
                Riesgo general: {criticidad.nivel_riesgo.toUpperCase()} ({criticidad.total} alertas)
              </Text>
            </Box>
            <HStack gap="2" flexWrap="wrap">
              {(["alta", "media", "baja"] as const).map((nivel) => (
                <Badge key={nivel} colorPalette={PALETA_CRITICIDAD[nivel]} variant="subtle" px="2" py="1">
                  {nivel.toUpperCase()}: {criticidad[`${nivel}s` as "altas" | "medias" | "bajas"]}
                </Badge>
              ))}
            </HStack>
          </HStack>
          {criticidad.alertas.slice(0, 5).map((alerta) => (
            <HStack
              key={alerta.clave}
              justify="space-between"
              align="center"
              gap="3"
              py="3"
              borderTopWidth="1px"
              borderColor="border.subtle"
              flexWrap="wrap"
            >
              <Box flex="1" minW="220px">
                <HStack gap="2" mb="1">
                  <Badge colorPalette={PALETA_CRITICIDAD[alerta.criticidad]} variant="subtle">
                    {alerta.criticidad.toUpperCase()}
                  </Badge>
                  <Text fontSize="sm" color="fg.muted">{alerta.motivo}</Text>
                </HStack>
                <Text fontWeight="semibold">{alerta.titulo}</Text>
                <Text fontSize="sm" color="fg.muted">{alerta.detalle}</Text>
              </Box>
              <BotonAccion
                accion="resolver"
                label="Ver detalle"
                onClick={() => navigate(alerta.destino)}
              />
            </HStack>
          ))}
        </Tarjeta>
      )}

      <DialogoExito isOpen={mensajeExito !== null} mensaje={mensajeExito ?? ""} />

      {notifEditando && (
          <CambiarFechaVencimientoDialog
            key={notifEditando.id_notificacion}
            vencimiento={notifEditando}
          onClose={() => setNotifEditando(null)}
          onSaved={handleFechaGuardada}
        />
      )}

      {error && <BannerError>{error}</BannerError>}

      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={(valor) => cambiarFiltro(() => setBusqueda(valor))}
            placeholder="Buscar en título o mensaje..."
          />
        }
        filtros={
          <>
            <FiltroSelect
              label="Urgencia"
              valor={filtroUrgencia}
              onCambio={(valor) =>
                cambiarFiltro(() =>
                  setFiltroUrgencia(valor as UrgenciaNotificacion)
                )
              }
              opciones={[
                {
                  valor: "vencidas",
                  etiqueta: `Vencidas (${contadores.urgencia.vencidas})`,
                },
                {
                  valor: "proximas",
                  etiqueta: `Próximas a vencer (${contadores.urgencia.proximas})`,
                },
                {
                  valor: "stock_bajo",
                  etiqueta: `Stock bajo (${contadores.urgencia.stock_bajo})`,
                },
              ]}
              todos={`Todas (${contadores.urgencia.todas})`}
            />
            <FiltroSelect
              label="Origen"
              valor={filtroOrigen}
              onCambio={(valor) =>
                cambiarFiltro(() =>
                  setFiltroOrigen(valor as OrigenNotificacion)
                )
              }
              opciones={(
                Object.keys(ETIQUETA_ORIGEN) as Exclude<
                  OrigenNotificacion,
                  ""
                >[]
              ).map((origen) => ({
                valor: origen,
                etiqueta: `${ETIQUETA_ORIGEN[origen]} (${
                  contadores.origen[origen]
                })`,
              }))}
              todos={`Todos (${contadores.origen.todas})`}
            />
          </>
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {loading && <EstadoCargando>Cargando notificaciones...</EstadoCargando>}

      {!loading && items.length === 0 && (
        hayFiltros ? (
          <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
            No hay notificaciones que coincidan con los filtros aplicados.
          </EstadoVacioFiltrado>
        ) : (
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
        )
      )}

      {!loading && items.length > 0 && (
        <>
          <Tarjeta overflowX="auto">
            <Table.Root variant="outline" size="md" w="100%" minW="940px">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOrdenable
                    columna="origen"
                    orden={orden}
                    ancho="media"
                  >
                    Origen
                  </EncabezadoOrdenable>
                  <EncabezadoOrdenable
                    columna="estado"
                    orden={orden}
                    ancho="angosta"
                  >
                    Estado
                  </EncabezadoOrdenable>
                  <EncabezadoOscuro>Detalle / Mensaje</EncabezadoOscuro>
                  <EncabezadoOrdenable
                    columna="vencimiento"
                    orden={orden}
                    ancho="media"
                  >
                    Vencimiento
                  </EncabezadoOrdenable>
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
                        colorPalette={n.nivel === "PROXIMO_A_VENCER" ? "orange" : "red"}
                        variant="subtle"
                        px="2"
                        py="1"
                        borderRadius="md"
                        fontWeight="bold"
                        maxW="100%"
                        overflow="hidden"
                        textOverflow="ellipsis"
                      >
                        {nivelLabel(n.nivel)}
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
