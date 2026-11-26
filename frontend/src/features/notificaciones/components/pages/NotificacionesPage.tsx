import { formatoFechaOCorta } from "../../../../common/utils/fechas";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Badge,
  Box,
  Button,
  chakra,
  Field,
  Flex,
  HStack,
  IconButton,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import { Tooltip } from "../../../../components/ui/tooltip";
import { useEsCelular } from "../../../../common/hooks/useEsCelular";
import { usePaginas } from "../../../../common/hooks/usePaginas";
import {
  cambiarLecturaNotificacion,
  marcarTodasNotificacionesLeidas,
  obtenerCriticidadDashboard,
} from "../../services/notificacionService";
import { notificarCambioNotificaciones } from "../../eventoNotificaciones";
import { usePlanesDeAlertas } from "../../../planesAccion/hooks/usePlanesDeAlertas";
import { useSafeTimeout } from "../../../../common/hooks/useDelayedNavigate";
import { registrarRecambioElemento } from "../../../elementoLimpieza/services/elementoLimpiezaService";
import {
  LuArrowDown,
  LuArrowUp,
  LuArrowUpDown,
  LuBell,
  LuBrush,
  LuCheck,
  LuCheckCheck,
  LuCircleCheck,
  LuCircleDot,
  LuClipboardCheck,
  LuFileText,
  LuListChecks,
  LuPackage,
  LuShieldAlert,
  LuShieldCheck,
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
  MotivoPlan,
} from "../../types/notificacion";
import {
  TEXTO_MOTIVO_PLAN,
  RIESGO_MAXIMO,
  formatoPuntaje,
  nivelDePuntaje,
} from "../../types/notificacion";
import { CambiarFechaVencimientoDialog } from "../CambiarFechaVencimientoDialog";
import {
  ETIQUETA_IMPACTO,
  ETIQUETA_PROBABILIDAD,
  alertaEnCelda,
  celdaDeParametros,
  columnaDeProbabilidad,
  escalaDeImpacto,
} from "../../../dashboard/types/matrizRiesgo";
import {
  BarraFiltros,
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
  TextoTruncado,
} from "../../../../components/ui/patrones";
import { Pagina } from "../../../../components/ui/plantillas";
import { useAuth } from "../../../../common/context/useAuth";
import { puedeAdministrar, puedeOperar } from "../../../../common/api/permissions";
import { BotonExportar } from "../../../exportacion";

const PAGE_SIZE = 10;

type FiltroLectura = "todas" | "no_leidas" | "leidas";

type FiltroOrigen =
  | "todas"
  | "ELEMENTO_LIMPIEZA"
  | "VENCIMIENTO_PERSONAL"
  | "PLAN_CALIBRACION"
  | "PLAN_MANTENIMIENTO"
  | "HOMOLOGACION_INSUMO"
  | "DOCUMENTO"
  | "CHECKLIST"
  | "INCIDENTE";
type SortColumn = "criticidad" | "plazo" | "origen" | null;
type SortDirection = "asc" | "desc";

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
  HOMOLOGACION_INSUMO: "Homologación de insumo",
  DOCUMENTO: "Documento",
  CHECKLIST: "Checklist",
  INCIDENTE: "Incidente",
};

/**
 * Las situaciones con puntaje 0 (tipos desactivados, reclamos o retiros con una
 * causa que no cuenta) se
 * notifican pero no entran en el cálculo de riesgo: no tienen criticidad, así
 * que ningún filtro alta/media/baja las incluye.
 */
function coincideConCriticidad(
  alerta: AlertaCriticidad,
  seleccionadas: Criticidad[],
): boolean {
  return alerta.puntaje > 0 && seleccionadas.includes(alerta.criticidad);
}

function etiquetaCriticidad(criticidad: Criticidad) {
  return criticidad === "alta"
    ? "ALTA"
    : criticidad === "media"
      ? "MEDIA"
      : "BAJA";
}

type NivelRiesgoGeneral = CriticidadDashboard["nivel_riesgo"];

const ICONO_NIVEL: Record<NivelRiesgoGeneral, IconType> = {
  alto: LuShieldAlert,
  medio: LuTriangleAlert,
  bajo: LuShieldCheck,
  sin_riesgo: LuCircleCheck,
};

const MENSAJE_NIVEL: Record<NivelRiesgoGeneral, string> = {
  alto: "Requiere atención prioritaria",
  medio: "Conviene hacerle seguimiento",
  bajo: "Situación controlada",
  sin_riesgo: "Sin situaciones que requieran atención",
};

