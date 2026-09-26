import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";
import { InsumoQuimicoForm } from "../insumoQuimicoForm";
import { useInsumoQuimico } from "../../hooks/useInsumoQuimico";
import { useInsumoQuimicoABM } from "../../hooks/useInsumoQuimicoABM";
import type { InsumoQuimico } from "../../types/insumoQuimico";

export function InsumoQuimicoEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const insumoId = Number(id);

  const {
    insumoQuimico,
    loading: cargando,
    error: errorCarga,
  } = useInsumoQuimico(Number.isFinite(insumoId) ? insumoId : null);
  const {
    modificar,
    loading: guardando,
    error: errorGuardado,
  } = useInsumoQuimicoABM();

  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: Omit<InsumoQuimico, "id" | "activo">) => {
    try {
      await modificar(insumoId, values);
      setExito(true);
      setTimeout(() => {
        navigate("/insumos-quimicos");
      }, 2000);
    } catch {}
  };

  return (
    <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Editar insumo químico
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

      {!cargando && errorCarga && <Text color="red.500">{errorCarga}</Text>}

      {cargando && (
        <Text style={{ fontStyle: "italic", color: "#666" }}>
          Cargando datos del insumo químico...
        </Text>
      )}

      {!cargando && !errorCarga && insumoQuimico && (
        <>
          {/* Cartel rojo de error */}
          {errorGuardado && (
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
              ⚠️ {errorGuardado}
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
                  Insumo químico modificado correctamente.
                </Text>
              </Box>
            </Box>
          )}

          <InsumoQuimicoForm
            key={insumoQuimico.id}
            initialValues={{
              nombre: insumoQuimico.nombre,
              tipo: insumoQuimico.tipo,
              unidad_medida: insumoQuimico.unidad_medida,
              stock: insumoQuimico.stock         
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar Insumo Químico"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/insumos-quimicos")}
          />
        </>
      )}
    </Box>
  );
}