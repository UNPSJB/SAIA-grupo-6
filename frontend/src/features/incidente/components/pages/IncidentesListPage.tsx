import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { IncidenteTable } from "../IncidenteTable";
import { IncidentesPorTipoPanel } from "../IncidentesPorTipoPanel";
import { CerrarIncidenteDialog } from "../CerrarIncidenteDialog";
import { ReabrirIncidenteDialog } from "../ReabrirIncidenteDialog";
import { useIncidentes } from "../../hooks/useIncidentes";
import { useIncidenteABM } from "../../hooks/useIncidenteABM";
import { useAvisoTemporal } from "../../../../common/hooks/useDelayedNavigate";
import { useOrdenTabla } from "../../../../common/hooks/useOrdenTabla";
import {
  ESTADOS_INCIDENTE,
  TIPOS_INCIDENTE,
  ETIQUETA_PERIODO,
  estadoLabel,
} from "../../types/incidente";
import type {
  EstadoIncidente,
  Incidente,
  PeriodoRapido,
  TipoIncidente,
} from "../../types/incidente";
import type { ColumnaOrdenIncidente } from "../../services/incidenteService";
import {
  escucharCambioIncidentes,
  notificarCambioIncidentes,
} from "../../eventoIncidentes";
import { haceDiasISO, hoyISO, inicioMesISO } from "../../../../common/utils/fechas";
import {
  BarraFiltros,
  CampoBusqueda,
  ChipsFiltros,
  EstadoVacioFiltrado,
  FiltroSelect,
  chipsDeFiltros,
} from "../../../../components/ui/filtros";
import {
  BannerError,
  BannerExito,
  BotonAgregar,
  EstadoCargando,
  Paginacion,
} from "../../../../components/ui/patrones";
import { Pagina } from "../../../../components/ui/plantillas";
import { BotonExportar } from "../../../../features/exportacion";
import { useEstadoNavegacion } from "../../../../common/hooks/useEstadoNavegacion";

const PAGE_SIZE = 10;

/** `YYYY-MM-DD` válido o `null`: lo que llega por la URL no se da por bueno. */
function fechaDeUrl(valor: string | null): string | null {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
}

const ETIQUETAS_ORDEN: Record<ColumnaOrdenIncidente, string> = {
  fecha: "Fecha",
  tipo: "Tipo",
  estado: "Estado",
};