/** Los tres tramos del medidor, con los mismos rangos que el backend. */
const TRAMOS_MEDIDOR: { nivel: NivelRiesgoGeneral; paleta: string; etiqueta: string; rango: string }[] = [
  { nivel: "bajo", paleta: "green", etiqueta: "Bajo", rango: "hasta 3" },
  { nivel: "medio", paleta: "orange", etiqueta: "Medio", rango: "3 a 6" },
  { nivel: "alto", paleta: "red", etiqueta: "Alto", rango: "6 a 9" },
];


function etiquetaNivelRiesgo(nivel: CriticidadDashboard["nivel_riesgo"]) {
  return nivel === "alto"
    ? "ALTO"
    : nivel === "medio"
      ? "MEDIO"
      : nivel === "bajo"
        ? "BAJO"
        : "SIN RIESGO";
}

function paletaNivelRiesgo(nivel: CriticidadDashboard["nivel_riesgo"]) {
  return nivel === "alto"
    ? "red"
    : nivel === "medio"
      ? "orange"
      : nivel === "bajo"
        ? "green"
        : "gray";
}

/**
 * Medidor del riesgo general: una barra con los tres niveles (bajo, medio,
 * alto) y un marcador en la posición del puntaje, de 0 a RIESGO_MAXIMO.
 */
