import { formatoFechaOCorta } from "../../../../common/utils/fechas";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  HStack,
  Spinner,
  Table,
  Text,
  VStack,
} from "@chakra-ui/react";
import { usePaginas } from "../../../../common/hooks/usePaginas";
import { obtenerCriticidadDashboard } from "../../services/notificacionService";
import { useSafeTimeout } from "../../../../common/hooks/useDelayedNavigate";
import { registrarRecambioElemento } from "../../../elementoLimpieza/services/elementoLimpiezaService";
import { LuArrowDown, LuArrowUp, LuArrowUpDown, LuBell, LuCircleCheck } from "react-icons/lu";
import type {
  AlertaCriticidad,
  Criticidad,
  CriticidadDashboard,
  IconoCriticidad,
} from "../../types/notificacion";
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

const PAGE_SIZE = 10;

type FiltroOrigen =
  | "todas"
  | "ELEMENTO_LIMPIEZA"
  | "VENCIMIENTO_PERSONAL"
  | "PLAN_CALIBRACION"
  | "PLAN_MANTENIMIENTO"
  | "DOCUMENTO"
  | "CHECKLIST"
  | "INCIDENTE";
type SortColumn = "criticidad" | "plazo" | "origen" | null;
type SortDirection = "asc" | "desc";

const ORDEN_CRITICIDAD: Record<Criticidad, number> = {
  alta: 0,
  media: 1,
  baja: 2,
};

const PALETA_CRITICIDAD: Record<Criticidad, string> = {
  alta: "red",
  media: "orange",
  baja: "green",
};

const ICONO_ORIGEN: Record<IconoCriticidad, string> = {
  limpieza: "🧽",
  calibracion: "🔧",
  incidente: "⚠️",
  personal: "👤",
  documento: "📄",
  checklist: "☑️",
};

const ETIQUETA_ORIGEN: Record<string, string> = {
  ELEMENTO_LIMPIEZA: "Elemento de limpieza",
  VENCIMIENTO_PERSONAL: "Vencimiento de personal",
  PLAN_CALIBRACION: "Calibración",
  PLAN_MANTENIMIENTO: "Mantenimiento",
  DOCUMENTO: "Documento",
  CHECKLIST: "Checklist",
  INCIDENTE: "Incidente",
};

const ETIQUETA_ACCION: Record<string, string> = {
  ELEMENTO_LIMPIEZA: "Registrar recambio",
  VENCIMIENTO_PERSONAL: "Cambiar fecha",
  PLAN_CALIBRACION: "Gestionar calibración",
  PLAN_MANTENIMIENTO: "Gestionar mantenimiento",
  DOCUMENTO: "Ver documento",
  CHECKLIST: "Ver checklist",
  INCIDENTE: "Ver incidente",
};

function etiquetaCriticidad(criticidad: Criticidad) {
  return criticidad === "alta"
    ? "ALTA"
    : criticidad === "media"
      ? "MEDIA"
      : "BAJA";
}

function etiquetaNivelRiesgo(nivel: CriticidadDashboard["nivel_riesgo"]) {
  return nivel === "alto" ? "ALTO" : nivel === "medio" ? "MEDIO" : "BAJO";
}

function paletaNivelRiesgo(nivel: CriticidadDashboard["nivel_riesgo"]) {
  return nivel === "alto" ? "red" : nivel === "medio" ? "orange" : "green";
}

function SortIcon({
  column,
  sortColumn,
  sortDirection,
}: {
  column: Exclude<SortColumn, null>;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
}) {
  if (sortColumn !== column) return <LuArrowUpDown size={14} opacity={0.4} />;
  return sortDirection === "asc" ? <LuArrowUp size={14} /> : <LuArrowDown size={14} />;
}

