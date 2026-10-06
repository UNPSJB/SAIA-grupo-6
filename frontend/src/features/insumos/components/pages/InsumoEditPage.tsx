import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";
import { InsumoForm } from "../../components/InsumoForm";
import { useInsumo } from "../../hooks/useInsumo";
import { useInsumoABM } from "../../hooks/useInsumoABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { InsumoFormValues } from "../../types/insumo";
import {
  ERROR_FONDO,
  ERROR_TEXTO,
  EXITO,
  GRIS_MEDIO,
  TEXTO_SECUNDARIO,
  TEXTO_TERCIARIO,
} from "../../../../common/theme/tokens";

export function InsumoEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const insumoId = Number(id);

  const {
    insumo,
    loading: cargando,
    error: errorCarga,
  } = useInsumo(Number.isFinite(insumoId) ? insumoId : null);
  const {
    modificar,
    loading: guardando,
    error: errorGuardado,
  } = useInsumoABM();

  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: InsumoFormValues) => {
    try {
      await modificar(insumoId, values);
      setExito(true);
      // Espera 2 segundos para que el usuario lea el cartel antes de volver a la lista
      delayedNavigate("/insumos");
    } catch {
      // El error ya queda reflejado en useInsumoABM().error
    }
  };

  return (
    <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Editar insumo
        </Heading>
        <Button
          bg={GRIS_MEDIO}
          color="white"
          fontSize="16px"
          fontWeight="normal"
          height="auto"
          minW="auto"
          style={{ border: "none", padding: "8px 16px", borderRadius: "6px" }}
          _hover={{ bg: GRIS_MEDIO }}
          onClick={() => navigate("/insumos")}
        >
          Volver a la lista
        </Button>
      </HStack>

      {!cargando && errorCarga && <Text color="red.500">{errorCarga}</Text>}

      {cargando && (
        <Text style={{ fontStyle: "italic", color: TEXTO_TERCIARIO }}>
          Cargando datos del insumo...
        </Text>
      )}

      {!cargando && !errorCarga && insumo && (
        <>
          {/* Cartel rojo de error */}
          {errorGuardado && (
            <Box
              style={{
                backgroundColor: ERROR_FONDO,
                color: ERROR_TEXTO,
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
                  style={{ margin: 0, color: EXITO, fontSize: "24px" }}
                >
                  Éxito
                </Heading>
                <Text
                  style={{
                    color: TEXTO_SECUNDARIO,
                    marginTop: "10px",
                    fontSize: "16px",
                    fontWeight: 500,
                  }}
                >
                  Insumo modificado correctamente.
                </Text>
              </Box>
            </Box>
          )}

          <InsumoForm
            key={insumo.id}
            initialValues={{
              nombre: insumo.nombre,
              unidad_medida_id: insumo.unidad_medida_id,
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar Insumo"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/insumos")}
          />
        </>
      )}
    </Box>
  );
}
