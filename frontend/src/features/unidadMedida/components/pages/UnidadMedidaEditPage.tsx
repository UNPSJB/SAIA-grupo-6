import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";
import { UnidadMedidaForm } from "../UnidadMedidaForm";
import { useUnidadMedida } from "../../hooks/useUnidadMedida";
import { useUnidadMedidaABM } from "../../hooks/useUnidadMedidaABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { UnidadMedida } from "../../types/unidadMedida";
import {
  ERROR_FONDO,
  ERROR_TEXTO,
  EXITO,
  GRIS_MEDIO,
  TEXTO_SECUNDARIO,
  TEXTO_TERCIARIO,
} from "../../../../common/theme/tokens";

export function UnidadMedidaEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const unidadId = Number(id);

  const {
    unidadMedida,
    loading: cargando,
    error: errorCarga,
  } = useUnidadMedida(Number.isFinite(unidadId) ? unidadId : null);

  const {
    modificar,
    loading: guardando,
    error: errorGuardado,
  } = useUnidadMedidaABM();

  const [exito, setExito] = useState(false);

  const handleSubmit = async (
    values: Omit<UnidadMedida, "id" | "activo">
  ) => {
    try {
      await modificar(unidadId, values);
      setExito(true);

      delayedNavigate("/unidades-medida");
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <HStack justify="space-between" mb="20px">
        <Heading
          as="h2"
          size="md"
          fontWeight="bold"
          color="black"
        >
          Editar unidad de medida
        </Heading>

        <Button
          bg={GRIS_MEDIO}
          color="white"
          fontSize="16px"
          fontWeight="normal"
          height="auto"
          minW="auto"
          style={{
            border: "none",
            padding: "8px 16px",
            borderRadius: "6px",
          }}
          _hover={{ bg: GRIS_MEDIO }}
          onClick={() => navigate("/unidades-medida")}
        >
          Volver a la lista
        </Button>
      </HStack>

      {!cargando && errorCarga && (
        <Text color="red.500">{errorCarga}</Text>
      )}

      {cargando && (
        <Text
          style={{
            fontStyle: "italic",
            color: TEXTO_TERCIARIO,
          }}
        >
          Cargando datos de la unidad de medida...
        </Text>
      )}

      {!cargando && !errorCarga && unidadMedida && (
        <>
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
                <Box
                  style={{
                    fontSize: "50px",
                    marginBottom: "10px",
                  }}
                >
                  ✅
                </Box>

                <Heading
                  as="h3"
                  style={{
                    margin: 0,
                    color: EXITO,
                    fontSize: "24px",
                  }}
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
                  Unidad de medida modificada correctamente.
                </Text>
              </Box>
            </Box>
          )}

          <UnidadMedidaForm
            key={unidadMedida.id}
            initialValues={{
              nombre: unidadMedida.nombre,
              simbolo: unidadMedida.simbolo,
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar Unidad de Medida"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/unidades-medida")}
          />
        </>
      )}
    </Box>
  );
}
