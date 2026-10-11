import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Spinner, Stack, Text } from "@chakra-ui/react";
import { UnidadMedidaForm } from "../UnidadMedidaForm";
import { useUnidadMedida } from "../../hooks/useUnidadMedida";
import { useUnidadMedidaABM } from "../../hooks/useUnidadMedidaABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { UnidadMedida } from "../../types/unidadMedida";
import {
  BannerError,
  BotonVolver,
  DialogoExito,
  PageHeader,
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
      <PageHeader
        title="Editar unidad de medida"
        actions={
          <BotonVolver onClick={() => navigate("/unidades-medida")}>
            Volver a la lista
          </BotonVolver>
        }
      />

      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}

      {cargando && (
        <Stack direction="row" gap="3" align="center" color="fg.muted">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic" fontSize="sm">
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
            title="Modificar unidad de medida"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/unidades-medida")}
          />
        </>
      )}
    </Box>
  );
}
