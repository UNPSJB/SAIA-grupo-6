import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";
import { AptitudForm } from "../AptitudForm";
import { useAptitudABM } from "../../hooks/useAptitudABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import type { Aptitud } from "../../types/aptitud";

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
    <Box p="5" maxW="600px" margin="0 auto">
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">Nueva aptitud</Heading>
        <Button type="button" bg="gray.500" color="white" fontSize="16px" fontWeight="normal" height="auto" minW="auto" border="none" p="8px 16px" rounded="md" _hover={{ bg: "gray.600" }} onClick={() => navigate("/aptitudes")}>
          Volver a la lista
        </Button>
      </HStack>

      {error && !conflicto && (
        <Box bg="red.100" color="red.800" p="12px" rounded="md" mb="20px" border="1px solid" borderColor="red.200" fontWeight="bold">
          ⚠️ {error}
        </Box>
      )}

      {exito && (
        <Box position="fixed" top={0} left={0} right={0} bottom={0} bg="blackAlpha.500" display="flex" alignItems="center" justifyContent="center" zIndex={1000}>
          <Box bg="white" p="30px 50px" rounded="xl" boxShadow="0 10px 25px rgba(0,0,0,0.2)" textAlign="center">
            <Box fontSize="50px" mb="10px">✅</Box>
            <Heading as="h3" m={0} color="green.500" fontSize="24px">Éxito</Heading>
            <Text color="gray.600" mt="10px" fontSize="16px" fontWeight={500}>Aptitud agregada correctamente.</Text>
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
