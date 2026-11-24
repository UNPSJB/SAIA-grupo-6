import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../common/context/useAuth";
import { puedeAdministrar } from "../../../common/api/permissions";
import { useEstadoNavegacion } from "../../../common/hooks/useEstadoNavegacion";
import { haceDiasISO, hoyISO, inicioMesISO } from "../../../common/utils/fechas";
import { ETIQUETA_PERIODO } from "../types/incidente";
import type { EstadoIncidente, PeriodoRapido } from "../types/incidente";

/** `YYYY-MM-DD` válido o `null`: lo que llega por la URL no se da por bueno. */
function fechaDeUrl(valor: string | null): string | null {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
}

/**
 * Estado y período de Gestión de incidentes. Los comparten el gráfico por tipo
 * y las tablas de todas las pestañas: el número de una barra es la cantidad de
 * filas que se ven al abrirla.
 */
export function useFiltrosGestion() {
  const [searchParams] = useSearchParams();

  // El panel de Personas llega con la persona y su período: cuenta todos sus
  // reportes, abiertos y cerrados. El período es solo el valor inicial.
  const vieneDePersonas = searchParams.has("reportado_por");
  const desdeUrl = fechaDeUrl(searchParams.get("desde"));
  const hastaUrl = fechaDeUrl(searchParams.get("hasta"));

  // HU "Ver incidentes abiertos": por defecto, solo lo que falta resolver. Quien
  // opera no ve el gráfico y abre, como siempre, con todo.
  const esAdmin = puedeAdministrar(useAuth().user);
  const [estado, setEstado] = useEstadoNavegacion<EstadoIncidente | "">(
    "IncidentesListPage.filtroEstado",
    esAdmin && !vieneDePersonas ? "abierto" : ""
  );

  const [periodo, setPeriodo] = useEstadoNavegacion<PeriodoRapido>(
    "IncidentesListPage.periodo",
    desdeUrl !== null && hastaUrl !== null ? "personalizado" : "todo"
  );
  const [fechaDesde, setFechaDesde] = useEstadoNavegacion(
    "IncidentesListPage.fechaDesde",
    desdeUrl ?? haceDiasISO(30)
  );
  const [fechaHasta, setFechaHasta] = useEstadoNavegacion(
    "IncidentesListPage.fechaHasta",
    hastaUrl ?? hoyISO()
  );

  // Al elegir un período rápido se recalculan las fechas; "personalizado"
  // arranca con los últimos 30 días para que se ajuste solo lo necesario.
  const elegirPeriodo = (nuevo: PeriodoRapido) => {
    setPeriodo(nuevo);
    if (nuevo === "todo") return;
    setFechaDesde(
      nuevo === "7d" ? haceDiasISO(7) : nuevo === "mes" ? inicioMesISO() : haceDiasISO(30)
    );
    setFechaHasta(hoyISO());
  };

  // "Todo" no acota: sin fechas se cuenta el histórico.
  const desde = periodo === "todo" ? undefined : fechaDesde;
  const hasta = periodo === "todo" ? undefined : fechaHasta;

  const enPeriodo = useCallback(
    (fecha: string | null) =>
      desde === undefined ||
      hasta === undefined ||
      (fecha !== null && fecha.slice(0, 10) >= desde && fecha.slice(0, 10) <= hasta),
    [desde, hasta]
  );

  return {
    estado,
    setEstado,
    periodo,
    elegirPeriodo,
    fechaDesde,
    setFechaDesde,
    fechaHasta,
    setFechaHasta,
    /** Fechas a aplicar; `undefined` si el período es "todo". */
    desde,
    hasta,
    /** Si una fecha (`YYYY-MM-DD`) cae en el período. */
    enPeriodo,
    hayFiltros: estado !== "" || periodo !== "todo",
    /** Deja a la vista todo: abiertos y cerrados, de cualquier fecha. */
    limpiar: () => {
      setEstado("");
      setPeriodo("todo");
    },
    /** Chip del período, igual en todas las pestañas. */
    chipPeriodo: {
      clave: "periodo",
      etiqueta: "Período",
      valor: ETIQUETA_PERIODO[periodo],
      // "Todo" es el período de apertura: no es un filtro aplicado.
      visible: periodo !== "todo",
      onQuitar: () => setPeriodo("todo"),
    },
  };
}

export type FiltrosGestion = ReturnType<typeof useFiltrosGestion>;
