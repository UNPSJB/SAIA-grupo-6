import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Heading, HStack, Spinner, Text } from "@chakra-ui/react";

import { useEquipos } from "../../../equipo/hooks/useEquipos";
import { usePlanesCalibracionMantenimiento } from "../../hooks/usePlanesCalibracionMantenimiento";
import { usePlanCalibracionMantenimientoABM } from "../../hooks/usePlanCalibracionMantenimientoABM";
import { PlanCalibracionMantenimientoTable } from "../PlanCalibracionMantenimientoTable";
import { ConfirmDialog } from "../../../../common/components/ConfirmDialog";
import type { PlanCalibracionMantenimiento } from "../../types/planCalibracionMantenimiento";
import { TEAL } from "../../../../common/theme/tokens";

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
    <Box style={{ padding: "20px" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Planes de Calibración/Mantenimiento
        </Heading>
        <Button
          bg={TEAL}
          color="white"
          fontSize="16px"
          fontWeight="bold"
          borderRadius="6px"
          px="20px"
          py="10px"
          _hover={{ bg: TEAL }}
          onClick={() => navigate("/planes-calibracion-mantenimiento/nuevo")}
        >
          + Agregar
        </Button>
      </HStack>

      {loading && <Spinner />}
      {!loading && error && <Text color="red.500">{error}</Text>}
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