export function IncidentesListPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Filtro por quien reportó, desde la URL (`?reportado_por=12`): lo usa el
  // panel de Personas al hacer clic en una barra. Llega con el período del
  // panel (`desde`/`hasta`), que solo se toma como valor inicial: después el
  // período se cambia acá, como siempre.
  const [searchParams, setSearchParams] = useSearchParams();
  const idReportado = Number(searchParams.get("reportado_por"));
  const reportadoPor = Number.isInteger(idReportado) && idReportado > 0 ? idReportado : null;
  const desdeUrl = fechaDeUrl(searchParams.get("desde"));
  const hastaUrl = fechaDeUrl(searchParams.get("hasta"));
  const periodoUrl = desdeUrl !== null && hastaUrl !== null;

  // HU "Ver incidentes abiertos": por defecto se listan solo los que todavía
  // no tienen una acción correctiva registrada (estado abierto). Desde el
  // panel de Personas se cuentan todos los reportes, así que van todos.
  const [filtroEstado, setFiltroEstado] = useEstadoNavegacion<EstadoIncidente | "">(
    "IncidentesListPage.filtroEstado",
    reportadoPor !== null ? "" : "abierto"
  );
  const [filtroTipo, setFiltroTipo] = useState<TipoIncidente | "">("");
  const [busqueda, setBusqueda] = useEstadoNavegacion("IncidentesListPage.busqueda", "");
  const [incluirCerrados, setIncluirCerrados] = useEstadoNavegacion(
    "IncidentesListPage.incluirCerrados",
    reportadoPor !== null
  );

  // Período de la estadística: por defecto "todo", que es el comportamiento
  // original (sin acotar por fecha).
  const [periodo, setPeriodo] = useEstadoNavegacion<PeriodoRapido>(
    "IncidentesListPage.periodo",
    periodoUrl ? "personalizado" : "todo"
  );
  const [fechaDesde, setFechaDesde] = useEstadoNavegacion(
    "IncidentesListPage.fechaDesde",
    desdeUrl ?? haceDiasISO(30)
  );
  const [fechaHasta, setFechaHasta] = useEstadoNavegacion(
    "IncidentesListPage.fechaHasta",
    hastaUrl ?? hoyISO()
  );

  // La tabla abre por fecha ascendente ("antiguos"), igual que antes: el
  // incidente más viejo arriba para resolver primero lo que más espera.
  // `columnaPorDefecto` hace que el header de Fecha ya muestre la flecha.
  const orden = useOrdenTabla<ColumnaOrdenIncidente, "antiguos">(
    "antiguos",
    "fecha"
  );

  // Todos los filtros viajan al backend, que devuelve una página de filas.
  const {
    incidentes,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarIncidentes,
  } = useIncidentes(
    filtroEstado,
    filtroTipo,
    busqueda,
    periodo === "todo" ? undefined : fechaDesde,
    periodo === "todo" ? undefined : fechaHasta,
    PAGE_SIZE,
    orden.orden,
    reportadoPor
  );

  // Nombre para el chip: el que mandó el panel o el de las filas cargadas.
  const nombreReportado =
    (location.state as { reportadoNombre?: string } | null)?.reportadoNombre ??
    incidentes.find((i) => i.usuario_id === reportadoPor)?.usuario_nombre ??
    (reportadoPor !== null ? `Persona #${reportadoPor}` : "");

  /** Saca el filtro de la URL (con el período que trajo, ya aplicado). */
  const quitarReportado = () => {
    const resto = new URLSearchParams(searchParams);
    ["reportado_por", "desde", "hasta"].forEach((clave) => resto.delete(clave));
    setSearchParams(resto, { replace: true });
  };

  // Refresco automático: el alta, el cierre o la reapertura de un incidente
  // avisan por el bus y acá se vuelve a pedir la lista. Así la estadística y
  // la tabla se actualizan aunque el cambio se haya hecho en otra vista.
  useEffect(() => {
    return escucharCambioIncidentes(() => {
      void cargarIncidentes();
    });
  }, [cargarIncidentes]);

  const { cerrar, reabrir, loading: procesando } = useIncidenteABM();

  const [incidenteACerrar, setIncidenteACerrar] = useState<Incidente | null>(null);
  const [incidenteAReabrir, setIncidenteAReabrir] = useState<Incidente | null>(null);
  const { valor: mensajeAviso, avisar } = useAvisoTemporal<string>(3500);

  const handleTipoChange = (nuevo: string) => {
    setFiltroTipo(nuevo as TipoIncidente | "");
  };

  const handleEstadoChange = (nuevo: string) => {
    const nuevoEstado = nuevo as EstadoIncidente | "";
    setFiltroEstado(nuevoEstado);
    // El switch del gráfico y el select de la tabla miran el mismo universo.
    setIncluirCerrados(nuevoEstado === "");
  };

  // Al elegir un chip se recalculan las fechas; "personalizado" arranca con
  // los últimos 30 días para que el usuario solo ajuste lo que necesite.
  // "todo" no toca las fechas: sin ellas el backend cuenta el histórico.
  const handlePeriodoChange = (nuevo: PeriodoRapido) => {
    setPeriodo(nuevo);
    if (nuevo === "7d") {
      setFechaDesde(haceDiasISO(7));
      setFechaHasta(hoyISO());
    } else if (nuevo === "30d") {
      setFechaDesde(haceDiasISO(30));
      setFechaHasta(hoyISO());
    } else if (nuevo === "mes") {
      setFechaDesde(inicioMesISO());
      setFechaHasta(hoyISO());
    } else if (nuevo === "personalizado") {
      setFechaDesde(haceDiasISO(30));
      setFechaHasta(hoyISO());
    }
    setPage(1);
  };

  const limpiarTodo = () => {
    setBusqueda("");
    setFiltroTipo("");
    // "Limpiar todo" vuelve al universo completo: abiertos y cerrados. El
    // estado "abierto" de apertura es un filtro más y también se limpia.
    setFiltroEstado("");
    setIncluirCerrados(true);
    setPeriodo("todo");
    orden.reiniciar();
    if (reportadoPor !== null) quitarReportado();
  };

  // El diálogo no se cierra mientras corre la petición: cerrarlo a mitad de
  // camino ocultaría el aviso de que la operación sigue en curso.
  const handleCerrarDialogClose = () => {
    if (!procesando) setIncidenteACerrar(null);
  };

  const handleReabrirDialogClose = () => {
    if (!procesando) setIncidenteAReabrir(null);
  };

  const handleCerrar = async (observacion: string) => {
    if (!incidenteACerrar) return;
    const id = incidenteACerrar.id;
    try {
      await cerrar(id, observacion);
      setIncidenteACerrar(null);
      // El bus hace que la suscripción de arriba vuelva a pedir la lista:
      // así la estadística y la tabla se actualizan sin recargar la página.
      notificarCambioIncidentes();
      avisar(`Incidente #${id} cerrado. La resolución quedó registrada.`);
    } catch {
      // El mensaje de error ya quedó en el hook.
    }
  };

  const handleReabrir = async (motivo: string) => {
    if (!incidenteAReabrir) return;
    const id = incidenteAReabrir.id;
    try {
      await reabrir(id, motivo);
      setIncidenteAReabrir(null);
      notificarCambioIncidentes();
      avisar(`Incidente #${id} reabierto. El motivo quedó registrado en el historial.`);
    } catch {
      // El mensaje de error ya quedó en el hook.
    }
  };

  // El orden no cambia las filas, así que no cuenta para el estado vacío
  // "por filtros": solo búsqueda, tipo, estado y período.
  const hayFiltros =
    filtroEstado !== "" ||
    filtroTipo !== "" ||
    busqueda.trim() !== "" ||
    periodo !== "todo" ||
    reportadoPor !== null;

  const chips = chipsDeFiltros([
    {
      clave: "reportado_por",
      etiqueta: "Reportado por",
      valor: reportadoPor !== null ? nombreReportado : "",
      onQuitar: quitarReportado,
    },
    {
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda,
      recortar: true,
      onQuitar: () => setBusqueda(""),
    },
    {
      clave: "tipo",
      etiqueta: "Tipo",
      valor:
        TIPOS_INCIDENTE.find((tipo) => tipo.value === filtroTipo)?.label ??
        filtroTipo,
      onQuitar: () => setFiltroTipo(""),
    },
    {
      clave: "estado",
      etiqueta: "Estado",
      valor: filtroEstado !== "" ? estadoLabel(filtroEstado) : "",
      onQuitar: () => {
        setFiltroEstado("");
        setIncluirCerrados(true);
      },
    },
    {
      clave: "periodo",
      etiqueta: "Período",
      valor: ETIQUETA_PERIODO[periodo],
      // "Todo" es el período de apertura: no es un filtro aplicado.
      visible: periodo !== "todo",
      onQuitar: () => setPeriodo("todo"),
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
    <Pagina
      titulo="Gestión de incidentes"
      descripcion="Reportes, cierres y reaperturas del laboratorio."
      acciones={
        <BotonAgregar onClick={() => navigate("/incidentes/reportar")}>Registrar incidente</BotonAgregar>
      }
    >
      {/* Indicador E7: incidentes por tipo — conectado al filtro de la tabla */}
      <IncidentesPorTipoPanel
        filtroTipo={filtroTipo}
        onFiltroTipoChange={(tipo) => setFiltroTipo(tipo)}
        incluirCerrados={incluirCerrados}
        onIncluirCerradosChange={(checked) => {
          setIncluirCerrados(checked);
          setFiltroEstado(checked ? "" : "abierto");
        }}
        periodo={periodo}
        onPeriodoChange={handlePeriodoChange}
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        onFechaDesdeChange={(valor) => { setFechaDesde(valor); setPage(1); }}
        onFechaHastaChange={(valor) => { setFechaHasta(valor); setPage(1); }}
      />

      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Buscar por título, descripción o reportado por..."
          />
        }
        filtros={
          <>
            <FiltroSelect
              label="Estado"
              valor={filtroEstado}
              onCambio={handleEstadoChange}
              opciones={ESTADOS_INCIDENTE.map((estado) => ({
                valor: estado.value,
                etiqueta: estado.label,
              }))}
              todos="Todos los estados"
            />
            <FiltroSelect
              label="Tipo"
              valor={filtroTipo}
              onCambio={handleTipoChange}
              opciones={TIPOS_INCIDENTE.map((tipo) => ({
                valor: tipo.value,
                etiqueta: tipo.label,
              }))}
              todos="Todos los tipos"
            />
          </>
        }
        herramientas={
          <BotonExportar
            nombreTabla="incidentes"
            filtros={{ estado: filtroEstado, tipo: filtroTipo }}
          />
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {loading && <EstadoCargando pagina>Cargando incidentes...</EstadoCargando>}
      {!loading && error && <BannerError>{error}</BannerError>}

      {mensajeAviso && <BannerExito>{mensajeAviso}</BannerExito>}

      {!loading && !error && (
        <>
          {hayFiltros && incidentes.length === 0 ? (
            <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
              No hay incidentes que coincidan con los filtros aplicados.
            </EstadoVacioFiltrado>
          ) : (
            <IncidenteTable
              incidentes={incidentes}
              orden={orden}
              onCerrar={setIncidenteACerrar}
              onReabrir={setIncidenteAReabrir}
              onVer={(incidente) => navigate(`/incidentes/${incidente.id}`)}
              showActions={true}
              mensajeVacio="Todavía no se registraron incidentes."
            />
          )}

          {/*
            `Paginacion` espera el total de FILAS como `count`: Chakra calcula
            las páginas con `ceil(count / pageSize)`.
          */}
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

      <CerrarIncidenteDialog
        isOpen={incidenteACerrar !== null}
        incidente={incidenteACerrar}
        isLoading={procesando}
        onClose={handleCerrarDialogClose}
        onConfirm={handleCerrar}
      />

      <ReabrirIncidenteDialog
        isOpen={incidenteAReabrir !== null}
        incidente={incidenteAReabrir}
        isLoading={procesando}
        onClose={handleReabrirDialogClose}
        onConfirm={handleReabrir}
      />
    </Pagina>
  );
}
