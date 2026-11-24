import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { IncidenteTable } from "../IncidenteTable";
import { IncidentesPorTipoPanel } from "../IncidentesPorTipoPanel";
import { CerrarIncidenteDialog } from "../CerrarIncidenteDialog";
import { ReabrirIncidenteDialog } from "../ReabrirIncidenteDialog";
import { useFiltrosGestion, type FiltrosGestion } from "../../hooks/useFiltrosGestion";
import { useIncidentes } from "../../hooks/useIncidentes";
import { useIncidenteABM } from "../../hooks/useIncidenteABM";
import { useAvisoTemporal } from "../../../../common/hooks/useDelayedNavigate";
import { useOrdenTabla } from "../../../../common/hooks/useOrdenTabla";
import {
  ESTADOS_INCIDENTE,
  TIPOS_INCIDENTE,
  esDeCircuito,
  estadoLabel,
  pestanaDeTipo,
  tipoDePestana,
  tiposDeOrigen,
} from "../../types/incidente";
import type {
  EstadoIncidente,
  Incidente,
  OrigenIncidente,
  TipoIncidente,
} from "../../types/incidente";
import type { ColumnaOrdenIncidente } from "../../services/incidenteService";
import {
  escucharCambioIncidentes,
  notificarCambioIncidentes,
} from "../../eventoIncidentes";
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
import { Pagina, PestanasPagina } from "../../../../components/ui/plantillas";
import { BotonExportar } from "../../../../features/exportacion";
import { useAuth } from "../../../../common/context/useAuth";
import { puedeAdministrar } from "../../../../common/api/permissions";
import { TabReclamos } from "../../../reclamos/components/pages/ReclamosPage";
import { TabRetiros } from "../../../retiros/components/pages/RetirosPage";
import { TabRechazos } from "../../../salidas/components/TabRechazos";
import { useEstadoNavegacion } from "../../../../common/hooks/useEstadoNavegacion";

const PAGE_SIZE = 10;

const ETIQUETAS_ORDEN: Record<ColumnaOrdenIncidente, string> = {
  fecha: "Fecha",
  tipo: "Tipo",
  estado: "Estado",
};

interface TabIncidentesProps {
  gestion: FiltrosGestion;
  filtroTipo: TipoIncidente | "";
  onFiltroTipoChange: (tipo: TipoIncidente | "") => void;
}

