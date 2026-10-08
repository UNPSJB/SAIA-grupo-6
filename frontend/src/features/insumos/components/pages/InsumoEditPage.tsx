import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Spinner, Stack, Text } from "@chakra-ui/react";
import { InsumoForm } from "../../components/InsumoForm";
import { useInsumo } from "../../hooks/useInsumo";
import { useInsumoABM } from "../../hooks/useInsumoABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { InsumoFormValues } from "../../types/insumo";
import {
  BannerError,
  BotonVolver,
  DialogoExito,
  PageHeader,
} from "../../../../components/ui/patrones";

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
      // Espera para que el usuario lea el cartel antes de volver al listado.
      delayedNavigate("/insumos");
    } catch {
      // El error ya queda reflejado en useInsumoABM().error
    }
  };

  return (
    <Box p="5" maxW="600px" mx="auto">
      <PageHeader
        title="Editar insumo"
        actions={
          <BotonVolver onClick={() => navigate("/insumos")}>
            Volver a la lista
          </BotonVolver>
        }
      />

      {cargando && (
        <Stack direction="row" gap="3" align="center" color="fg.muted">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic" fontSize="sm">
            Cargando datos del insumo...
          </Text>
        </Stack>
      )}

      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}

      {!cargando && !errorCarga && insumo && (
        <>
          {errorGuardado && <BannerError>{errorGuardado}</BannerError>}

          <InsumoForm
            key={insumo.id}
            initialValues={{
              nombre: insumo.nombre,
              unidad_medida_id: insumo.unidad_medida_id,
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar insumo"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/insumos")}
          />
        </>
      )}

      <DialogoExito
        isOpen={exito}
        mensaje="Insumo modificado correctamente."
      />
    </Box>
  );
}