import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, HStack, Field } from "@chakra-ui/react";
import { IncidenteTable } from "../IncidenteTable";
import { IncidentesPorTipoPanel } from "../IncidentesPorTipoPanel";
import { CerrarIncidenteDialog } from "../CerrarIncidenteDialog";
import { ReabrirIncidenteDialog } from "../ReabrirIncidenteDialog";
import { useIncidentes } from "../../hooks/useIncidentes";
import { useIncidenteABM } from "../../hooks/useIncidenteABM";
import { useAvisoTemporal } from "../../../../common/hooks/useDelayedNavigate";
import { ESTADOS_INCIDENTE, TIPOS_INCIDENTE, estadoLabel } from "../../types/incidente";
import type { Incidente, TipoIncidente, EstadoIncidente } from "../../types/incidente";
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

  // Todos los filtros y el orden viajan al backend, que devuelve una sola
  // página de filas. `orden="antiguos"` mantiene el criterio de antes: el
  // incidente más viejo arriba, para resolver primero lo que más espera.
  const {
    incidentes,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarIncidentes,
  } = useIncidentes(filtroEstado, filtroTipo, busqueda, PAGE_SIZE);

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
      await cargarIncidentes();
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
      await cargarIncidentes();
      avisar(`Incidente #${id} reabierto. El motivo quedó registrado en el historial.`);
    } catch {
      // El mensaje de error ya quedó en el hook.
    }
  };

  // Sin filtros el mensaje es "no hay nada registrado"; con filtros hay que
  // decir que el filtro no arrojó resultados, que es otra situación.
  const hayFiltros = filtroEstado !== "" || filtroTipo !== "" || busqueda.trim() !== "";
  const etiquetaTipo = TIPOS_INCIDENTE.find((t) => t.value === filtroTipo)?.label;

  let mensajeVacio = filtroEstado
    ? `No hay incidentes en estado ${estadoLabel(filtroEstado)}.`
    : "Todavía no se registraron incidentes.";
  if (hayFiltros) {
    const partes: string[] = [];
    if (filtroEstado) partes.push(`en estado ${estadoLabel(filtroEstado)}`);
    if (etiquetaTipo) partes.push(`de tipo ${etiquetaTipo}`);
    if (busqueda.trim()) partes.push(`que coincidan con "${busqueda.trim()}"`);
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
