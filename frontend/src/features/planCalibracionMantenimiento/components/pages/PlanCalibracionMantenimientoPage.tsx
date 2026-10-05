import { useNavigate } from "react-router-dom";
import { Box, Button, Heading, HStack, Spinner, Text } from "@chakra-ui/react";

import { useEquipos } from "../../../equipo/hooks/useEquipos";
import { usePlanesCalibracionMantenimiento } from "../../hooks/usePlanesCalibracionMantenimiento";
import { PlanCalibracionMantenimientoTable } from "../PlanCalibracionMantenimientoTable";
import type { PlanCalibracionMantenimiento } from "../../types/planCalibracionMantenimiento";

const TEAL = "#468189";

export function PlanCalibracionMantenimientoPage() {
  const navigate = useNavigate();
  const {
    planes,
    loading: cargandoPlanes,
    error: errorPlanes,
  } = usePlanesCalibracionMantenimiento();
  const {
    equipos,
    loading: cargandoEquipos,
    error: errorEquipos,
  } = useEquipos(true);

  const nombresEquipos = new Map(
    equipos.map((equipo) => [equipo.id, equipo.nombre]),
  );

  const handleEdit = (plan: PlanCalibracionMantenimiento) => {
    navigate(`/planes-calibracion-mantenimiento/${plan.id}/editar`);
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
        />
      )}
    </Box>
  );
}
