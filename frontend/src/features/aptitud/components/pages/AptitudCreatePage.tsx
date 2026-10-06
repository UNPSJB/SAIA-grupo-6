import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";
import { AptitudForm } from "../AptitudForm";
import { useAptitudABM } from "../../hooks/useAptitudABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import type { Aptitud } from "../../types/aptitud";
import {
  ERROR_FONDO,
  ERROR_TEXTO,
  EXITO,
  GRIS_MEDIO,
  TEXTO_SECUNDARIO,
} from "../../../../common/theme/tokens";

export function AptitudCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, reactivar, conflicto, cancelarConflicto, loading, error } = useAptitudABM();
  const [exito, setExito] = useState(false);
  const [valoresPendientes, setValoresPendientes] = useState<Omit<Aptitud, "id" | "activo"> | null>(null);

  const handleSubmit = async (values: Omit<Aptitud, "id" | "activo">) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/aptitudes");
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
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  const handleCancelarReactivacion = () => {
    cancelarConflicto();
    setValoresPendientes(null);
  };

  return (
    <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">Nueva aptitud</Heading>
        <Button bg={GRIS_MEDIO} color="white" fontSize="16px" fontWeight="normal" height="auto" minW="auto" style={{ border: "none", padding: "8px 16px", borderRadius: "6px" }} _hover={{ bg: GRIS_MEDIO }} onClick={() => navigate("/aptitudes")}>
          Volver a la lista
        </Button>
      </HStack>

      {error && !conflicto && (
        <Box style={{ backgroundColor: ERROR_FONDO, color: ERROR_TEXTO, padding: "12px", borderRadius: "6px", marginBottom: "20px", border: "1px solid #f5c6cb", fontWeight: "bold" }}>
          ⚠️ {error}
        </Box>
      )}

      {exito && (
        <Box style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <Box style={{ backgroundColor: "white", padding: "30px 50px", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <Box style={{ fontSize: "50px", marginBottom: "10px" }}>✅</Box>
            <Heading as="h3" style={{ margin: 0, color: EXITO, fontSize: "24px" }}>Éxito</Heading>
            <Text style={{ color: TEXTO_SECUNDARIO, marginTop: "10px", fontSize: "16px", fontWeight: 500 }}>Aptitud agregada correctamente.</Text>
          </Box>
        </Box>
      )}

      <AptitudForm onSubmit={handleSubmit} isLoading={loading} title="Alta de Aptitud" submitLabel="Crear aptitud" />

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
