import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";
import { InsumoQuimicoForm } from "../insumoQuimicoForm";
import { useInsumoQuimicoABM } from "../../hooks/useInsumoQuimicoABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import type { InsumoQuimico } from "../../types/insumoQuimico";

export function InsumoQuimicoCreatePage() {
  const navigate = useNavigate();
  const { alta, reactivar, conflicto, cancelarConflicto, loading, error } = useInsumoQuimicoABM();
  const [exito, setExito] = useState(false);
  const [valoresPendientes, setValoresPendientes] = useState<Omit<InsumoQuimico, "id" | "activo"> | null>(null);

  const handleSubmit = async (values: Omit<InsumoQuimico, "id" | "activo">) => {
    try {
      await alta(values);
      setExito(true);
      setTimeout(() => {
        navigate("/insumos-quimicos");
      }, 2000);
    } catch {
      setValoresPendientes(values);
    }
  };

  const handleConfirmarReactivacion = async () => {
    if (!conflicto || !valoresPendientes) return;
    try {
      await reactivar(conflicto.id, valoresPendientes);
      setValoresPendientes(null);
      setExito(true);
      setTimeout(() => navigate("/insumos-quimicos"), 2000);
    } catch {}
  };

  const handleCancelarReactivacion = () => {
    cancelarConflicto();
    setValoresPendientes(null);
  };

  return (
    <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Nuevo insumo químico
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
          onClick={() => navigate("/insumos-quimicos")}
        >
          Volver a la lista
        </Button>
      </HStack>

      {/* Cartel rojo de error */}
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

      {/* Cartel verde de éxito */}
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
            <Heading
              as="h3"
              style={{ margin: 0, color: "#28a745", fontSize: "24px" }}
            >
              Éxito
            </Heading>
            <Text
              style={{
                color: "#555",
                marginTop: "10px",
                fontSize: "16px",
                fontWeight: 500,
              }}
            >
              Insumo químico agregado correctamente.
            </Text>
          </Box>
        </Box>
      )}

      <InsumoQuimicoForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de Insumo Químico"
        submitLabel="Crear insumo químico"
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
