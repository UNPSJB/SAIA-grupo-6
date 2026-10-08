import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box } from "@chakra-ui/react";
import { usePaginas } from "../../../../common/hooks/usePaginas";

import { useEquipos } from "../../../equipo/hooks/useEquipos";
import { usePlanesCalibracionMantenimiento } from "../../hooks/usePlanesCalibracionMantenimiento";
import { usePlanCalibracionMantenimientoABM } from "../../hooks/usePlanCalibracionMantenimientoABM";
import { PlanCalibracionMantenimientoTable } from "../PlanCalibracionMantenimientoTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import type { PlanCalibracionMantenimiento } from "../../types/planCalibracionMantenimiento";
import {
  BannerError,
  BotonAgregar,
  EstadoCargando,
  PageHeader,
  Paginacion,
} from "../../../../components/ui/patrones";

const PAGE_SIZE = 10;

export function PlanCalibracionMantenimientoPage() {
  const navigate = useNavigate();
  const {
    planes,
    loading: cargandoPlanes,
    error: errorPlanes,
    cargarPlanes,
  } = usePlanesCalibracionMantenimiento();
  const {
    equipos,
    loading: cargandoEquipos,
    error: errorEquipos,
  } = useEquipos(true);
  const { borrar, loading: procesando } = usePlanCalibracionMantenimientoABM();
  // Sin paginar, la tabla crecía hacia abajo con cada plan nuevo; el resto de
  // los listados de Operaciones ya paginan de a 10.
  const {
    paginados: planesPaginados,
    page,
    setPage,
    totalPaginas,
    hayVariasPaginas,
  } = usePaginas(planes, PAGE_SIZE);

  const [planAEliminar, setPlanAEliminar] =
    useState<PlanCalibracionMantenimiento | null>(null);

  const nombresEquipos = new Map(
    equipos.map((equipo) => [equipo.id, equipo.nombre]),
  );

  const handleEdit = (plan: PlanCalibracionMantenimiento) => {
    navigate(`/planes-calibracion-mantenimiento/${plan.id}/editar`);
  };

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
      // El hook de mutación expone el estado de error a esta página.
    }
  };

  const loading = cargandoPlanes || cargandoEquipos;
  const error = errorPlanes || errorEquipos;

  return (
    <Box p="5">
      <PageHeader
        title="Planes de calibración y mantenimiento"
        description="Periodicidad de calibración y de mantenimiento por equipo, con su próximo vencimiento."
        actions={
          <BotonAgregar
            onClick={() => navigate("/planes-calibracion-mantenimiento/nuevo")}
          >
            Agregar
          </BotonAgregar>
        }
      />

      {error && <BannerError>{error}</BannerError>}
      {loading && <EstadoCargando>Cargando planes...</EstadoCargando>}
      {!loading && !error && (
        <>
          <PlanCalibracionMantenimientoTable
            planes={planesPaginados}
            nombresEquipos={nombresEquipos}
            onEdit={handleEdit}
            onDelete={setPlanAEliminar}
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
        titulo="Eliminar plan"
        mensaje={
          planAEliminar
            ? `¿Está seguro que desea eliminar el plan ${planAEliminar.tipo === "calibracion" ? "de calibración" : "de mantenimiento"}?`
            : ""
        }
        textoConfirmar="Sí, eliminar"
        isLoading={procesando}
        onCancel={handleCloseDialog}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
}