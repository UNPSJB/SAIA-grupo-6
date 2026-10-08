import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Heading, HStack, Spinner } from "@chakra-ui/react";

import { useEquipos } from "../../../equipo/hooks/useEquipos";
import { usePlanesCalibracionMantenimiento } from "../../hooks/usePlanesCalibracionMantenimiento";
import { usePlanCalibracionMantenimientoABM } from "../../hooks/usePlanCalibracionMantenimientoABM";
import { PlanCalibracionMantenimientoTable } from "../PlanCalibracionMantenimientoTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import type { PlanCalibracionMantenimiento } from "../../types/planCalibracionMantenimiento";
import { BannerError } from "../../../../components/ui/patrones";

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
      <HStack justify="space-between" mb="5">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
          Planes de Calibración/Mantenimiento
        </Heading>
        <Button
          colorPalette="brand"
          fontSize="md"
          fontWeight="bold"
          rounded="md"
          px="5"
          py="2.5"
          onClick={() => navigate("/planes-calibracion-mantenimiento/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>

      {error && <BannerError>{error}</BannerError>}
      {loading && <Spinner color="brand.500" />}
      {!loading && !error && (
        <PlanCalibracionMantenimientoTable
          planes={planes}
          nombresEquipos={nombresEquipos}
          onEdit={handleEdit}
          onDelete={setPlanAEliminar}
        />
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