/** Pestaña "Incidentes": los que reportó una persona. Solo administración. */
function TabIncidentes({
  gestion,
  filtroTipo,
  onFiltroTipoChange: setFiltroTipo,
}: TabIncidentesProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Filtro por quien reportó, desde la URL (`?reportado_por=12`): lo usa el
  // panel de Personas al hacer clic en una barra.
  const [searchParams, setSearchParams] = useSearchParams();
  const idReportado = Number(searchParams.get("reportado_por"));
  const reportadoPor = Number.isInteger(idReportado) && idReportado > 0 ? idReportado : null;

  const { estado: filtroEstado, setEstado: setFiltroEstado, periodo, desde, hasta } = gestion;
  // Solo los reportados por una persona: los reclamos, rechazos y retiros tienen
  // su pestaña. Desde el panel de Personas van todos, para que el total coincida
  // con la barra.
  const origen: OrigenIncidente | "" = reportadoPor !== null ? "" : "reportado";
  const [busqueda, setBusqueda] = useEstadoNavegacion("IncidentesListPage.busqueda", "");
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
    desde,
    hasta,
    PAGE_SIZE,
    orden.orden,
    reportadoPor,
    origen
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

  const { cerrar, reabrir, loading: procesando, error: errorGuardado } = useIncidenteABM();

  const [incidenteACerrar, setIncidenteACerrar] = useState<Incidente | null>(null);
  const [incidenteAReabrir, setIncidenteAReabrir] = useState<Incidente | null>(null);
  const { valor: mensajeAviso, avisar } = useAvisoTemporal<string>(3500);

  const handleTipoChange = (nuevo: string) => {
    setFiltroTipo(nuevo as TipoIncidente | "");
  };

  const handleEstadoChange = (nuevo: string) => {
    setFiltroEstado(nuevo as EstadoIncidente | "");
  };

  const limpiarTodo = () => {
    setBusqueda("");
    setFiltroTipo("");
    // "Limpiar todo" vuelve al universo completo: abiertos y cerrados. El
    // estado "abierto" de apertura es un filtro más y también se limpia.
    gestion.limpiar();
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

  const handleCerrar = async (accionCorrectiva: string) => {
    if (!incidenteACerrar) return;
    const id = incidenteACerrar.id;
    try {
      await cerrar(id, accionCorrectiva);
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
      onQuitar: () => setFiltroEstado(""),
    },
    gestion.chipPeriodo,
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
    <>
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
              opciones={tiposDeOrigen(origen).map((tipo) => ({
                valor: tipo.value,
                etiqueta: tipo.label,
              }))}
              todos="Todos los tipos"
            />
          </>
        }
        herramientas={
          <>
            <BotonAgregar onClick={() => navigate("/incidentes/reportar")}>
              Registrar incidente
            </BotonAgregar>
            <BotonExportar
              nombreTabla="incidentes"
              filtros={{
                estado: filtroEstado,
                tipo: filtroTipo,
                buscar: busqueda,
                fecha_desde: desde,
                fecha_hasta: hasta,
                reportado_por: reportadoPor !== null ? String(reportadoPor) : undefined,
                origen,
                orden: orden.orden,
              }}
            />
          </>
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
        error={errorGuardado}
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
    </>
  );
}

/**
 * Gestión de incidentes: todo lo que salió mal, en un solo lugar. Los reclamos,
 * los rechazos y los retiros eran pantallas aparte; cada uno se sigue
 * resolviendo con sus reglas, ahora en su pestaña. `/reclamos` y `/retiros`
 * redirigen acá.
 *
 * Quien opera entra a consultar y registrar reclamos: no ve los incidentes de
 * los demás (los suyos están en "Reportar incidente").
 */
export function IncidentesListPage() {
  const esAdmin = puedeAdministrar(useAuth().user);
  const gestion = useFiltrosGestion();
  const [filtroTipo, setFiltroTipo] = useState<TipoIncidente | "">("");
  const [searchParams, setSearchParams] = useSearchParams();

  const pestanas = [
    {
      valor: "reclamos",
      etiqueta: "Reclamos de clientes",
      contenido: <TabReclamos gestion={gestion} />,
    },
    {
      valor: "rechazos",
      etiqueta: "Rechazos de entregas",
      contenido: <TabRechazos gestion={gestion} />,
    },
    {
      valor: "retiros",
      etiqueta: "Retiros de lotes",
      contenido: <TabRetiros gestion={gestion} />,
    },
  ];
  if (esAdmin) {
    pestanas.unshift({
      valor: "incidentes",
      etiqueta: "Incidentes",
      contenido: (
        <TabIncidentes
          gestion={gestion}
          filtroTipo={filtroTipo}
          onFiltroTipoChange={setFiltroTipo}
        />
      ),
    });
  }

  const tipoDeLaPestana = tipoDePestana(searchParams.get("tab"));
  const seleccionado = tipoDeLaPestana || filtroTipo;

  // Cada barra lleva a su tabla: los de circuito tienen pestaña propia; el
  // resto se filtra por tipo en "Incidentes". Otro clic lo deshace.
  const handleSeleccionar = (tipo: TipoIncidente) => {
    const quitar = tipo === seleccionado;
    if (!esDeCircuito(tipo)) setFiltroTipo(quitar ? "" : tipo);
    const destino = quitar ? "incidentes" : pestanaDeTipo(tipo);
    setSearchParams(
      (actuales) => {
        const nuevos = new URLSearchParams(actuales);
        nuevos.set("tab", destino);
        return nuevos;
      },
      { replace: true }
    );
  };

  return (
    <Pagina
      titulo="Gestión de incidentes"
      descripcion={`${
        esAdmin ? "Incidentes reportados, reclamos" : "Reclamos"
      } de clientes, rechazos de entregas y retiros de lotes.`}
    >
      {/* El resumen es de administración (el backend lo exige). */}
      {esAdmin && (
        <IncidentesPorTipoPanel
          gestion={gestion}
          seleccionado={seleccionado}
          onSeleccionar={handleSeleccionar}
        />
      )}
      <PestanasPagina pestanas={pestanas} />
    </Pagina>
  );
}
