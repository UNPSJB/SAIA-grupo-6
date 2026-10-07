import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";
import { ElementoLimpiezaForm } from "../../components/ElementoLimpiezaForm";
import { useElementoLimpieza } from "../../hooks/useElementoLimpieza";
import { useElementoLimpiezaABM } from "../../hooks/useElementoLimpiezaABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { ElementoLimpiezaFormValues } from "../../types/elementoLimpieza";
import {
  ERROR_FONDO,
  ERROR_TEXTO,
  EXITO,
  GRIS_MEDIO,
  TEXTO_SECUNDARIO,
  TEXTO_TERCIARIO,
} from "../../../../common/theme/tokens";

export function ElementoLimpiezaEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const elementoId = Number(id);

  const {
    elementoLimpieza,
    loading: cargando,
    error: errorCarga,
  } = useElementoLimpieza(Number.isFinite(elementoId) ? elementoId : null);

  const {
    modificar,
    loading: guardando,
    error: errorGuardado,
  } = useElementoLimpiezaABM();

  const [exito, setExito] = useState(false);

  const handleSubmit = async (values:ElementoLimpiezaFormValues ) => {
    try {
      await modificar(elementoId, values);
      setExito(true);
      // Espera 2 segundos para que el usuario vea el mensaje antes de redirigir
      delayedNavigate("/elementos-limpieza");
    } catch {
      // El error queda reflejado en useElementoLimpiezaABM().error
    }
  };

  return (
    <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Editar Elemento de Limpieza
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
          onClick={() => navigate("/elementos-limpieza")}
        >
          Volver a la lista
        </Button>
      </HStack>

      {!cargando && errorCarga && <Text color="red.500">{errorCarga}</Text>}

      {cargando && (
        <Text style={{ fontStyle: "italic", color: TEXTO_TERCIARIO }}>
          Cargando datos del elemento de limpieza...
        </Text>
      )}

      {!cargando && !errorCarga && elementoLimpieza && (
        <>
          {/* Cartel rojo de error en el guardado */}
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
                  Elemento modificado correctamente.
                </Text>
              </Box>
            </Box>
          )}

          <ElementoLimpiezaForm
            key={elementoLimpieza.id}
            initialValues={{
              nombre: elementoLimpieza.nombre,
              fecha_ultimo_recambio: elementoLimpieza.fecha_ultimo_recambio,
              frecuencia_recambio_dias: elementoLimpieza.frecuencia_recambio_dias,
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar Elemento"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/elementos-limpieza")}
          />
        </>
      )}
    </Box>
  );
}
