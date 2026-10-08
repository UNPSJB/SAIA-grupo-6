import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Heading, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { UnidadMedidaForm } from "../UnidadMedidaForm";
import { useUnidadMedida } from "../../hooks/useUnidadMedida";
import { useUnidadMedidaABM } from "../../hooks/useUnidadMedidaABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { UnidadMedida } from "../../types/unidadMedida";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";

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
    <Box p="5" maxW="600px" mx="auto">
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
          colorPalette="gray"
          fontSize="md"
          fontWeight="normal"
          h="auto"
          minW="auto"
          px="4"
          py="2"
          rounded="md"
          onClick={() => navigate("/unidades-medida")}
        >
          Volver a la lista
        </Button>
      </HStack>

      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}

      {cargando && (
        <Stack direction="row" gap="3" align="center" color="gray.600">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic">
            Cargando datos de la unidad de medida...
          </Text>
        </Stack>
      )}

      {!cargando && !errorCarga && unidadMedida && (
        <>
          {errorGuardado && <BannerError>{errorGuardado}</BannerError>}

          <DialogoExito
            isOpen={exito}
            mensaje="Unidad de medida modificada correctamente."
          />

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
