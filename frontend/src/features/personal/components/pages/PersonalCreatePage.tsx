import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";
import { PersonalForm } from "../PersonalForm";
import { usePersonalABM } from "../../hooks/usePersonalABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import type { Persona } from "../../types/personal";

type PersonaInput = Omit<Persona, "id" | "activo" | "fecha_creacion" | "fecha_actualizacion">;

export function PersonalCreatePage() {
  const navigate = useNavigate();
  const { alta, reactivar, conflicto, cancelarConflicto, loading, error } = usePersonalABM();
  const [exito, setExito] = useState(false);
  // Guardamos los valores que el usuario cargó para poder reutilizarlos
  // si confirma la reactivación (no se los volvemos a pedir).
  const [valoresPendientes, setValoresPendientes] = useState<PersonaInput | null>(null);

  const handleSubmit = async (values: PersonaInput) => {
    try {
      await alta(values);
      setExito(true);
      setTimeout(() => {
        navigate("/personal");
      }, 2000);
    } catch {
      // Si fue un conflicto de inactivo, "conflicto" ya quedó seteado por el
      // hook y el diálogo se muestra solo. Guardamos los valores para reusarlos.
      setValoresPendientes(values);
    }
  };

  const handleConfirmarReactivacion = async () => {
    if (!conflicto || !valoresPendientes) return;
    try {
      await reactivar(conflicto.id, valoresPendientes);
      setValoresPendientes(null);
      setExito(true);
      setTimeout(() => {
        navigate("/personal");
      }, 2000);
    } catch {
      // El error ya queda reflejado en usePersonalABM().error
    }
  };

  const handleCancelarReactivacion = () => {
    cancelarConflicto();
    setValoresPendientes(null);
  };

  return (
    <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Nuevo Personal
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
          onClick={() => navigate("/personal")}
        >
          Volver a la lista
        </Button>
      </HStack>

      {/* El conflicto de "inactivo" no se muestra acá como cartel de error:
          se resuelve con el diálogo de reactivación de abajo */}
      {error && !conflicto && (
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
          ⚠️ {error}
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
            <Box style={{ fontSize: "50px", marginBottom: "10px" }}>✅</Box>
            <Heading as="h3" style={{ margin: 0, color: "#28a745", fontSize: "24px" }}>
              Éxito
            </Heading>
            <Text style={{ color: "#555", marginTop: "10px", fontSize: "16px", fontWeight: 500 }}>
              Personal agregado correctamente.
            </Text>
          </Box>
        </Box>
      )}

      <PersonalForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de Personal"
        submitLabel="Crear personal"
      />

      <ConfirmarReactivacionDialog
        isOpen={conflicto !== null}
        mensaje={conflicto?.mensaje ?? ""}
        isLoading={loading}
        onCancel={handleCancelarReactivacion}
        onConfirm={handleConfirmarReactivacion}
      />
    </Box>
  );
}
