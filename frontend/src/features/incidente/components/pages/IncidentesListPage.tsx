import { useAvisoTemporal } from "../../../../common/hooks/useDelayedNavigate";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Box, HStack, Field } from "@chakra-ui/react";
import { IncidenteTable } from "../IncidenteTable";
import { CerrarIncidenteDialog } from "../CerrarIncidenteDialog";
import { ReabrirIncidenteDialog } from "../ReabrirIncidenteDialog";
import { useIncidentes } from "../../hooks/useIncidentes";
import { useIncidenteABM } from "../../hooks/useIncidenteABM";
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
  const [page, setPage] = useState(1);
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoIncidente | "">("abierto");
  const [busqueda, setBusqueda] = useState("");

  const { incidentes, loading, error, cargarIncidentes } = useIncidentes(filtroEstado);
  const { cerrar, reabrir, loading: procesando } = useIncidenteABM();

  const [incidenteACerrar, setIncidenteACerrar] = useState<Incidente | null>(null);
  const [incidenteAReabrir, setIncidenteAReabrir] = useState<Incidente | null>(null);
  const { valor: mensajeAviso, avisar } = useAvisoTemporal<string>(3500);

  const incidentesFiltrados = useMemo(() => {
    // El estado ya viene filtrado del backend; el tipo y la búsqueda se filtran
    // acá porque son filtros de la tabla y no condensan la respuesta.
    let resultado = incidentes;
    if (filtroTipo) {
      resultado = resultado.filter((i) => i.tipo === filtroTipo);
    }
    if (busqueda.trim()) {
      // Normaliza acentos: "López" y "lopez" son lo mismo para la búsqueda.
      const normalizar = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const termino = normalizar(busqueda.trim());
      resultado = resultado.filter(
        (i) =>
          normalizar(i.titulo).includes(termino) ||
          normalizar(i.usuario_nombre ?? "").includes(termino)
      );
    }
    return resultado;
  }, [incidentes, filtroTipo, busqueda]);

  const incidentesPaginados = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return incidentesFiltrados.slice(start, start + PAGE_SIZE);
  }, [incidentesFiltrados, page]);

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFiltroTipo(e.target.value as TipoIncidente | "");
    setPage(1);
  };

  const handleEstadoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFiltroEstado(e.target.value as EstadoIncidente | "");
    setPage(1);
  };

  const handleCerrarRequest = (incidente: Incidente) => setIncidenteACerrar(incidente);
  const handleCloseDialog = () => { if (!procesando) setIncidenteACerrar(null); };

  const handleConfirmCerrar = async (observacionCierre: string) => {
    if (!incidenteACerrar) return;
    const id = incidenteACerrar.id;
    try {
      await cerrar(id, observacionCierre);
      setIncidenteACerrar(null);
      await cargarIncidentes();
      avisar(`Incidente #${id} cerrado. La resolución quedó registrada.`);
    } catch {
      // El mensaje de error ya quedó en el hook.
    }
  };

  const handleReabrirRequest = (incidente: Incidente) => setIncidenteAReabrir(incidente);
  const handleReabrirDialogClose = () => { if (!procesando) setIncidenteAReabrir(null); };

  const handleConfirmReabrir = async (motivo: string) => {
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

  let mensajeVacio = "Todavía no se registraron incidentes.";
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
                onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
                placeholder="Buscar por título o reportado por..."
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
            incidentes={incidentesPaginados}
            onCerrar={handleCerrarRequest}
            onReabrir={handleReabrirRequest}
            onVer={(inc) => navigate(`/incidentes/${inc.id}`)}
            showActions={true}
            mensajeVacio={mensajeVacio}
          />

          {incidentesFiltrados.length > PAGE_SIZE && (
            // `Paginacion` espera el total de PAGINAS, no de incidentes: si se
            // pasa la cantidad de filas sale un botón por cada incidente.
            <Paginacion
              count={Math.ceil(incidentesFiltrados.length / PAGE_SIZE)}
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
        onClose={handleCloseDialog}
        onConfirm={handleConfirmCerrar}
      />

      <ReabrirIncidenteDialog
        isOpen={incidenteAReabrir !== null}
        incidente={incidenteAReabrir}
        isLoading={procesando}
        onClose={handleReabrirDialogClose}
        onConfirm={handleConfirmReabrir}
      />
    </Box>
  );
}