function MedidorRiesgo({
  puntaje,
  nivel,
}: {
  puntaje: number;
  nivel: NivelRiesgoGeneral;
}) {
  const hayRiesgo = nivel !== "sin_riesgo";
  const paleta = paletaNivelRiesgo(nivel);
  const posicion = Math.min(100, Math.max(0, (puntaje / RIESGO_MAXIMO) * 100));

  return (
    <Box
      role="img"
      aria-label={
        hayRiesgo
          ? `Riesgo ${formatoPuntaje(puntaje)} de ${RIESGO_MAXIMO}, nivel ${etiquetaNivelRiesgo(nivel).toLowerCase()}`
          : "Sin riesgo"
      }
    >
      <Box position="relative" pt="8">
        {hayRiesgo && (
          <Text
            position="absolute"
            top="0"
            left={`clamp(22px, ${posicion}%, calc(100% - 22px))`}
            transform="translateX(-50%)"
            px="2.5"
            py="0.5"
            rounded="md"
            bg={`${paleta}.solid`}
            color={`${paleta}.contrast`}
            fontSize="sm"
            fontWeight="bold"
            lineHeight="1.4"
            whiteSpace="nowrap"
            aria-hidden
          >
            {formatoPuntaje(puntaje)}
          </Text>
        )}

        <Box position="relative">
          <Flex h="3" gap="0.5" rounded="full" overflow="hidden">
            {TRAMOS_MEDIDOR.map((tramo) => (
              <Box
                key={tramo.nivel}
                flex="1"
                bg={`${tramo.paleta}.solid`}
                opacity={tramo.nivel === nivel ? 1 : 0.28}
              />
            ))}
          </Flex>
          {hayRiesgo && (
            <Box
              position="absolute"
              top="50%"
              left={`${posicion}%`}
              transform="translate(-50%, -50%)"
              w="5"
              h="5"
              rounded="full"
              bg="bg.panel"
              borderWidth="4px"
              borderColor={`${paleta}.solid`}
              boxShadow="sm"
              aria-hidden
            />
          )}
        </Box>
      </Box>

      <Flex mt="2" aria-hidden>
        {TRAMOS_MEDIDOR.map((tramo) => (
          <Box key={tramo.nivel} flex="1" textAlign="center">
            <Text
              fontSize="xs"
              fontWeight={tramo.nivel === nivel ? "bold" : "medium"}
              color={tramo.nivel === nivel ? `${tramo.paleta}.fg` : "fg.muted"}
            >
              {tramo.etiqueta}
            </Text>
            <Text fontSize="xs" color="fg.subtle">
              {tramo.rango}
            </Text>
          </Box>
        ))}
      </Flex>
    </Box>
  );
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

/**
 * Plan de acción de una alerta: el enlace al plan activo, o el botón para
 * crear uno (en rojo, "Plan obligatorio", cuando la situación lo exige: por su
 * tipo o porque su elemento está en riesgo alto). Frena el clic para no
 * disparar la acción de la fila.
 */
function CeldaPlan({
  planId,
  motivo,
  elegible,
  onVerPlan,
  onCrearPlan,
}: {
  planId: number | null;
  motivo: MotivoPlan | null;
  elegible: boolean;
  onVerPlan: (id: number) => void;
  onCrearPlan: () => void;
}) {
  if (planId === null && !elegible) {
    return (
      <Text as="span" fontSize="sm" color="fg.subtle">
        —
      </Text>
    );
  }
  return (
    <Box onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {planId !== null ? (
        <Button size="xs" variant="outline" colorPalette="brand" onClick={() => onVerPlan(planId)}>
          <LuClipboardCheck aria-hidden />
          Plan #{planId}
        </Button>
      ) : (
        <Button
          size="xs"
          variant={motivo ? "solid" : "outline"}
          colorPalette={motivo ? "red" : "neutral"}
          onClick={onCrearPlan}
          title={motivo ? TEXTO_MOTIVO_PLAN[motivo] : undefined}
        >
          <LuClipboardCheck aria-hidden />
          {motivo ? "Plan obligatorio" : "Crear plan"}
        </Button>
      )}
    </Box>
  );
}

export function NotificacionesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const esAdmin = puedeAdministrar(user);
  const puedeTratar = puedeOperar(user);
  const { disponiblesPorClave, planPorClave } = usePlanesDeAlertas(puedeTratar);
  const delayed = useSafeTimeout();

  const [datos, setDatos] = useState<CriticidadDashboard>({
    nivel_riesgo: "sin_riesgo",
    puntaje_maximo: 0,
    total: 0,
    altas: 0,
    medias: 0,
    bajas: 0,
    alertas: [],
    elementos: [],
    nivel_riesgo_tratado: "sin_riesgo",
    puntaje_maximo_tratado: 0,
    altas_tratadas: 0,
    medias_tratadas: 0,
    bajas_tratadas: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [alertaEditando, setAlertaEditando] = useState<AlertaCriticidad | null>(null);

  const [criticidadesSeleccionadas, setCriticidadesSeleccionadas] = useState<Criticidad[]>([]);
  const [filtroOrigen, setFiltroOrigen] = useState<FiltroOrigen>("todas");
  const [filtroLectura, setFiltroLectura] = useState<FiltroLectura>("todas");
  // Solo las que exigen un plan de acción y todavía no lo tienen.
  const [soloPlanObligatorio, setSoloPlanObligatorio] = useState(false);
  // Celda de la matriz de riesgo del Inicio (`?impacto=3&probabilidad=2`):
  // vive en la URL, así el enlace se puede compartir y "atrás" vuelve.
  const [parametros, setParametros] = useSearchParams();
  const celda = useMemo(() => celdaDeParametros(parametros), [parametros]);
  const quitarCelda = () => {
    setParametros(
      (previos) => {
        const nuevos = new URLSearchParams(previos);
        nuevos.delete("impacto");
        nuevos.delete("probabilidad");
        return nuevos;
      },
      { replace: true },
    );
    setPage(1);
  };
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

  const alternarLectura = async (alerta: AlertaCriticidad) => {
    const nuevoEstado = !alerta.leida;
    try {
      await cambiarLecturaNotificacion(alerta.clave, nuevoEstado);
      setDatos((prev) => ({
        ...prev,
        alertas: prev.alertas.map((a) =>
          a.clave === alerta.clave ? { ...a, leida: nuevoEstado } : a
        ),
      }));
      notificarCambioNotificaciones();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo actualizar el estado de lectura"
      );
    }
  };

  const handleMarcarTodasLeidas = async () => {
    try {
      await marcarTodasNotificacionesLeidas();
      setDatos((prev) => ({
        ...prev,
        alertas: prev.alertas.map((a) => ({ ...a, leida: true })),
      }));
      notificarCambioNotificaciones();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudieron marcar todas las notificaciones como leídas"
      );
    }
  };

  const handleResolver = async (alerta: AlertaCriticidad) => {
    if (!alerta.leida) {
      void cambiarLecturaNotificacion(alerta.clave, true)
        .then(() => {
          setDatos((prev) => ({
            ...prev,
            alertas: prev.alertas.map((a) =>
              a.clave === alerta.clave ? { ...a, leida: true } : a
            ),
          }));
          notificarCambioNotificaciones();
        })
        .catch(() => {});
    }

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
        coincideConCriticidad(alerta, criticidadesSeleccionadas),
      );
    }

    if (filtroOrigen !== "todas") {
      resultado = resultado.filter((alerta) => alerta.origen === filtroOrigen);
    }

    if (filtroLectura === "no_leidas") {
      resultado = resultado.filter((alerta) => !alerta.leida);
    } else if (filtroLectura === "leidas") {
      resultado = resultado.filter((alerta) => Boolean(alerta.leida));
    }

    if (soloPlanObligatorio) {
      resultado = resultado.filter((alerta) => Boolean(alerta.motivo_plan));
    }

    if (celda) {
      resultado = resultado.filter((alerta) => alertaEnCelda(alerta, celda));
    }

    if (sortColumn === "criticidad") {
      resultado.sort((a, b) => {
        // "asc": primero lo más riesgoso, igual que el orden por defecto.
        const diferencia = b.puntaje - a.puntaje;
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
  }, [datos.alertas, criticidadesSeleccionadas, filtroOrigen, filtroLectura, soloPlanObligatorio, celda, busqueda, sortColumn, sortDirection]);

  const contadores = useMemo(() => {
    // Los contadores de origen siempre representan el conjunto que se está
    // visualizando, incluyendo los filtros de criticidad, búsqueda y origen.
    // De esta forma, si se selecciona "Baja", "Elementos" muestra solamente
    // cuántas situaciones BAJAS provienen de elementos de limpieza.
    let base = [...datos.alertas];

    if (criticidadesSeleccionadas.length > 0) {
      base = base.filter((alerta) =>
        coincideConCriticidad(alerta, criticidadesSeleccionadas),
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

    // La celda de la matriz y "solo las que exigen plan" también acotan lo
    // que se ve: los números de los desplegables tienen que coincidir.
    if (celda) {
      base = base.filter((alerta) => alertaEnCelda(alerta, celda));
    }
    if (soloPlanObligatorio) {
      base = base.filter((alerta) => Boolean(alerta.motivo_plan));
    }

    // OJO: aca NO se aplica filtroOrigen. Estos contadores son los del propio
    // dropdown de origen; filtrando por origen quedaban en 0 todas las demas
    // opciones al elegir una.

    return {
      todas: base.length,
      no_leidas: base.filter((a) => !a.leida).length,
      leidas: base.filter((a) => Boolean(a.leida)).length,
      elementos: base.filter((a) => a.origen === "ELEMENTO_LIMPIEZA").length,
      personal: base.filter((a) => a.origen === "VENCIMIENTO_PERSONAL").length,
      calibracion: base.filter((a) => a.origen === "PLAN_CALIBRACION").length,
      mantenimiento: base.filter((a) => a.origen === "PLAN_MANTENIMIENTO").length,
      homologaciones: base.filter((a) => a.origen === "HOMOLOGACION_INSUMO").length,
      documentos: base.filter((a) => a.origen === "DOCUMENTO").length,
      checklists: base.filter((a) => a.origen === "CHECKLIST").length,
      incidentes: base.filter((a) => a.origen === "INCIDENTE").length,
    };
  }, [datos.alertas, criticidadesSeleccionadas, busqueda, celda, soloPlanObligatorio]);

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
    setFiltroLectura("todas");
    setBusqueda("");
    setPage(1);
  };

  const limpiarTodo = () => {
    mostrarTodasLasSituaciones();
    if (celda) quitarCelda();
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
      clave: "celda",
      etiqueta: "Matriz de riesgo",
      valor: celda
        ? `impacto ${ETIQUETA_IMPACTO[celda.impacto].toLowerCase()} × probabilidad ${ETIQUETA_PROBABILIDAD[celda.probabilidad].toLowerCase()}`
        : "",
      onQuitar: quitarCelda,
    },
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
      clave: "lectura",
      etiqueta: "Estado",
      valor:
        filtroLectura === "no_leidas"
          ? "No leídas"
          : filtroLectura === "leidas"
            ? "Leídas"
            : "",
      onQuitar: () => {
        setFiltroLectura("todas");
        setPage(1);
      },
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

  // El nivel que se destaca es el TRATADO (sin lo que un plan verificado tiene
  // bajo control). El real nunca se modifica: se muestra al lado para comparar.
  const enTratamiento = datos.elementos.some((e) => e.en_tratamiento);
  const nivel = datos.nivel_riesgo_tratado;
  const nivelTexto = etiquetaNivelRiesgo(nivel);
  const nivelPaleta = paletaNivelRiesgo(nivel);
  const esCelular = useEsCelular();
  const elementoMasRiesgoso = datos.elementos[0] ?? null;
  const IconoNivel = ICONO_NIVEL[nivel];
  const RESUMEN_CRITICIDAD: { criticidad: Criticidad; etiqueta: string; cantidad: number }[] = [
    { criticidad: "alta", etiqueta: "Alta", cantidad: datos.altas },
    { criticidad: "media", etiqueta: "Media", cantidad: datos.medias },
    { criticidad: "baja", etiqueta: "Baja", cantidad: datos.bajas },
  ];
  // Elemento que define el riesgo tratado (puede ser otro que el del real).
  const elementoTratado =
    [...datos.elementos].sort((a, b) => b.puntaje_tratado - a.puntaje_tratado)[0] ?? null;

  const filtros = (
    <>
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
            <option value="HOMOLOGACION_INSUMO">Homologaciones ({contadores.homologaciones})</option>
            <option value="DOCUMENTO">Documentos ({contadores.documentos})</option>
            <option value="CHECKLIST">Checklists ({contadores.checklists})</option>
            <option value="INCIDENTE">Incidentes ({contadores.incidentes})</option>
          </FormNativeSelect>
        </Field.Root>
      </Box>

      <Box minW="180px">
        <Field.Root>
          <LabelFiltro>Estado de lectura</LabelFiltro>
          <FormNativeSelect
            value={filtroLectura}
            onChange={(e) => {
              setFiltroLectura(e.target.value as FiltroLectura);
              setPage(1);
            }}
          >
            <option value="todas">Todas ({contadores.todas})</option>
            <option value="no_leidas">No leídas ({contadores.no_leidas})</option>
            <option value="leidas">Leídas ({contadores.leidas})</option>
          </FormNativeSelect>
        </Field.Root>
      </Box>
    </>
  );

  const campoBusqueda = (
    <Box minW={{ base: "0", md: "250px" }} flex="1">
      <Field.Root>
        <Box hideBelow="md">
          <LabelFiltro>Búsqueda</LabelFiltro>
        </Box>
        <FormInput
          type="search"
          aria-label="Buscar en las notificaciones"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar situación, elemento o motivo..."
        />
      </Field.Root>
    </Box>
  );

  const herramientas = (
    <>
      <Button
        size="sm"
        variant="outline"
        colorPalette="brand"
        disabled={!datos.alertas.some((a) => !a.leida)}
        onClick={handleMarcarTodasLeidas}
        title="Marcar todas las alertas activas como leídas"
      >
        <LuCheckCheck aria-hidden size={16} />
        Marcar todas como leídas
      </Button>

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
    </>
  );

  return (
    <Pagina
      titulo={
        <HStack gap="2" flexWrap="wrap" rowGap="2">
          <LuBell aria-hidden />
          Centro de notificaciones
        </HStack>
      }
      descripcion="Situaciones de inocuidad detectadas y priorizadas automáticamente según su riesgo (impacto × probabilidad)."
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

      {/* Plan de acción obligatorio: lo que todavía no tiene plan. */}
      {(datos.planes_requeridos ?? 0) > 0 && (
        <Flex
          role="status"
          mb="4"
          p="3"
          gap="3"
          align={{ base: "flex-start", md: "center" }}
          direction={{ base: "column", md: "row" }}
          borderWidth="1px"
          borderColor="red.muted"
          bg="red.subtle"
          borderRadius="lg"
        >
          <HStack gap="2" flex="1" align="flex-start">
            <Box color="red.fg" mt="0.5" aria-hidden>
              <LuClipboardCheck size={18} />
            </Box>
            <Text fontSize="sm" color="fg">
              <Text as="span" fontWeight="semibold">
                {datos.planes_requeridos === 1
                  ? "1 situación exige un plan de acción"
                  : `${datos.planes_requeridos} situaciones exigen un plan de acción`}
              </Text>{" "}
              y todavía no lo tienen
              {(datos.elementos_alto_sin_plan ?? 0) > 0 &&
                ` (${datos.elementos_alto_sin_plan} ${
                  datos.elementos_alto_sin_plan === 1 ? "elemento" : "elementos"
                } en riesgo alto)`}
              . Los incidentes que lo exigen no se pueden cerrar sin plan.
            </Text>
          </HStack>
          <Button
            size="sm"
            variant={soloPlanObligatorio ? "solid" : "outline"}
            colorPalette="red"
            onClick={() => {
              setSoloPlanObligatorio((v) => !v);
              setPage(1);
            }}
          >
            {soloPlanObligatorio ? "Ver todas" : "Ver solo esas"}
          </Button>
        </Flex>
      )}

      {/* Banner del nivel de riesgo general: el color sigue al nivel (el
          tratado: descuenta lo que un plan verificado ya controla). */}
      <Box
        role="region"
        aria-label={`Nivel de riesgo general: ${nivelTexto}`}
        position="relative"
        overflow="hidden"
        mb="6"
        rounded="xl"
        borderWidth="1px"
        borderColor={`${nivelPaleta}.border`}
        bg={`${nivelPaleta}.subtle`}
        px={{ base: "4", md: "8" }}
        py={{ base: "4", md: "6" }}
      >
        <Box aria-hidden position="absolute" top="0" bottom="0" left="0" w="2" bg={`${nivelPaleta}.solid`} />

        <Flex
          direction={{ base: "column", lg: "row" }}
          align={{ base: "stretch", lg: "center" }}
          gap={{ base: "4", lg: "10" }}
        >
          {/* Nivel. */}
          <HStack gap={{ base: "3", md: "4" }} flex="1.1" minW="0" align="center">
            <Flex
              flexShrink={0}
              align="center"
              justify="center"
              w={{ base: "12", md: "16" }}
              h={{ base: "12", md: "16" }}
              rounded="full"
              bg={`${nivelPaleta}.solid`}
              color={`${nivelPaleta}.contrast`}
              aria-hidden
            >
              <IconoNivel size={esCelular ? 24 : 30} />
            </Flex>
            <Box minW="0">
              <Text
                fontSize="xs"
                fontWeight="bold"
                letterSpacing="wider"
                textTransform="uppercase"
                color="fg.muted"
              >
                Nivel de riesgo general
              </Text>
              <Text
                fontSize={{ base: "3xl", md: "5xl" }}
                lineHeight="1"
                fontWeight="extrabold"
                letterSpacing="tight"
                color={`${nivelPaleta}.fg`}
              >
                {nivelTexto}
              </Text>
              <Text mt="1.5" fontSize="sm" fontWeight="medium" color={`${nivelPaleta}.fg`}>
                {MENSAJE_NIVEL[nivel]}
              </Text>
              {enTratamiento && (
                <Box mt="2">
                  <Badge colorPalette="blue" variant="subtle" px="2" py="1" borderRadius="md">
                    En tratamiento
                  </Badge>
                  <Text fontSize="xs" color="fg.muted" mt="1">
                    Riesgo real (sin descontar planes):{" "}
                    <Text
                      as="span"
                      fontWeight="bold"
                      color={`${paletaNivelRiesgo(datos.nivel_riesgo)}.fg`}
                    >
                      {etiquetaNivelRiesgo(datos.nivel_riesgo)} · {formatoPuntaje(datos.puntaje_maximo)}
                    </Text>
                  </Text>
                </Box>
              )}
            </Box>
          </HStack>

          {/* Medidor y elemento en peor situación. */}
          <Box flex="1.4" minW="0">
            <MedidorRiesgo puntaje={datos.puntaje_maximo_tratado} nivel={nivel} />
            <Text mt="3" fontSize="sm" color="fg" lineClamp={{ base: 2, md: "none" }}>
              {elementoMasRiesgoso && elementoTratado
                ? datos.puntaje_maximo_tratado > 0
                  ? `${formatoPuntaje(datos.puntaje_maximo_tratado)} de ${RIESGO_MAXIMO} · ${elementoTratado.etiqueta}`
                  : "Todo el riesgo está bajo control de un plan"
                : "No hay situaciones presentes"}
            </Text>
            {elementoMasRiesgoso && (
              <Text fontSize="xs" color="fg.muted" mt="0.5" hideBelow="md">
                Es el riesgo del elemento en peor situación.
              </Text>
            )}
          </Box>

          {/* Situaciones por criticidad: filtros acumulables. "Ver todas"
              limpia los filtros. */}
          <Box flexShrink={0}>
            <Text
              fontSize="xs"
              fontWeight="bold"
              letterSpacing="wider"
              textTransform="uppercase"
              color="fg.muted"
              mb="2"
            >
              {alertasFiltradas.length} {alertasFiltradas.length === 1 ? "situación" : "situaciones"}
            </Text>
            <HStack gap="2" align="stretch">
              {RESUMEN_CRITICIDAD.map(({ criticidad, etiqueta, cantidad }) => {
                const activa = criticidadesSeleccionadas.includes(criticidad);
                const paleta = PALETA_CRITICIDAD[criticidad];
                return (
                  <chakra.button
                    key={criticidad}
                    type="button"
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    gap="0"
                    flex={{ base: "1", lg: "none" }}
                    minW={{ base: "0", lg: "76px" }}
                    px="3"
                    py="2"
                    rounded="lg"
                    cursor="pointer"
                    bg={activa ? `${paleta}.solid` : "bg.panel"}
                    color={activa ? `${paleta}.contrast` : "fg"}
                    borderWidth="1px"
                    borderColor={`${paleta}.border`}
                    _hover={{ borderColor: `${paleta}.solid` }}
                    onClick={() => alternarCriticidad(criticidad)}
                    aria-pressed={activa}
                    title={`Filtrar situaciones de criticidad ${etiqueta.toLowerCase()}`}
                  >
                    <Text
                      fontSize="2xl"
                      lineHeight="1.1"
                      fontWeight="bold"
                      color={activa ? `${paleta}.contrast` : `${paleta}.fg`}
                    >
                      {cantidad}
                    </Text>
                    <Text fontSize="xs" color={activa ? `${paleta}.contrast` : "fg.muted"}>
                      {etiqueta}
                    </Text>
                  </chakra.button>
                );
              })}
            </HStack>
            <Button
              mt="2"
              size="xs"
              variant="ghost"
              w="full"
              onClick={mostrarTodasLasSituaciones}
              aria-label="Mostrar todas las situaciones y limpiar los filtros"
              title="Mostrar todas las situaciones"
            >
              Ver todas
            </Button>
          </Box>
        </Flex>
      </Box>

      {/* Filtros de la gestión de riesgos. */}
      {esCelular ? (
        <BarraFiltros
          busqueda={campoBusqueda}
          filtros={filtros}
          herramientas={herramientas}
          activos={(filtroOrigen !== "todas" ? 1 : 0) + (filtroLectura !== "todas" ? 1 : 0)}
        />
      ) : (
        <Tarjeta p="4" mb="6">
          <HStack gap="4" flexWrap="wrap" align="flex-end">
            {filtros}
            {campoBusqueda}
            {herramientas}
          </HStack>
        </Tarjeta>
      )}

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
            <Table.Root variant="outline" size="md" w="100%" minW="1200px">
              <Table.Header>
                <FilaEncabezado>
                  <EncabezadoOscuro width="12%" onClick={() => handleSort("criticidad")}>
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
                  <EncabezadoOscuro ancho="media">Situación</EncabezadoOscuro>
                  <EncabezadoOscuro ancho="media" onClick={() => handleSort("plazo")}>
                    <Box display="flex" alignItems="center" gap="1" cursor="pointer" userSelect="none">
                      Plazo
                      <SortIcon column="plazo" sortColumn={sortColumn} sortDirection={sortDirection} />
                    </Box>
                  </EncabezadoOscuro>
                  <EncabezadoOscuro>Motivo</EncabezadoOscuro>
                  {puedeTratar ? <EncabezadoOscuro ancho="media">Plan de acción</EncabezadoOscuro> : null}
                  <EncabezadoOscuro width="50px" textAlign="center">
                    <Box as="span" srOnly>Acción</Box>
                  </EncabezadoOscuro>
                </FilaEncabezado>
              </Table.Header>

              <Table.Body>
                {alertasPaginadas.map((alerta) => {
                  const accionable =
                    alerta.origen === "ELEMENTO_LIMPIEZA" ||
                    alerta.origen === "VENCIMIENTO_PERSONAL" ||
                    Boolean(alerta.destino);
                  const noLeida = !alerta.leida;

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
                        bg: accionable ? "brand.50" : undefined,
                        cursor: accionable ? "pointer" : "default",
                      }}
                      transition="background 0.2s"
                      cursor={accionable ? "pointer" : "default"}
                      opacity={alerta.leida ? 0.75 : 1}
                    >
                      <Celda>
                        <Badge
                          colorPalette={
                            alerta.puntaje > 0 ? PALETA_CRITICIDAD[alerta.criticidad] : "gray"
                          }
                          variant="subtle"
                          px="2"
                          py="1"
                          borderRadius="md"
                          fontWeight="bold"
                        >
                          {alerta.puntaje > 0
                            ? `${etiquetaCriticidad(alerta.criticidad)} · ${formatoPuntaje(alerta.puntaje)}`
                            : "SIN RIESGO"}
                        </Badge>
                        {alerta.puntaje > 0 && (
                          <Text
                            fontSize="xs"
                            color="fg.muted"
                            mt="1"
                            lineHeight="1.35"
                            title={`Impacto ${alerta.impacto} de 3 × probabilidad ${formatoPuntaje(alerta.probabilidad)} de 3 = ${formatoPuntaje(alerta.puntaje)}`}
                          >
                            Impacto{" "}
                            <Text as="span" fontWeight="semibold" color="fg">
                              {ETIQUETA_IMPACTO[escalaDeImpacto(alerta.impacto)].toLowerCase()}
                            </Text>
                            <br />
                            Probabilidad{" "}
                            <Text as="span" fontWeight="semibold" color="fg">
                              {ETIQUETA_PROBABILIDAD[columnaDeProbabilidad(alerta.probabilidad)].toLowerCase()}
                            </Text>{" "}
                            ({formatoPuntaje(alerta.probabilidad)})
                          </Text>
                        )}
                        {alerta.plan_tratamiento_id !== null && (
                          <Text
                            fontSize="xs"
                            color="blue.fg"
                            fontWeight="medium"
                            mt="1"
                            title="Un plan de acción verificado tiene esta situación bajo control: el riesgo real se conserva, pero no suma al riesgo tratado."
                          >
                            Controlado · Plan #{alerta.plan_tratamiento_id}
                          </Text>
                        )}
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
                        <HStack gap="2" align="center" mb="1">
                          {noLeida && (
                            <Box
                              w="2"
                              h="2"
                              rounded="full"
                              bg="brand.600"
                              flexShrink={0}
                              title="No leída"
                            />
                          )}
                          <TextoTruncado fontWeight={noLeida ? "bold" : "semibold"} color="fg" texto={alerta.titulo} />
                        </HStack>
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
                        {alerta.puntaje_elemento !== alerta.puntaje && (
                          <Text
                            fontSize="xs"
                            color={`${paletaNivelRiesgo(nivelDePuntaje(alerta.puntaje_elemento_tratado))}.fg`}
                            mt="1"
                            fontWeight="medium"
                          >
                            Riesgo del elemento: {formatoPuntaje(alerta.puntaje_elemento_tratado)}
                            {alerta.puntaje_elemento_tratado !== alerta.puntaje_elemento &&
                              ` (real ${formatoPuntaje(alerta.puntaje_elemento)}, en tratamiento)`}
                          </Text>
                        )}
                      </Celda>

                      {puedeTratar ? (
                        <Celda>
                          <CeldaPlan
                            planId={
                              planPorClave.get(alerta.clave)?.plan_id ?? alerta.plan_activo_id ?? null
                            }
                            motivo={alerta.motivo_plan ?? null}
                            elegible={disponiblesPorClave.has(alerta.clave)}
                            onVerPlan={(id) => navigate(`/planes-accion/${id}`)}
                            onCrearPlan={() =>
                              navigate(`/planes-accion/nuevo?situacion=${encodeURIComponent(alerta.clave)}`)
                            }
                          />
                        </Celda>
                      ) : null}

                      <Celda textAlign="center" onClick={(e) => e.stopPropagation()}>
                        <Tooltip
                          content={noLeida ? "Marcar como leída" : "Marcar como no leída"}
                          showArrow
                        >
                          <IconButton
                            size={{ base: "md", md: "xs" }}
                            variant="ghost"
                            borderWidth={{ base: "1px", md: "0" }}
                            borderColor="border"
                            w={{ base: "auto", md: undefined }}
                            px={{ base: "3", md: "0" }}
                            gap="1.5"
                            fontSize="sm"
                            colorPalette={noLeida ? "brand" : "gray"}
                            aria-label={noLeida ? "Marcar como leída" : "Marcar como no leída"}
                            onClick={() => void alternarLectura(alerta)}
                          >
                            {noLeida ? <LuCheck size={15} /> : <LuCircleDot size={15} />}
                            <Box as="span" hideFrom="md">
                              {noLeida ? "Marcar como leída" : "Marcar como no leída"}
                            </Box>
                          </IconButton>
                        </Tooltip>
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
