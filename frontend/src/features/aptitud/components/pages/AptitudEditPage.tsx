import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";
import { AptitudForm } from "../AptitudForm";
import { useAptitud } from "../../hooks/useAptitud";
import { useAptitudABM } from "../../hooks/useAptitudABM";
import type { Aptitud } from "../../types/aptitud";

export function AptitudEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const aptitudId = Number(id);

  const { aptitud, loading: cargando, error: errorCarga } = useAptitud(Number.isFinite(aptitudId) ? aptitudId : null);
  const { modificar, loading: guardando, error: errorGuardado } = useAptitudABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: Omit<Aptitud, "id" | "activo">) => {
    try {
      await modificar(aptitudId, values);
      setExito(true);
      delayedNavigate("/aptitudes");
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box p="5" maxW="600px" margin="0 auto">
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">Editar aptitud</Heading>
        <Button
          type="button"
          bg="gray.500"
          color="white"
          fontSize="16px"
          fontWeight="normal"
          height="auto"
          minW="auto"
          border="none"
          p="8px 16px"
          rounded="md"
          _hover={{ bg: "gray.600" }}
          onClick={() => navigate("/aptitudes")}
        >
          Volver a la lista
        </Button>
      </HStack>

      {!cargando && errorCarga && <Text color="red.500">{errorCarga}</Text>}
      {cargando && <Text fontStyle="italic" color="gray.600">Cargando datos de la aptitud...</Text>}

      {!cargando && !errorCarga && aptitud && (
        <>
          {errorGuardado && (
            <Box bg="red.100" color="red.800" p="12px" rounded="md" mb="20px" border="1px solid" borderColor="red.200" fontWeight="bold">
              ⚠️ {errorGuardado}
            </Box>
          )}

          {exito && (
            <Box position="fixed" top={0} left={0} right={0} bottom={0} bg="blackAlpha.500" display="flex" alignItems="center" justifyContent="center" zIndex={1000}>
              <Box bg="white" p="30px 50px" rounded="xl" boxShadow="0 10px 25px rgba(0,0,0,0.2)" textAlign="center">
                <Box fontSize="50px" mb="10px">✅</Box>
                <Heading as="h3" m={0} color="green.500" fontSize="24px">Éxito</Heading>
                <Text color="gray.600" mt="10px" fontSize="16px" fontWeight={500}>Aptitud modificada correctamente.</Text>
              </Box>
            </Box>
          )}

          <AptitudForm
            key={aptitud.id}
            initialValues={{ nombre: aptitud.nombre, descripcion: aptitud.descripcion || "" }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar Aptitud"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/aptitudes")}
          />
        </>
      )}
    </Box>
  );
}
