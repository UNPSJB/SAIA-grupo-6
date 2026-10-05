import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";

import { useAuth } from "../../../../common/context/AuthContext";
import { usePlanCalibracionMantenimientoABM } from "../../hooks/usePlanCalibracionMantenimientoABM";
import { PlanCalibracionMantenimientoForm } from "../PlanCalibracionMantenimientoForm";
import type { PlanCalibracionMantenimientoFormValues } from "../../types/planCalibracionMantenimiento";

export function PlanCalibracionMantenimientoCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { alta, loading, error } = usePlanCalibracionMantenimientoABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: PlanCalibracionMantenimientoFormValues) => {
    if (!user) {
      return;
    }

    try {
      await alta({ ...values, autor_id: user.id });
      setExito(true);
      setTimeout(() => {
        navigate("/planes-calibracion-mantenimiento");
      }, 2000);
    } catch {
      // El error queda expuesto por usePlanCalibracionMantenimientoABM().error.
    }
  };

  if (!user) {
    return <Text color="red.500">No hay un usuario autenticado.</Text>;
  }

  return (
    <Box style={{ padding: "20px", maxWidth: "700px", margin: "0 auto" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Nuevo plan de calibración/mantenimiento
        </Heading>
        <Button
          bg="#6c757d"
          color="white"
          fontSize="16px"
          fontWeight="normal"
          height="auto"
          minW="auto"
          style={{ border: "none", padding: "8px 16px", borderRadius: "6px" }}
          _hover={{ bg: "#6c757d" }}
          onClick={() => navigate("/planes-calibracion-mantenimiento")}
        >
          Volver a la lista
        </Button>
      </HStack>

      {error && (
        <Box
          style={{
            backgroundColor: "#f8d7da",
            color: "#721c24",
            padding: "12px",
            borderRadius: "6px",
            marginBottom: "20px",
            border: "1px solid #f5c6cb",
            fontWeight: "bold",
          }}
        >
          {error}
        </Box>
      )}

      {exito && (
        <Box
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <Box
            style={{
              backgroundColor: "white",
              padding: "30px 50px",
              borderRadius: "12px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              textAlign: "center",
            }}
          >
            <Heading as="h3" style={{ margin: 0, color: "#28a745", fontSize: "24px" }}>
              Éxito
            </Heading>
            <Text style={{ color: "#555", marginTop: "10px", fontSize: "16px" }}>
              Plan creado correctamente.
            </Text>
          </Box>
        </Box>
      )}

      <PlanCalibracionMantenimientoForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de Plan de Calibración/Mantenimiento"
        submitLabel="Crear plan"
        onCancel={() => navigate("/planes-calibracion-mantenimiento")}
      />
    </Box>
  );
}
