import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";
import { InsumoForm } from "../insumoForm";
import { useInsumoABM } from "../../hooks/useInsumoABM";
import type { Insumo } from "../../types/insumo";

export function InsumoCreatePage() {
  const navigate = useNavigate();
  const { alta, loading, error } = useInsumoABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: Omit<Insumo, "id">) => {
    try {
      await alta(values);
      setExito(true);
      // Espera 2 segundos para que el usuario lea el cartel antes de volver a la lista
      setTimeout(() => {
        navigate("/insumos");
      }, 2000);
    } catch {
      // El error ya queda reflejado en useInsumoABM().error
    }
  };

  return (
    <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Nuevo insumo
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
          onClick={() => navigate("/insumos")}
        >
          Volver a la lista
        </Button>
      </HStack>

      {/* Cartel rojo de error */}
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
              Insumo agregado correctamente.
            </Text>
          </Box>
        </Box>
      )}

      <InsumoForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de Insumo"
        submitLabel="Crear insumo"
      />
    </Box>
  );
}
