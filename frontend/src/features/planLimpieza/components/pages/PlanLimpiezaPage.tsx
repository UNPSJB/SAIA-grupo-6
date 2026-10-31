import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box } from "@chakra-ui/react";
import { PlanLimpiezaTable } from "../PlanLimpiezaTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { usePlanesLimpieza } from "../../hooks/usePlanesLimpieza";
import { usePlanLimpiezaABM } from "../../hooks/usePlanLimpiezaABM";
import { useOpcionesPlanLimpieza } from "../../hooks/useOpcionesPlanLimpieza";
import type { PlanLimpieza } from "../../types/planLimpieza";
import type { ColumnaOrdenPlanLimpieza } from "../../services/planLimpiezaService";
import { useOrdenTabla } from "../../../../common/hooks/useOrdenTabla";
import { useValorDebounced } from "../../../../common/hooks/useValorDebounced";
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
  BotonAgregar,
  EstadoCargando,
  PageHeader,
  Paginacion,
  ToggleInactivos,
} from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

const ETIQUETAS_ORDEN: Record<ColumnaOrdenPlanLimpieza, string> = {
  nombre: "Nombre",
  equipo: "Equipo",
};

export function PlanLimpiezaPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const busquedaAplicada = useValorDebounced(busqueda);
  const [equipoId, setEquipoId] = useState("");
  const orden = useOrdenTabla<ColumnaOrdenPlanLimpieza, "nombre_asc">(
    "nombre_asc"
  );

  const {
    planes,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarPlanes,
  } = usePlanesLimpieza(
    {
      incluirInactivos: verInactivos,
      buscar: busquedaAplicada,
      equipoId: equipoId ? Number(equipoId) : undefined,
      orden: orden.orden,
    },
    PAGE_SIZE
  );
  const { equipos } = useOpcionesPlanLimpieza();
  const { borrar, reactivar, loading: procesando } = usePlanLimpiezaABM();

  const [planAEliminar, setPlanAEliminar] = useState<PlanLimpieza | null>(null);
  const [planAReactivar, setPlanAReactivar] = useState<PlanLimpieza | null>(
    null,
  );

  const handleToggleInactivos = (checked: boolean) => {
    // El hook de listado vuelve solo a la página 1 cuando cambia el filtro.
    setVerInactivos(checked);
  };

  const limpiarTodo = () => {
    setBusqueda("");
    setEquipoId("");
    orden.reiniciar();
  };

  const hayFiltros =
    busqueda.trim() !== "" || equipoId !== "" || orden.columna !== null;

  const chips = chipsDeFiltros([
    {
      clave: "busqueda",
      etiqueta: "Búsqueda",
      valor: busqueda,
      recortar: true,
      onQuitar: () => setBusqueda(""),
    },
    {
      clave: "equipo",
      etiqueta: "Equipo",
      valor: equipos.find((e) => String(e.id) === equipoId)?.nombre ?? equipoId,
      onQuitar: () => setEquipoId(""),
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
      visible: orden.columna !== null,
      onQuitar: orden.reiniciar,
    },
  ]);

  const handleEdit = (plan: PlanLimpieza) =>
    navigate(`/planes-limpieza/${plan.id}/editar`);
  const handleDeleteRequest = (plan: PlanLimpieza) => setPlanAEliminar(plan);
  const handleCloseDialog = () => {
    if (!procesando) setPlanAEliminar(null);
  };

  const handleConfirmDelete = async () => {
    if (!planAEliminar) return;
    try {
      await borrar(planAEliminar.id);
      setPlanAEliminar(null);
      await cargarPlanes();
    } catch {
      // El error queda reflejado en usePlanLimpiezaABM().error
    }
  };

  const handleReactivarRequest = (plan: PlanLimpieza) =>
    setPlanAReactivar(plan);
  const handleCloseReactivarDialog = () => {
    if (!procesando) setPlanAReactivar(null);
  };
  const handleConfirmReactivar = async () => {
    if (!planAReactivar) return;
    try {
      await reactivar(planAReactivar.id, {
        nombre: planAReactivar.nombre,
        tareas: planAReactivar.tareas.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          frecuencia: t.frecuencia,
          tipo: t.tipo,
          descripcion: t.descripcion ?? undefined,
          observaciones: t.observaciones ?? undefined,
        })),
        equipo_id: planAReactivar.equipo_id,
        autor_id: planAReactivar.autor_id,
      });
      setPlanAReactivar(null);
      await cargarPlanes();
    } catch {
      // El error queda reflejado en usePlanLimpiezaABM().error
    }
  };

  return (
    <Box p="5">
      <PageHeader
        title={verInactivos ? "Planes de limpieza dados de baja" : "Planes de limpieza"}
        description="Tareas de limpieza con su frecuencia y el equipo al que aplican."
        actions={
          <BotonAgregar onClick={() => navigate("/planes-limpieza/nuevo")}>
            Agregar
          </BotonAgregar>
        }
      />

      <ToggleInactivos
        checked={verInactivos}
        onChange={handleToggleInactivos}
        children="Ver dados de baja"
      />

      <BarraFiltros
        busqueda={
          <CampoBusqueda
            valor={busqueda}
            onCambio={setBusqueda}
            placeholder="Buscar por plan, equipo o tarea..."
          />
        }
        filtros={
          <FiltroSelect
            label="Equipo"
            valor={equipoId}
            onCambio={setEquipoId}
            opciones={equipos.map((equipo) => ({
              valor: String(equipo.id),
              etiqueta: equipo.nombre,
            }))}
          />
        }
      />

      <ChipsFiltros filtros={chips} onLimpiarTodo={limpiarTodo} />

      {loading && <EstadoCargando>Cargando planes...</EstadoCargando>}
      {!loading && error && <BannerError>{error}</BannerError>}

      {!loading && !error && (
        <>
          {hayFiltros && planes.length === 0 ? (
            <EstadoVacioFiltrado onLimpiar={limpiarTodo}>
              No hay planes de limpieza que coincidan con los filtros
              aplicados.
            </EstadoVacioFiltrado>
          ) : (
            <PlanLimpiezaTable
              planes={planes}
              equipos={equipos}
              orden={orden}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              onReactivar={handleReactivarRequest}
            />
          )}

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

      <ConfirmDialog
        isOpen={planAEliminar !== null}
        titulo={
          <>
            ¿Está seguro que desea eliminar el plan{" "}
            <strong>{planAEliminar?.nombre}</strong>?
          </>
        }
        mensaje="Esta acción no se puede deshacer."
        isLoading={procesando}
        onCancel={handleCloseDialog}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmarReactivacionDialog
        isOpen={planAReactivar !== null}
        mensaje={`¿Está seguro que desea reactivar el plan "${planAReactivar?.nombre}"?`}
        isLoading={procesando}
        onCancel={handleCloseReactivarDialog}
        onConfirm={handleConfirmReactivar}
      />
    </Box>
  );
}
