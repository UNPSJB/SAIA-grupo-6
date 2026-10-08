import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePaginacion } from "../../../../common/hooks/usePaginacion";
import { Box } from "@chakra-ui/react";
import { PlanLimpiezaTable } from "../PlanLimpiezaTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { usePlanesLimpieza } from "../../hooks/usePlanesLimpieza";
import { usePlanLimpiezaABM } from "../../hooks/usePlanLimpiezaABM";
import { useOpcionesPlanLimpieza } from "../../hooks/useOpcionesPlanLimpieza";
import type { PlanLimpieza } from "../../types/planLimpieza";
import {
  BannerError,
  BotonAgregar,
  EstadoCargando,
  PageHeader,
  Paginacion,
  ToggleInactivos,
} from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

export function PlanLimpiezaPage() {
  const navigate = useNavigate();
  const [verInactivos, setVerInactivos] = useState(false);

  const { planes, loading, error, cargarPlanes } =
    usePlanesLimpieza(verInactivos);
  const { equipos } = useOpcionesPlanLimpieza();
  const {
    paginados: planesPaginados,
    totalPaginas,
    page,
    setPage,
    hayVariasPaginas,
  } = usePaginacion(planes, verInactivos, PAGE_SIZE);
  const { borrar, reactivar, loading: procesando } = usePlanLimpiezaABM();

  const [planAEliminar, setPlanAEliminar] = useState<PlanLimpieza | null>(null);
  const [planAReactivar, setPlanAReactivar] = useState<PlanLimpieza | null>(
    null,
  );

  const handleToggleInactivos = (checked: boolean) => {
    setVerInactivos(checked);
    setPage(1);
  };

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
          descripcion: t.descripcion ?? undefined,
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

      {loading && <EstadoCargando>Cargando planes...</EstadoCargando>}
      {!loading && error && <BannerError>{error}</BannerError>}

      {!loading && !error && (
        <>
          <PlanLimpiezaTable
            planes={planesPaginados}
            equipos={equipos}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            onReactivar={handleReactivarRequest}
          />

          {hayVariasPaginas && (
            <Paginacion
              count={totalPaginas}
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