function normalizar(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function NotificacionesPage() {
  const navigate = useNavigate();
  const delayed = useSafeTimeout();

  const [datos, setDatos] = useState<CriticidadDashboard>({
    nivel_riesgo: "bajo",
    total: 0,
    altas: 0,
    medias: 0,
    bajas: 0,
    alertas: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [alertaEditando, setAlertaEditando] = useState<AlertaCriticidad | null>(null);
  const [recambiando, setRecambiando] = useState<string | null>(null);

  const [criticidadesSeleccionadas, setCriticidadesSeleccionadas] = useState<Criticidad[]>([]);
  const [filtroOrigen, setFiltroOrigen] = useState<FiltroOrigen>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const cargar = async () => {
    try {
      setLoading(true);
      setError(null);
      const resultado = await obtenerCriticidadDashboard();
      setDatos(resultado);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo calcular la criticidad de la entidad",
      );
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

  const handleResolver = async (alerta: AlertaCriticidad) => {
    if (alerta.origen === "ELEMENTO_LIMPIEZA" && alerta.recambio_id !== null) {
      try {
        setRecambiando(alerta.clave);
        await registrarRecambioElemento(alerta.recambio_id);
        mostrarExito("Recambio registrado correctamente.");
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "No se pudo registrar el recambio",
        );
      } finally {
        setRecambiando(null);
      }
      return;
    }

    if (alerta.origen === "VENCIMIENTO_PERSONAL") {
      setAlertaEditando(alerta);
      return;
    }

    navigate(alerta.destino);
  };

  const handleFechaGuardada = () => {
    setAlertaEditando(null);
    mostrarExito("Fecha de vencimiento actualizada correctamente.");
  };

  const alertasFiltradas = useMemo(() => {
    let resultado = [...datos.alertas];

    if (busqueda.trim()) {
      const termino = normalizar(busqueda.trim());
      resultado = resultado.filter(
        (alerta) =>
          normalizar(alerta.titulo).includes(termino) ||
          normalizar(alerta.detalle).includes(termino) ||
          normalizar(alerta.motivo).includes(termino),
      );
    }

    if (criticidadesSeleccionadas.length > 0) {
      resultado = resultado.filter((alerta) =>
        criticidadesSeleccionadas.includes(alerta.criticidad),
      );
    }

    if (filtroOrigen !== "todas") {
      resultado = resultado.filter((alerta) => alerta.origen === filtroOrigen);
    }

    if (sortColumn === "criticidad") {
      resultado.sort((a, b) => {
        const diferencia =
          ORDEN_CRITICIDAD[a.criticidad] - ORDEN_CRITICIDAD[b.criticidad];
        return sortDirection === "asc" ? diferencia : -diferencia;
      });
    } else if (sortColumn === "plazo") {
      resultado.sort((a, b) => {
        const aFecha = a.plazo.startsWith("hace") ? 0 : 1;
        const bFecha = b.plazo.startsWith("hace") ? 0 : 1;
        return sortDirection === "asc" ? aFecha - bFecha : bFecha - aFecha;
      });
    } else if (sortColumn === "origen") {
      const comparar = (a: AlertaCriticidad, b: AlertaCriticidad) =>
        (ETIQUETA_ORIGEN[a.origen] ?? a.origen).localeCompare(
          ETIQUETA_ORIGEN[b.origen] ?? b.origen,
        );
      resultado.sort((a, b) => {
        const diferencia = comparar(a, b);
        return sortDirection === "asc" ? diferencia : -diferencia;
      });
    }

    return resultado;
  }, [datos.alertas, criticidadesSeleccionadas, filtroOrigen, busqueda, sortColumn, sortDirection]);

  const contadores = useMemo(() => {
    // Los contadores de origen siempre representan el conjunto que se está
    // visualizando, incluyendo los filtros de criticidad, búsqueda y origen.
    // De esta forma, si se selecciona "Baja", "Elementos" muestra solamente
    // cuántas situaciones BAJAS provienen de elementos de limpieza.
    let base = [...datos.alertas];

    if (criticidadesSeleccionadas.length > 0) {
      base = base.filter((alerta) =>
        criticidadesSeleccionadas.includes(alerta.criticidad),
      );
    }

    if (busqueda.trim()) {
      const termino = normalizar(busqueda.trim());
      base = base.filter(
        (alerta) =>
          normalizar(alerta.titulo).includes(termino) ||
          normalizar(alerta.detalle).includes(termino) ||
          normalizar(alerta.motivo).includes(termino),
      );
    }

    if (filtroOrigen !== "todas") {
      base = base.filter((alerta) => alerta.origen === filtroOrigen);
    }

    return {
      todas: base.length,
      elementos: base.filter((a) => a.origen === "ELEMENTO_LIMPIEZA").length,
      personal: base.filter((a) => a.origen === "VENCIMIENTO_PERSONAL").length,
      calibracion: base.filter((a) => a.origen === "PLAN_CALIBRACION").length,
      mantenimiento: base.filter((a) => a.origen === "PLAN_MANTENIMIENTO").length,
      documentos: base.filter((a) => a.origen === "DOCUMENTO").length,
      checklists: base.filter((a) => a.origen === "CHECKLIST").length,
      incidentes: base.filter((a) => a.origen === "INCIDENTE").length,
    };
  }, [datos.alertas, criticidadesSeleccionadas, filtroOrigen, busqueda]);

  const {
    paginados: alertasPaginadas,
    page,
    setPage,
    total,
    hayVariasPaginas,
  } = usePaginas(alertasFiltradas, PAGE_SIZE);

  const handleSort = (column: Exclude<SortColumn, null>) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const handleFiltroOrigen = (value: FiltroOrigen) => {
    setFiltroOrigen(value);
    setPage(1);
  };

  const alternarCriticidad = (criticidad: Criticidad) => {
    setCriticidadesSeleccionadas((actuales) =>
      actuales.includes(criticidad)
        ? actuales.filter((actual) => actual !== criticidad)
        : [...actuales, criticidad],
    );
    setPage(1);
  };

  const mostrarTodasLasSituaciones = () => {
    setCriticidadesSeleccionadas([]);
    setFiltroOrigen("todas");
    setBusqueda("");
    setPage(1);
  };

  const nivel = datos.nivel_riesgo;
  const nivelTexto = etiquetaNivelRiesgo(nivel);
  const nivelPaleta = paletaNivelRiesgo(nivel);

  return (
    <Box p="5">
      <PageHeader
        title={
          <HStack gap="2" flexWrap="wrap" rowGap="2">
            <LuBell aria-hidden />
            Centro de notificaciones
          </HStack>
        }
        description="Situaciones de inocuidad detectadas y priorizadas automáticamente según su criticidad."
      />

      <ConfiguracionAlertasPanel
        onGuardado={() => mostrarExito("Configuración guardada correctamente.")}
      />

      <DialogoExito isOpen={mensajeExito !== null} mensaje={mensajeExito ?? ""} />

      {alertaEditando && (
        <CambiarFechaVencimientoDialog
          key={alertaEditando.clave}
          vencimiento={{
            entidad_id: alertaEditando.entidad_id,
            mensaje: alertaEditando.detalle,
            fecha_referencia: alertaEditando.fecha_referencia,
          }}
          onClose={() => setAlertaEditando(null)}
          onSaved={handleFechaGuardada}
        />
      )}

      {error && <BannerError>{error}</BannerError>}

      {/* Resumen general del motor de riesgo. */}
      <Tarjeta p={{ base: "4", md: "5" }} mb="6">
        <Flex
          direction={{ base: "column", md: "row" }}
          align={{ base: "stretch", md: "center" }}
          gap={{ base: "5", md: "8" }}
        >
          {/* Nivel general de riesgo: destacado a la izquierda. */}
          <Box flex="1" minW="0">
            <Text fontSize="sm" color="fg.muted" mb="1">
              Nivel de riesgo de la entidad
            </Text>
            <Text
              fontSize={{ base: "3xl", md: "4xl" }}
              lineHeight="1.1"
              fontWeight="extrabold"
              color={`${nivelPaleta}.600`}
            >
              {nivelTexto}
            </Text>
            <Text fontSize="sm" color="fg.muted" mt="2">
              Riesgo general de inocuidad
            </Text>
          </Box>

          {/* Contador clickeable: limpia los filtros y muestra todo. */}
          <Button
            flexShrink={0}
            minW={{ base: "100%", md: "170px" }}
            minH="112px"
            h="auto"
            px="6"
            py="4"
            borderRadius="xl"
            bg="gray.50"
            color="gray.800"
            borderWidth="1px"
            borderColor="gray.200"
            variant="solid"
            _hover={{ bg: "gray.100", borderColor: "gray.300" }}
            _dark={{ bg: "gray.800", color: "white", borderColor: "gray.700" }}
            onClick={mostrarTodasLasSituaciones}
            aria-label="Mostrar todas las situaciones y limpiar los filtros"
            title="Mostrar todas las situaciones"
          >
            <VStack gap="1" align="center">
              <Text fontSize="3xl" lineHeight="1" fontWeight="bold">
                {alertasFiltradas.length}
              </Text>
              <Text fontSize="xs" letterSpacing="wider" fontWeight="bold">
                SITUACIONES
              </Text>
              <Text fontSize="xs" fontWeight="normal" color="fg.muted">
                Ver todas
              </Text>
            </VStack>
          </Button>

          {/* Filtros de criticidad acumulables, sin contadores individuales. */}
          <VStack align="stretch" gap="2" minW={{ base: "100%", md: "145px" }}>
            <Button
              justifyContent="flex-start"
              variant={criticidadesSeleccionadas.includes("alta") ? "solid" : "ghost"}
              colorPalette="red"
              size="sm"
              onClick={() => alternarCriticidad("alta")}
              aria-pressed={criticidadesSeleccionadas.includes("alta")}
              title="Filtrar situaciones de criticidad alta"
            >
              🔴 Alta
            </Button>
            <Button
              justifyContent="flex-start"
              variant={criticidadesSeleccionadas.includes("media") ? "solid" : "ghost"}
              colorPalette="orange"
              size="sm"
              onClick={() => alternarCriticidad("media")}
              aria-pressed={criticidadesSeleccionadas.includes("media")}
              title="Filtrar situaciones de criticidad media"
            >
              🟠 Media
            </Button>
            <Button
              justifyContent="flex-start"
              variant={criticidadesSeleccionadas.includes("baja") ? "solid" : "ghost"}
              colorPalette="green"
              size="sm"
              onClick={() => alternarCriticidad("baja")}
              aria-pressed={criticidadesSeleccionadas.includes("baja")}
              title="Filtrar situaciones de criticidad baja"
            >
              🟢 Baja
            </Button>
          </VStack>
        </Flex>
      </Tarjeta>

      {/* Filtros de la gestión de riesgos. */}
      <Tarjeta p="4" mb="6">
        <HStack gap="4" flexWrap="wrap" align="flex-end">
          <Box minW="220px">
            <Field.Root>
              <LabelFiltro>Origen</LabelFiltro>
              <FormNativeSelect
                value={filtroOrigen}
                onChange={(e) =>
                  handleFiltroOrigen(e.target.value as FiltroOrigen)
                }
              >
                <option value="todas">Todos ({contadores.todas})</option>
                <option value="ELEMENTO_LIMPIEZA">Elementos ({contadores.elementos})</option>
                <option value="VENCIMIENTO_PERSONAL">Personal ({contadores.personal})</option>
                <option value="PLAN_CALIBRACION">Calibración ({contadores.calibracion})</option>
                <option value="PLAN_MANTENIMIENTO">Mantenimiento ({contadores.mantenimiento})</option>
                <option value="DOCUMENTO">Documentos ({contadores.documentos})</option>
                <option value="CHECKLIST">Checklists ({contadores.checklists})</option>
                <option value="INCIDENTE">Incidentes ({contadores.incidentes})</option>
              </FormNativeSelect>
            </Field.Root>
          </Box>

          <Box minW="250px" flex="1">
            <Field.Root>
              <LabelFiltro>Búsqueda</LabelFiltro>
              <FormInput
                type="text"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar situación, elemento o motivo..."
              />
            </Field.Root>
          </Box>
        </HStack>
      </Tarjeta>

      {loading ? (
        <Spinner color="brand.500" />
      ) : alertasFiltradas.length === 0 ? (
        <Tarjeta p="8" textAlign="center">
          <HStack justify="center" gap="2" color="green.fg">
            <LuCircleCheck aria-hidden />
            <Text fontSize="lg" fontWeight="bold">
              No hay situaciones que requieran atención
            </Text>
          </HStack>
          <Text color="fg.muted" fontSize="sm">
            No se detectaron situaciones activas con los filtros seleccionados.
          </Text>
        </Tarjeta>
      ) : (
        <>
          <Tarjeta overflowX="auto">
            <Table.Root variant="outline" size="md" w="100%" minW="1100px">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOscuro ancho="angosta" onClick={() => handleSort("criticidad")}>
                    <Box display="flex" alignItems="center" gap="1" cursor="pointer" userSelect="none">
                      Criticidad
                      <SortIcon column="criticidad" sortColumn={sortColumn} sortDirection={sortDirection} />
                    </Box>
                  </EncabezadoOscuro>
                  <EncabezadoOscuro ancho="media" onClick={() => handleSort("origen")}>
                    <Box display="flex" alignItems="center" gap="1" cursor="pointer" userSelect="none">
                      Origen
                      <SortIcon column="origen" sortColumn={sortColumn} sortDirection={sortDirection} />
                    </Box>
                  </EncabezadoOscuro>
                  <EncabezadoOscuro>Situación</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="media" onClick={() => handleSort("plazo")}>
                    <Box display="flex" alignItems="center" gap="1" cursor="pointer" userSelect="none">
                      Plazo
                      <SortIcon column="plazo" sortColumn={sortColumn} sortDirection={sortDirection} />
                    </Box>
                  </EncabezadoOscuro>
                  <EncabezadoOscuro>Motivo</EncabezadoOscuro>
                  <EncabezadoOscuro center ancho="acciones">Acción</EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>

              <Table.Body>
                {alertasPaginadas.map((alerta) => (
                  <Table.Row
                    key={alerta.clave}
                    _hover={{ bg: "brand.50" }}
                    transition="background 0.2s"
                  >
                    <Celda>
                      <Badge
                        colorPalette={PALETA_CRITICIDAD[alerta.criticidad]}
                        variant="subtle"
                        px="2"
                        py="1"
                        borderRadius="md"
                        fontWeight="bold"
                      >
                        {etiquetaCriticidad(alerta.criticidad)}
                      </Badge>
                    </Celda>

                    <Celda>
                      <HStack gap="2">
                        <Text aria-hidden>{ICONO_ORIGEN[alerta.icono]}</Text>
                        <Text fontSize="sm" fontWeight="medium">
                          {ETIQUETA_ORIGEN[alerta.origen] ?? alerta.origen}
                        </Text>
                      </HStack>
                    </Celda>

                    <Celda>
                      <TextoTruncado fontWeight="bold" color="fg" mb="1" texto={alerta.titulo} />
                      <TextoTruncado fontSize="sm" color="fg.muted" max={90} texto={alerta.detalle} />
                    </Celda>

                    <Celda fontSize="sm">
                      {alerta.fecha_referencia
                        ? formatoFechaOCorta(alerta.fecha_referencia)
                        : alerta.plazo}
                    </Celda>

                    <Celda>
                      <Text fontSize="sm" color="fg.muted" title={alerta.motivo}>
                        {alerta.motivo}
                      </Text>
                    </Celda>

                    <Celda center>
                      <Button
                        size="sm"
                        colorPalette="brand"
                        fontWeight="bold"
                        loading={recambiando === alerta.clave}
                        onClick={() => handleResolver(alerta)}
                      >
                        {ETIQUETA_ACCION[alerta.origen] ?? "Ver situación"}
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
