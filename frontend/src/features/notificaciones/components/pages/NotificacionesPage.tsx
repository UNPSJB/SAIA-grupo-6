import { formatoFechaOCorta } from "../../../../common/utils/fechas";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Box,
  Button,
  Field,
  HStack,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import { usePaginas } from "../../../../common/hooks/usePaginas";
import { obtenerNotificaciones } from "../../services/notificacionService";
import { useSafeTimeout } from "../../../../common/hooks/useDelayedNavigate";
import { registrarRecambioElemento } from "../../../elementoLimpieza/services/elementoLimpiezaService";
import { LuBell, LuCircleCheck, LuArrowUpDown, LuArrowUp, LuArrowDown } from "react-icons/lu";
import type { Notificacion } from "../../types/notificacion";
import { CambiarFechaVencimientoDialog } from "../CambiarFechaVencimientoDialog";
import { ConfiguracionAlertasPanel } from "../ConfiguracionAlertasPanel";
import {
  BannerError,
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
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [notifEditando, setNotifEditando] = useState<Notificacion | null>(null);

  // Filtros
  const [filtroUrgencia, setFiltroUrgencia] = useState<FiltroUrgencia>("todas");
  const [filtroOrigen, setFiltroOrigen] = useState<FiltroOrigen>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const cargar = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await obtenerNotificaciones();
      setNotificaciones(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las notificaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

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

  // Contadores dinámicos: cada grupo ignora su propio filtro pero respeta los demás
  const contadores = useMemo(() => {
    // Base con búsqueda aplicada (siempre)
    let base = notificaciones;
    if (busqueda.trim()) {
      const normalizar = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const termino = normalizar(busqueda.trim());
      base = base.filter(
        (n) =>
          normalizar(n.titulo).includes(termino) ||
          normalizar(n.mensaje).includes(termino),
      );
    }

    // Para contadores de URGENCIA: ignora filtroUrgencia, respeta filtroOrigen
    let baseUrgencia = base;
    if (filtroOrigen !== "todas") {
      baseUrgencia = baseUrgencia.filter((n) => n.tipo === filtroOrigen);
    }

    // Para contadores de ORIGEN: ignora filtroOrigen, respeta filtroUrgencia
    let baseOrigen = base;
    if (filtroUrgencia === "vencidas") {
      baseOrigen = baseOrigen.filter((n) => n.nivel === "VENCIDO");
    } else if (filtroUrgencia === "proximas") {
      baseOrigen = baseOrigen.filter((n) => n.nivel === "PROXIMO_A_VENCER");
    }

    return {
      // Urgencia: cuenta sobre baseUrgencia (sin filtro de urgencia, con filtro de origen)
      todas: baseUrgencia.length,
      vencidas: baseUrgencia.filter((n) => n.nivel === "VENCIDO").length,
      proximas: baseUrgencia.filter((n) => n.nivel === "PROXIMO_A_VENCER").length,
      // Origen: cuenta sobre baseOrigen (sin filtro de origen, con filtro de urgencia)
      todasOrigen: baseOrigen.length,
      ELEMENTO_LIMPIEZA: baseOrigen.filter((n) => n.tipo === "ELEMENTO_LIMPIEZA").length,
      VENCIMIENTO_PERSONAL: baseOrigen.filter((n) => n.tipo === "VENCIMIENTO_PERSONAL").length,
      PLAN_CALIBRACION: baseOrigen.filter((n) => n.tipo === "PLAN_CALIBRACION").length,
      PLAN_MANTENIMIENTO: baseOrigen.filter((n) => n.tipo === "PLAN_MANTENIMIENTO").length,
    };
  }, [notificaciones, busqueda, filtroOrigen, filtroUrgencia]);

  // Filtrado
  const notificacionesFiltradas = useMemo(() => {
    let resultado = [...notificaciones];

    // Filtro por búsqueda
    if (busqueda.trim()) {
      const normalizar = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const termino = normalizar(busqueda.trim());
      resultado = resultado.filter(
        (n) =>
          normalizar(n.titulo).includes(termino) ||
          normalizar(n.mensaje).includes(termino),
      );
    }

    // Filtro por urgencia
    if (filtroUrgencia === "vencidas") {
      resultado = resultado.filter((n) => n.nivel === "VENCIDO");
    } else if (filtroUrgencia === "proximas") {
      resultado = resultado.filter((n) => n.nivel === "PROXIMO_A_VENCER");
    }

    // Filtro por origen
    if (filtroOrigen !== "todas") {
      resultado = resultado.filter((n) => n.tipo === filtroOrigen);
    }

    // Ordenamiento
    if (sortColumn === "estado") {
      resultado.sort((a, b) => {
        const aVal = a.nivel === "VENCIDO" ? 0 : 1;
        const bVal = b.nivel === "VENCIDO" ? 0 : 1;
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      });
    } else if (sortColumn === "vencimiento") {
      resultado.sort((a, b) => {
        const aVal = a.fecha_referencia ? new Date(a.fecha_referencia).getTime() : 0;
        const bVal = b.fecha_referencia ? new Date(b.fecha_referencia).getTime() : 0;
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      });
    } else if (sortColumn === "origen") {
      resultado.sort((a, b) => {
        const cmp = a.tipo.localeCompare(b.tipo);
        return sortDirection === "asc" ? cmp : -cmp;
      });
    } else {
      // Default: VENCIDOS primero
      resultado.sort((a, b) => {
        if (a.nivel === "VENCIDO" && b.nivel !== "VENCIDO") return -1;
        if (a.nivel !== "VENCIDO" && b.nivel === "VENCIDO") return 1;
        return 0;
      });
    }

    return resultado;
  }, [notificaciones, filtroUrgencia, filtroOrigen, busqueda, sortColumn, sortDirection]);

  const {
    paginados: notificacionesPaginadas,
    page,
    setPage,
    total,
    hayVariasPaginas,
  } = usePaginas(notificacionesFiltradas, PAGE_SIZE);

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
                <option value="todas">Todas ({contadores.todas})</option>
                <option value="vencidas" color={contadores.vencidas === 0 ? "gray.400" : undefined}>
                  Vencidas ({contadores.vencidas})
                </option>
                <option value="proximas" color={contadores.proximas === 0 ? "gray.400" : undefined}>
                  Próximas a vencer ({contadores.proximas})
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
                <option value="todas">Todos ({contadores.todasOrigen})</option>
                <option value="ELEMENTO_LIMPIEZA" color={contadores.ELEMENTO_LIMPIEZA === 0 ? "gray.400" : undefined}>
                  Elemento Limpieza ({contadores.ELEMENTO_LIMPIEZA})
                </option>
                <option value="VENCIMIENTO_PERSONAL" color={contadores.VENCIMIENTO_PERSONAL === 0 ? "gray.400" : undefined}>
                  Venc. Personal ({contadores.VENCIMIENTO_PERSONAL})
                </option>
                <option value="PLAN_CALIBRACION" color={contadores.PLAN_CALIBRACION === 0 ? "gray.400" : undefined}>
                  Calibración ({contadores.PLAN_CALIBRACION})
                </option>
                <option value="PLAN_MANTENIMIENTO" color={contadores.PLAN_MANTENIMIENTO === 0 ? "gray.400" : undefined}>
                  Mantenimiento ({contadores.PLAN_MANTENIMIENTO})
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
                onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
                placeholder="Buscar en título o mensaje..."
              />
            </Field.Root>
          </Box>
        </HStack>
      </Tarjeta>

      {loading ? (
        <Spinner color="brand.500" />
      ) : notificacionesFiltradas.length === 0 ? (
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
                {notificacionesPaginadas.map((n) => (
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
                      <Button
                        size="sm"
                        colorPalette="brand"
                        fontWeight="bold"
                        onClick={() => handleResolver(n)}
                      >
                        {etiquetaAccion(n.tipo)}
                      </Button>
                    </Celda>
                  </Table.Row>
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
        </>
      )}
    </Box>
  );
}
