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
import {
  LuArrowDown,
  LuArrowUp,
  LuArrowUpDown,
  LuBell,
  LuBrush,
  LuCircle,
  LuCircleCheck,
  LuFileText,
  LuListChecks,
  LuPackage,
  LuTriangleAlert,
  LuUsers,
  LuWrench,
} from "react-icons/lu";
import type { IconType } from "react-icons/lib";
import type {
  AlertaCriticidad,
  Criticidad,
  CriticidadDashboard,
  IconoCriticidad,
} from "../../types/notificacion";
import { CambiarFechaVencimientoDialog } from "../CambiarFechaVencimientoDialog";
import {
  ChipsFiltros,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
import {
  BannerError,
  Celda,
  DialogoExito,
  EncabezadoOscuro,
  FilaEncabezado,
  FormInput,
  FormNativeSelect,
  LabelFiltro,
  Paginacion,
  Tarjeta,
  DatoPrincipal,
} from "../../../../components/ui/patrones";
import { Pagina } from "../../../../components/ui/plantillas";
import { useAuth } from "../../../../common/context/useAuth";
import { puedeAdministrar } from "../../../../common/api/permissions";
import { BotonExportar } from "../../../exportacion";

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

const ICONO_ORIGEN: Record<IconoCriticidad, IconType> = {
  limpieza: LuBrush,
  calibracion: LuWrench,
  incidente: LuTriangleAlert,
  personal: LuUsers,
  documento: LuFileText,
  checklist: LuListChecks,
  stock: LuPackage,
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

/** Para vencimientos personales, el detalle trae oraciones largas como
 * "'Manipulación de Alimentos B' de pepe pepe vence en 8 días". Acota en el
 * nombre de la entidad (todo lo que está antes de " vence" / " venció").
 *
 * Para documento corta antes de " - versión".
 * Para elemento de limpieza corta antes de " superó su frecuencia".
 */
function detalleCorto(detalle?: string | null): string {
  if (!detalle) return "";
  const recortes = [
    detalle.indexOf(" vence"),
    detalle.indexOf(" venció"),
    detalle.indexOf(" · versión"),
    detalle.indexOf(" superó su frecuencia"),
  ];
  const corte = Math.min(
    ...recortes.map((i) => (i === -1 ? Infinity : i)),
  );
  if (corte === Infinity) return detalle;
  return detalle.slice(0, corte).trimEnd();
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

function OrigenIcono({ icono }: { icono: IconoCriticidad }) {
  const Icono = ICONO_ORIGEN[icono];
  return <Icono aria-hidden size={16} />;
}

function normalizar(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function NotificacionesPage() {
  const navigate = useNavigate();
  const esAdmin = puedeAdministrar(useAuth().user);
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
        await registrarRecambioElemento(alerta.recambio_id);
        mostrarExito("Recambio registrado correctamente.");
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "No se pudo registrar el recambio",
        );
      }
      return;
    }

    if (alerta.origen === "VENCIMIENTO_PERSONAL") {
      setAlertaEditando(alerta);
      return;
    }

    // Las notificaciones de documento solían apuntar a /documentos/:id, que no
    // existe y devolvía 404. El destino real es la pantalla de nueva versión,
    // que recibe el id del documento (disponible en entidad_id).
    if (alerta.origen === "DOCUMENTO") {
      navigate(`/documentos/${alerta.entidad_id}/nueva-version`);
      return;
    }

    // Las notificaciones de checklist no llevan al historial genérico: se
    // navega al historial filtrado por el equipo de la alerta y se prepara
    // para abrir el detalle del primer checklist (botón "ver" / icono de ojo).
    if (alerta.origen === "CHECKLIST") {
      navigate(`/checklist/historial?equipoId=${alerta.entidad_id}&abrirDetalle=true`);
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

    // OJO: aca NO se aplica filtroOrigen. Estos contadores son los del propio
    // dropdown de origen; filtrando por origen quedaban en 0 todas las demas
    // opciones al elegir una.

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
  }, [datos.alertas, criticidadesSeleccionadas, busqueda]);

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

  const limpiarTodo = () => {
    mostrarTodasLasSituaciones();
    setSortColumn(null);
    setSortDirection("asc");
  };

  const ETIQUETAS_ORDEN: Record<Exclude<SortColumn, null>, string> = {
    criticidad: "Criticidad",
    origen: "Origen",
    plazo: "Plazo",
  };

  const chips = chipsDeFiltros([
    {
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda,
      recortar: true,
      onQuitar: () => {
        setBusqueda("");
        setPage(1);
      },
    },
    {
      clave: "criticidad",
      etiqueta: "Criticidad",
      valor: criticidadesSeleccionadas
        .map((criticidad) => etiquetaCriticidad(criticidad))
        .join(", "),
      onQuitar: () => {
        setCriticidadesSeleccionadas([]);
        setPage(1);
      },
    },
    {
      clave: "origen",
      etiqueta: "Origen",
      valor:
        filtroOrigen !== "todas"
          ? (ETIQUETA_ORIGEN[filtroOrigen] ?? filtroOrigen)
          : "",
      onQuitar: () => handleFiltroOrigen("todas"),
    },
    {
      clave: "orden",
      etiqueta: "Orden",
      valor:
        sortColumn !== null
          ? `${ETIQUETAS_ORDEN[sortColumn]} ${
              sortDirection === "asc" ? "↑" : "↓"
            }`
          : "",
      visible: sortColumn !== null,
      onQuitar: () => {
        setSortColumn(null);
        setSortDirection("asc");
      },
    },
  ]);

  const nivel = datos.nivel_riesgo;
  const nivelTexto = etiquetaNivelRiesgo(nivel);
  const nivelPaleta = paletaNivelRiesgo(nivel);

  return (
    <Pagina
      titulo={
        <HStack gap="2" flexWrap="wrap" rowGap="2">
          <LuBell aria-hidden />
          Centro de notificaciones
        </HStack>
      }
      descripcion="Situaciones de inocuidad detectadas y priorizadas automáticamente según su criticidad."
    >
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
              color={`${nivelPaleta}.fg`}
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
            bg="bg.subtle"
            color="fg"
            borderWidth="1px"
            borderColor="border"
            variant="solid"
            _hover={{ bg: "bg.muted", borderColor: "border.emphasized" }}
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
              <LuCircle size={14} /> Alta
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
              <LuCircle size={14} /> Media
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
              <LuCircle size={14} /> Baja
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

          {/* Exportar es de administración (el backend lo exige). */}
          {esAdmin && (
            <BotonExportar
              nombreTabla="las notificaciones"
              disabled={alertasFiltradas.length === 0}
              datos={() => ({
                titulo: "Centro de notificaciones",
                nombre: "notificaciones",
                encabezados: ["Criticidad", "Origen", "Situación", "Detalle", "Plazo", "Motivo"],
                filas: alertasFiltradas.map((alerta) => [
                  etiquetaCriticidad(alerta.criticidad),
                  ETIQUETA_ORIGEN[alerta.origen] ?? alerta.origen,
                  alerta.titulo,
                  alerta.detalle,
                  alerta.fecha_referencia ? formatoFechaOCorta(alerta.fecha_referencia) : alerta.plazo,
                  alerta.motivo,
                ]),
              })}
            />
          )}
        </HStack>
      </Tarjeta>

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

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
                  <EncabezadoOscuro width="10%" onClick={() => handleSort("criticidad")}>
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
                  {/* Situación es el dato principal: lleva más ancho que el motivo, que
                      se acomoda en dos renglones. La criticidad es una sola palabra. */}
                  <EncabezadoOscuro width="32%">Situación</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="media" onClick={() => handleSort("plazo")}>
                    <Box display="flex" alignItems="center" gap="1" cursor="pointer" userSelect="none">
                      Plazo
                      <SortIcon column="plazo" sortColumn={sortColumn} sortDirection={sortDirection} />
                    </Box>
                  </EncabezadoOscuro>
                  <EncabezadoOscuro>Motivo</EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>

              <Table.Body>
                {alertasPaginadas.map((alerta) => {
                  const accionable =
                    alerta.origen === "ELEMENTO_LIMPIEZA" ||
                    alerta.origen === "VENCIMIENTO_PERSONAL" ||
                    Boolean(alerta.destino);

                  return (
                    <Table.Row
                      key={alerta.clave}
                      role={accionable ? "button" : undefined}
                      tabIndex={accionable ? 0 : -1}
                      aria-label={accionable ? `Notificación: ${alerta.titulo}` : undefined}
                      onClick={() => accionable && handleResolver(alerta)}
                      onKeyDown={(e) => {
                        if (!accionable) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleResolver(alerta);
                        }
                      }}
                      _hover={{
                        bg: accionable ? "#F0FDFA" : undefined,
                        cursor: accionable ? "pointer" : "default",
                      }}
                      transition="background-color 0.15s ease"
                      cursor={accionable ? "pointer" : "default"}
                    >
                      <Celda>
                        <Badge
                          colorPalette={PALETA_CRITICIDAD[alerta.criticidad]}
                          variant="subtle"
                          px="2.5"
                          py="1"
                          rounded="full"
                          fontWeight="semibold"
                        >
                          {etiquetaCriticidad(alerta.criticidad)}
                        </Badge>
                      </Celda>

                      <Celda>
                        <HStack gap="2">
                          <OrigenIcono icono={alerta.icono} />
                          <Text fontSize="sm" fontWeight="medium">
                            {ETIQUETA_ORIGEN[alerta.origen] ?? alerta.origen}
                          </Text>
                        </HStack>
                      </Celda>

                      <Celda>
                        <DatoPrincipal
                          titulo={alerta.titulo}
                          secundario={
                            alerta.entidad_nombre ??
                            (alerta.origen === "INCIDENTE"
                              ? alerta.detalle.split(" · ")[0]
                              : detalleCorto(alerta.detalle))
                          }
                        />
                      </Celda>

                      <Celda whiteSpace="nowrap">
                        {alerta.fecha_referencia
                          ? formatoFechaOCorta(alerta.fecha_referencia)
                          : alerta.plazo}
                      </Celda>

                      <Celda>
                        <Text fontSize="sm" color="fg.muted" title={alerta.motivo}>
                          {alerta.motivo}
                        </Text>
                      </Celda>
                    </Table.Row>
                  );
                })}
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
    </Pagina>
  );
}
