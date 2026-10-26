import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, HStack, Field } from "@chakra-ui/react";
import { IncidenteTable } from "../IncidenteTable";
import { IncidentesPorTipoPanel } from "../IncidentesPorTipoPanel";
import { CerrarIncidenteDialog } from "../CerrarIncidenteDialog";
import { ReabrirIncidenteDialog } from "../ReabrirIncidenteDialog";
import { useIncidentes } from "../../hooks/useIncidentes";
import { useIncidenteABM } from "../../hooks/useIncidenteABM";
import { useAvisoTemporal } from "../../../../common/hooks/useDelayedNavigate";
import {
  ESTADOS_INCIDENTE,
  TIPOS_INCIDENTE,
  estadoLabel,
  periodoLabel,
} from "../../types/incidente";
import type {
  EstadoIncidente,
  Incidente,
  PeriodoRapido,
  TipoIncidente,
} from "../../types/incidente";
import {
  escucharCambioIncidentes,
  notificarCambioIncidentes,
} from "../../eventoIncidentes";
import { haceDiasISO, hoyISO, inicioMesISO } from "../../../../common/utils/fechas";
import {
  BannerError,
  BannerExito,
  BotonAgregar,
  EstadoCargando,
  FormInput,
  FormNativeSelect,
  LabelFiltro,
  PageHeader,
  Paginacion,
  Tarjeta,
} from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

export function IncidentesListPage() {
  const navigate = useNavigate();

  // HU "Ver incidentes abiertos": por defecto se listan solo los que todavía
  // no tienen una acción correctiva registrada (estado abierto).
  const [filtroEstado, setFiltroEstado] = useState<EstadoIncidente | "">("abierto");
  const [filtroTipo, setFiltroTipo] = useState<TipoIncidente | "">("");
  const [busqueda, setBusqueda] = useState("");
  const [incluirCerrados, setIncluirCerrados] = useState(false);

  // Período de la estadística: por defecto "todo", que es el comportamiento
  // original (sin acotar por fecha).
  const [periodo, setPeriodo] = useState<PeriodoRapido>("todo");
  const [fechaDesde, setFechaDesde] = useState(haceDiasISO(30));
  const [fechaHasta, setFechaHasta] = useState(hoyISO());

  // Todos los filtros viajan al backend, que devuelve una página de filas.
  // `orden="antiguos"` mantiene el criterio de antes: el incidente más viejo
  // arriba, para resolver primero lo que más espera.
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
    "antiguos"
  );

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

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFiltroTipo(e.target.value as TipoIncidente | "");
  };

  const handleEstadoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoEstado = e.target.value as EstadoIncidente | "";
    setFiltroEstado(nuevoEstado);
    // Sincroniza el switch del gráfico con el dropdown
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

  // Sin filtros el mensaje es "no hay nada registrado"; con filtros hay que
  // decir que el filtro no arrojó resultados, que es otra situación.
  const hayFiltros =
    filtroEstado !== "" ||
    filtroTipo !== "" ||
    busqueda.trim() !== "" ||
    periodo !== "todo";
  const etiquetaTipo = TIPOS_INCIDENTE.find((t) => t.value === filtroTipo)?.label;

  let mensajeVacio = filtroEstado
    ? `No hay incidentes en estado ${estadoLabel(filtroEstado)}.`
    : "Todavía no se registraron incidentes.";
  if (hayFiltros) {
    const partes: string[] = [];
    if (filtroEstado) partes.push(`en estado ${estadoLabel(filtroEstado)}`);
    if (etiquetaTipo) partes.push(`de tipo ${etiquetaTipo}`);
    if (busqueda.trim()) partes.push(`que coincidan con "${busqueda.trim()}"`);
    if (periodo !== "todo") partes.push(`en ${periodoLabel(periodo)}`);
    mensajeVacio = `No hay incidentes ${partes.join(" ")}.`;
  }

  return (
    <Box p="5">
      <PageHeader
        title="Gestión de incidentes"
        description="Reportes, cierres y reaperturas del laboratorio."
        actions={
          <BotonAgregar onClick={() => navigate("/incidentes/reportar")}>
            Registrar incidente
          </BotonAgregar>
        }
      />

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

      {/* Filtros */}
      <Tarjeta p="4" mb="6">
        <HStack gap="4" flexWrap="wrap" align="flex-end">
          <Box minW="200px">
            <Field.Root>
              <LabelFiltro>Estado</LabelFiltro>
              <FormNativeSelect
                value={filtroEstado}
                onChange={handleEstadoChange}
              >
                <option value="">Todos los estados</option>
                {ESTADOS_INCIDENTE.map((estado) => (
                  <option key={estado.value} value={estado.value}>
                    {estado.label}
                  </option>
                ))}
              </FormNativeSelect>
            </Field.Root>
          </Box>

          <Box minW="200px">
            <Field.Root>
              <LabelFiltro>Tipo</LabelFiltro>
              <FormNativeSelect value={filtroTipo} onChange={handleTipoChange}>
                <option value="">Todos los tipos</option>
                {TIPOS_INCIDENTE.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </FormNativeSelect>
            </Field.Root>
          </Box>

          <Box minW="250px" flex="1">
            <Field.Root>
              <LabelFiltro>Búsqueda</LabelFiltro>
              <FormInput
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por título, descripción o reportado por..."
              />
            </Field.Root>
          </Box>
        </HStack>
      </Tarjeta>

      {loading && <EstadoCargando>Cargando incidentes...</EstadoCargando>}
      {!loading && error && <BannerError>{error}</BannerError>}

      {mensajeAviso && <BannerExito>{mensajeAviso}</BannerExito>}

      {!loading && !error && (
        <>
          <IncidenteTable
            incidentes={incidentes}
            onCerrar={setIncidenteACerrar}
            onReabrir={setIncidenteAReabrir}
            onVer={(incidente) => navigate(`/incidentes/${incidente.id}`)}
            showActions={true}
            mensajeVacio={mensajeVacio}
          />

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
    </Box>
  );
}
