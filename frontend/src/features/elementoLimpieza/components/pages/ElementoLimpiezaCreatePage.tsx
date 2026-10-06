import type { ElementoLimpiezaFormValues } from "../../types/elementoLimpieza";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";
import { ElementoLimpiezaForm } from "../ElementoLimpiezaForm";
import { useElementoLimpiezaABM } from "../../hooks/useElementoLimpiezaABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import {
  ERROR_FONDO,
  ERROR_TEXTO,
  EXITO,
  GRIS_MEDIO,
  TEXTO_SECUNDARIO,
} from "../../../../common/theme/tokens";


export function ElementoLimpiezaCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, reactivar, conflicto, cancelarConflicto, loading, error } =
    useElementoLimpiezaABM();
  const [exito, setExito] = useState(false);
  const [valoresPendientes, setValoresPendientes] =
    useState<ElementoLimpiezaFormValues | null>(null);

  const handleSubmit = async (values: ElementoLimpiezaFormValues) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/elementos-limpieza");
    } catch {
      // Guardamos los valores por si el usuario decide confirmar la reactivación
      setValoresPendientes(values);
    }
  };

  const handleConfirmarReactivacion = async () => {
    if (!conflicto || !valoresPendientes) return;
    try {
      await reactivar(conflicto.id, valoresPendientes);
      setValoresPendientes(null);
      setExito(true);
      delayedNavigate("/elementos-limpieza");
    } catch {
      // El error queda expuesto en useElementoLimpiezaABM().error
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
          Nuevo elemento de limpieza
        </Heading>
        <Button
          bg={GRIS_MEDIO}
          color="white"
          fontSize="16px"
          fontWeight="normal"
          height="auto"
          minW="auto"
          style={{ border: "none", padding: "8px 16px", borderRadius: "6px" }}
          _hover={{ bg: "#5a6268" }}
          onClick={() => navigate("/elementos-limpieza")}
        >
          Volver a la lista
        </Button>
      </HStack>

      {/* Cartel rojo de error (solo se muestra si no hay conflicto de reactivación activo) */}
      {error && !conflicto && (
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
              Elemento de limpieza agregado correctamente.
            </Text>
          </Box>
        </Box>
      )}

      <ElementoLimpiezaForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de Elemento de Limpieza"
        submitLabel="Crear Elemento"
        onCancel={() => navigate("/elementos-limpieza")}
      />

      {/* Modal de reactivación cuando se intenta dar de alta un registro inactivo */}
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
